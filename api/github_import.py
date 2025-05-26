import tempfile, os, json, shutil, subprocess
from urllib.parse import parse_qs, urlparse
from llm_index.analysis import analyze_project_enhanced
from llm_index.clustering import cluster_files
from llm_index.reporting import generate_report
from llm_index.security import scan_for_malware, validate_github_url
from llm_index.utils import unique_tempdir, cleanup_tempdir
import logging

logger = logging.getLogger('llm-index.api.github_import')

def handler(request):
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    }
    
    if request.method == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': ''}
    
    if request.method != 'GET':
        return {
            'statusCode': 405, 
            'headers': headers,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    tempdir, sid = None, None
    try:
        # Parse query parameters
        parsed_url = urlparse(request.url)
        query_params = parse_qs(parsed_url.query)
        
        repo_url = query_params.get('repo', [None])[0]
        branch = query_params.get('branch', ['main'])[0]
        
        if not repo_url:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Missing repo parameter'})
            }
            
        validate_github_url(repo_url)
        tempdir, sid = unique_tempdir()
        
        logger.info(f"Cloning repository: {repo_url}, branch: {branch}")
        
        # Clone repository
        clone_dir = os.path.join(tempdir, 'repo')
        subprocess.run([
            "git", "clone", "--depth", "1", "--branch", branch, 
            repo_url, clone_dir
        ], check=True, capture_output=True, text=True)
        
        scan_for_malware(clone_dir)
        
        logger.info("Starting enhanced GitHub repository analysis")
        
        # Use enhanced analysis
        analysis_result = analyze_project_enhanced(clone_dir)
        dep_graph = analysis_result['dep_graph']
        complexity_scores = analysis_result['complexity_scores']
        debt_analysis = analysis_result['debt_analysis']
        
        # Enhanced clustering and reporting
        clusters = cluster_files(dep_graph, complexity_scores=complexity_scores)
        report = generate_report(dep_graph, clusters, complexity_scores, debt_analysis)
        
        # Extract repository metadata
        repo_metadata = _extract_repo_metadata(clone_dir, repo_url)
        
        response_data = {
            "dep_graph": dep_graph,
            "clusters": clusters,
            "report": report,
            "complexity_scores": complexity_scores,
            "debt_analysis": debt_analysis,
            "enhancement_status": "success",
            "repository_metadata": repo_metadata,
            "analysis_summary": {
                "total_files": len(dep_graph),
                "total_clusters": len(clusters),
                "languages_detected": _detect_languages(dep_graph),
                "avg_complexity": round(sum(complexity_scores.values()) / len(complexity_scores), 2) if complexity_scores else 0,
                "health_grade": debt_analysis.get('summary', {}).get('overall_health_grade', 'N/A'),
                "critical_issues": debt_analysis.get('summary', {}).get('critical_issues', 0),
                "repository_url": repo_url,
                "branch": branch
            }
        }
        
        logger.info(f"GitHub analysis complete: {repo_url} - {len(clusters)} clusters, {len(complexity_scores)} files analyzed")
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(response_data)
        }
        
    except subprocess.CalledProcessError as e:
        error_msg = f"Git clone failed: {e.stderr if hasattr(e, 'stderr') else str(e)}"
        logger.error(error_msg)
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({
                'error': error_msg,
                'enhancement_status': 'git_failed'
            })
        }
    except Exception as e:
        logger.error(f"GitHub import failed: {e}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': str(e),
                'enhancement_status': 'failed'
            })
        }
    finally:
        if sid:
            cleanup_tempdir(sid)

def _extract_repo_metadata(clone_dir: str, repo_url: str) -> dict:
    """Extract metadata from the cloned repository."""
    metadata = {
        "repository_url": repo_url,
        "readme_found": False,
        "license_found": False,
        "package_managers": [],
        "framework_indicators": []
    }
    
    try:
        # Check for common files
        for root, dirs, files in os.walk(clone_dir):
            # Skip .git directory
            if '.git' in dirs:
                dirs.remove('.git')
                
            for file in files:
                file_lower = file.lower()
                
                # README detection
                if file_lower.startswith('readme'):
                    metadata["readme_found"] = True
                
                # License detection
                if file_lower in ['license', 'license.txt', 'license.md']:
                    metadata["license_found"] = True
                
                # Package managers
                if file in ['package.json']:
                    metadata["package_managers"].append('npm')
                elif file in ['requirements.txt', 'setup.py', 'pyproject.toml']:
                    metadata["package_managers"].append('pip')
                elif file in ['Gemfile']:
                    metadata["package_managers"].append('gem')
                elif file in ['composer.json']:
                    metadata["package_managers"].append('composer')
                
                # Framework indicators
                if file == 'next.config.js':
                    metadata["framework_indicators"].append('Next.js')
                elif file == 'angular.json':
                    metadata["framework_indicators"].append('Angular')
                elif file == 'vue.config.js':
                    metadata["framework_indicators"].append('Vue.js')
                elif file == 'manage.py':
                    metadata["framework_indicators"].append('Django')
                elif file == 'app.py' or file == 'wsgi.py':
                    metadata["framework_indicators"].append('Flask')
            
            # Only check root directory for most indicators
            break
            
    except Exception as e:
        logger.warning(f"Failed to extract repo metadata: {e}")
    
    # Remove duplicates
    metadata["package_managers"] = list(set(metadata["package_managers"]))
    metadata["framework_indicators"] = list(set(metadata["framework_indicators"]))
    
    return metadata

def _detect_languages(dep_graph: dict) -> list:
    """Detect programming languages from file extensions."""
    extensions = set()
    for file_path in dep_graph.keys():
        ext = os.path.splitext(file_path)[1].lower()
        if ext:
            extensions.add(ext)
    
    language_map = {
        '.py': 'Python',
        '.js': 'JavaScript',
        '.ts': 'TypeScript',
        '.tsx': 'TypeScript',
        '.jsx': 'JavaScript',
        '.java': 'Java',
        '.cpp': 'C++',
        '.c': 'C',
        '.cs': 'C#',
        '.rb': 'Ruby',
        '.php': 'PHP',
        '.go': 'Go',
        '.rs': 'Rust',
        '.swift': 'Swift',
        '.kt': 'Kotlin',
        '.scala': 'Scala',
        '.html': 'HTML',
        '.css': 'CSS',
        '.scss': 'SCSS',
        '.less': 'LESS'
    }
    
    languages = []
    for ext in extensions:
        if ext in language_map:
            languages.append(language_map[ext])
    
    return sorted(list(set(languages)))
