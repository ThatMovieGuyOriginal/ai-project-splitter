import tempfile, os, json, shutil
import cgi, io
from llm_index.analysis import analyze_project_enhanced
from llm_index.clustering import cluster_files
from llm_index.refactor import dry_run_refactor, perform_refactor
from llm_index.backup import create_backup, restore_backup
from llm_index.security import scan_for_malware, validate_archive_extension
from llm_index.utils import unique_tempdir, cleanup_tempdir
import logging

logger = logging.getLogger('llm-index.api.refactor')

def handler(request):
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    }
    
    if request.method == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': ''}
    
    if request.method != 'POST':
        return {
            'statusCode': 405,
            'headers': headers,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    tempdir, sid = None, None
    try:
        # Parse multipart form data
        content_type = request.headers.get('content-type', '')
        if not content_type.startswith('multipart/form-data'):
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Content-Type must be multipart/form-data'})
            }

        # Parse form data
        form_data = cgi.FieldStorage(
            fp=io.StringIO(request.body.decode()) if isinstance(request.body, bytes) else io.StringIO(request.body),
            environ={
                'REQUEST_METHOD': 'POST',
                'CONTENT_TYPE': content_type,
                'CONTENT_LENGTH': str(len(request.body))
            }
        )

        if 'file' not in form_data or not form_data['file'].filename:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'No file uploaded'})
            }

        file_item = form_data['file']
        
        # Check if accepting changes
        accept = form_data.get('accept', None)
        accept_changes = accept and accept.value == "true"

        tempdir, sid = unique_tempdir()
        validate_archive_extension(file_item.filename)
        
        # Save uploaded file
        zip_path = os.path.join(tempdir, "project.zip")
        with open(zip_path, 'wb') as f:
            if hasattr(file_item, 'file'):
                shutil.copyfileobj(file_item.file, f)
            else:
                f.write(file_item.value)
        
        # Extract and analyze with enhancements
        shutil.unpack_archive(zip_path, tempdir)
        scan_for_malware(tempdir)
        
        logger.info("Starting enhanced refactoring analysis")
        
        analysis_result = analyze_project_enhanced(tempdir)
        dep_graph = analysis_result['dep_graph']
        complexity_scores = analysis_result['complexity_scores']
        debt_analysis = analysis_result['debt_analysis']
        
        clusters = cluster_files(dep_graph, complexity_scores=complexity_scores)
        
        # Generate enhanced refactoring plan
        plan = _generate_enhanced_refactor_plan(clusters, tempdir, complexity_scores, debt_analysis)
        
        if not accept_changes:
            # Return enhanced dry run plan
            response_data = {
                "refactor_plan": plan,
                "analysis_summary": {
                    "total_files": len(dep_graph),
                    "total_clusters": len(clusters),
                    "complexity_distribution": _analyze_complexity_distribution(complexity_scores),
                    "debt_summary": debt_analysis.get('summary', {}),
                    "refactor_impact": _calculate_refactor_impact(plan, complexity_scores)
                },
                "recommendations": _generate_refactor_recommendations(clusters, complexity_scores, debt_analysis),
                "enhancement_status": "dry_run_complete"
            }
            
            logger.info(f"Enhanced dry run complete: {len(plan)} refactor operations planned")
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(response_data)
            }

        # Perform actual refactor with enhanced backup
        backup_dir = create_backup(tempdir)
        try:
            logger.info("Performing enhanced refactoring")
            
            # Enhanced refactoring with complexity-aware organization
            _perform_enhanced_refactor(clusters, tempdir, complexity_scores)
            
            # Create zip of refactored project
            zip_refactored = os.path.join(tempdir, "refactored.zip")
            shutil.make_archive(zip_refactored.replace('.zip', ''), 'zip', tempdir)
            
            with open(zip_refactored, 'rb') as f:
                refactored_bytes = f.read()
            
            logger.info("Enhanced refactoring completed successfully")
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/zip',
                    'Content-Disposition': 'attachment; filename="refactored_enhanced.zip"',
                    'Access-Control-Allow-Origin': '*',
                    'X-Enhancement-Status': 'refactor_complete'
                },
                'body': refactored_bytes,
                'isBase64Encoded': True
            }
            
        except Exception as err:
            logger.error(f"Enhanced refactoring failed: {err}")
            restore_backup(backup_dir, tempdir)
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({
                    'error': f"Enhanced refactor failed: {err}",
                    'enhancement_status': 'refactor_failed',
                    'backup_restored': True
                })
            }
        
    except Exception as e:
        logger.error(f"Enhanced refactor API failed: {e}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': str(e),
                'enhancement_status': 'api_failed'
            })
        }
    finally:
        if sid:
            cleanup_tempdir(sid)

