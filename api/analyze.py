import tempfile, os, json, shutil
from llm_index.analysis import analyze_project_enhanced
from llm_index.reporting import generate_report
from llm_index.clustering import cluster_files
from llm_index.security import scan_for_malware, validate_archive_extension
from llm_index.utils import unique_tempdir, cleanup_tempdir
import logging
import time

logger = logging.getLogger('llm-index.api.analyze')

def handler(request):
    if request.method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            }
        }
    
    if request.method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    tempdir, sid = None, None
    start_time = time.time()
    
    try:
        # Get uploaded file from form data
        files = request.files.getlist('file') if hasattr(request, 'files') else []
        if not files or not files[0]:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'No file uploaded'})
            }

        file_item = files[0]
        if not file_item.filename:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'No file uploaded'})
            }

        # Validate file size (5MB limit)
        file_item.seek(0, 2)
        file_size = file_item.tell()
        file_item.seek(0)
        
        if file_size > 5 * 1024 * 1024:
            return {
                'statusCode': 413,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'File too large. Maximum size is 5MB.'})
            }

        tempdir, sid = unique_tempdir()
        validate_archive_extension(file_item.filename)
        
        # Save uploaded file
        zip_path = os.path.join(tempdir, "project.zip")
        file_item.save(zip_path)
        
        # Extract with timeout protection
        try:
            shutil.unpack_archive(zip_path, tempdir)
        except Exception as e:
            logger.error(f"Archive extraction failed: {e}")
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Failed to extract archive. Please check file format.'})
            }
        
        # Security scan
        scan_for_malware(tempdir)
        
        logger.info("Starting enhanced project analysis")
        
        # Check execution time to avoid timeout
        if time.time() - start_time > 8:
            raise TimeoutError("Analysis taking too long")
        
        # Use enhanced analysis with fallback
        try:
            analysis_result = analyze_project_enhanced(tempdir)
            dep_graph = analysis_result['dep_graph']
            complexity_scores = analysis_result.get('complexity_scores', {})
            debt_analysis = analysis_result.get('debt_analysis', {})
        except Exception as e:
            logger.warning(f"Enhanced analysis failed, using basic analysis: {e}")
            from llm_index.analysis import analyze_project
            dep_graph = analyze_project(tempdir)
            complexity_scores = {}
            debt_analysis = {}
        
        # Enhanced clustering
        clusters = cluster_files(dep_graph, complexity_scores=complexity_scores)
        
        # Generate report
        report = generate_report(dep_graph, clusters, complexity_scores, debt_analysis)
        
        # Calculate processing time
        processing_time = time.time() - start_time
        
        # Send comprehensive response
        response_data = {
            "dep_graph": dep_graph,
            "clusters": clusters,
            "report": report,
            "complexity_scores": complexity_scores,
            "debt_analysis": debt_analysis,
            "status": "success",
            "metadata": {
                "total_files": len(dep_graph),
                "total_clusters": len(clusters),
                "processing_time_seconds": round(processing_time, 2),
                "file_size_bytes": file_size,
                "avg_complexity": round(sum(complexity_scores.values()) / len(complexity_scores), 2) if complexity_scores else 0,
                "debt_items": debt_analysis.get('summary', {}).get('total_debt_items', 0) if isinstance(debt_analysis, dict) else 0
            }
        }
        
        logger.info(f"Analysis complete: {len(clusters)} clusters, {processing_time:.2f}s")
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(response_data)
        }
        
    except TimeoutError:
        logger.error("Analysis timeout")
        return {
            'statusCode': 408,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'error': 'Analysis timeout. Please try a smaller project or contact support.',
                'status': 'timeout'
            })
        }
    except MemoryError:
        logger.error("Analysis out of memory")
        return {
            'statusCode': 413,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'error': 'Project too large to analyze. Please try a smaller subset.',
                'status': 'memory_limit'
            })
        }
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'error': str(e),
                'status': 'failed',
                'processing_time_seconds': round(time.time() - start_time, 2) if start_time else 0
            })
        }
    finally:
        if sid:
            cleanup_tempdir(sid)