def _generate_enhanced_refactor_plan(clusters, root_dir, complexity_scores, debt_analysis):
    """Generate enhanced refactor plan with complexity and debt awareness."""
    plan = []
    
    # Sort clusters by complexity and debt for optimal organization
    cluster_priorities = []
    for idx, cluster in enumerate(clusters):
        avg_complexity = sum(complexity_scores.get(f, 0) for f in cluster) / len(cluster) if cluster else 0
        debt_count = sum(1 for item in debt_analysis.get('debt_items', []) if item.get('file_path') in cluster)
        priority = avg_complexity + (debt_count * 5)  # Weight debt items more heavily
        cluster_priorities.append((idx, cluster, priority, avg_complexity, debt_count))
    
    # Sort by priority (highest first for core modules)
    cluster_priorities.sort(key=lambda x: x[2], reverse=True)
    
    for idx, (original_idx, cluster, priority, avg_complexity, debt_count) in enumerate(cluster_priorities):
        # Create intelligently named directories based on content and complexity
        if avg_complexity > 70:
            target_dir = os.path.join(root_dir, f"core_complex_{idx+1}")
        elif avg_complexity > 40:
            target_dir = os.path.join(root_dir, f"module_standard_{idx+1}")
        else:
            target_dir = os.path.join(root_dir, f"support_simple_{idx+1}")
        
        for file in cluster:
            plan.append({
                "from": file,
                "to": os.path.join(target_dir, os.path.basename(file)),
                "cluster_id": original_idx,
                "complexity_score": complexity_scores.get(file, 0),
                "debt_items": debt_count,
                "priority": priority,
                "directory_type": target_dir.split('/')[-1]
            })
    
    return plan

def _analyze_complexity_distribution(complexity_scores):
    """Analyze the distribution of complexity scores."""
    if not complexity_scores:
        return {"low": 0, "medium": 0, "high": 0}
    
    scores = list(complexity_scores.values())
    return {
        "low": len([s for s in scores if s < 30]),
        "medium": len([s for s in scores if 30 <= s < 70]),
        "high": len([s for s in scores if s >= 70]),
        "average": round(sum(scores) / len(scores), 2),
        "max": max(scores),
        "min": min(scores)
    }

def _calculate_refactor_impact(plan, complexity_scores):
    """Calculate the expected impact of the refactoring."""
    if not plan:
        return {}
    
    files_moved = len(plan)
    avg_complexity = sum(item.get('complexity_score', 0) for item in plan) / files_moved if files_moved > 0 else 0
    high_complexity_files = len([item for item in plan if item.get('complexity_score', 0) > 70])
    
    return {
        "files_to_move": files_moved,
        "directories_to_create": len(set(os.path.dirname(item['to']) for item in plan)),
        "average_file_complexity": round(avg_complexity, 2),
        "high_complexity_files": high_complexity_files,
        "estimated_improvement": "High" if high_complexity_files > 0 else "Medium"
    }

def _generate_refactor_recommendations(clusters, complexity_scores, debt_analysis):
    """Generate intelligent refactoring recommendations."""
    recommendations = []
    
    # Analyze cluster quality
    if len(clusters) > 10:
        recommendations.append("Consider consolidating some clusters - too many small modules can hurt maintainability")
    elif len(clusters) < 3:
        recommendations.append("Consider breaking large clusters into smaller, focused modules")
    
    # Complexity-based recommendations
    if complexity_scores:
        high_complexity_files = [f for f, score in complexity_scores.items() if score > 70]
        if high_complexity_files:
            recommendations.append(f"Priority refactoring needed for {len(high_complexity_files)} high-complexity files")
    
    # Debt-based recommendations
    debt_summary = debt_analysis.get('summary', {})
    critical_issues = debt_summary.get('critical_issues', 0)
    if critical_issues > 0:
        recommendations.append(f"Address {critical_issues} critical technical debt issues before refactoring")
    
    health_grade = debt_summary.get('overall_health_grade', 'N/A')
    if health_grade in ['D', 'F']:
        recommendations.append("Consider comprehensive code cleanup before structural refactoring")
    
    return recommendations

def _perform_enhanced_refactor(clusters, root_dir, complexity_scores):
    """Perform enhanced refactoring with complexity-aware organization."""
    
    # Create directories based on complexity analysis
    for idx, cluster in enumerate(clusters):
        if not cluster:
            continue
            
        avg_complexity = sum(complexity_scores.get(f, 0) for f in cluster) / len(cluster)
        
        # Intelligent directory naming
        if avg_complexity > 70:
            target_dir = os.path.join(root_dir, f"core_complex_{idx+1}")
        elif avg_complexity > 40:
            target_dir = os.path.join(root_dir, f"module_standard_{idx+1}")
        else:
            target_dir = os.path.join(root_dir, f"support_simple_{idx+1}")
        
        os.makedirs(target_dir, exist_ok=True)
        
        # Create a complexity summary file in each directory
        summary_path = os.path.join(target_dir, "_module_info.md")
        with open(summary_path, 'w') as f:
            f.write(f"# Module Information\n\n")
            f.write(f"**Average Complexity:** {avg_complexity:.2f}\n")
            f.write(f"**Files:** {len(cluster)}\n")
            f.write(f"**Module Type:** {'Core Complex' if avg_complexity > 70 else 'Standard' if avg_complexity > 40 else 'Support'}\n\n")
            f.write("## Files in this module:\n")
            for file in cluster:
                complexity = complexity_scores.get(file, 0)
                f.write(f"- {os.path.basename(file)} (complexity: {complexity:.1f})\n")
        
        # Move files
        for file in cluster:
            try:
                dest_path = os.path.join(target_dir, os.path.basename(file))
                if os.path.exists(file):
                    shutil.move(file, dest_path)
            except Exception as e:
                logger.warning(f"Failed to move {file}: {e}")
