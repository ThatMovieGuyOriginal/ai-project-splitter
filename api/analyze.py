# api/analyze.py
import json
import os
import shutil
import time
import logging
from urllib.parse import parse_qs

from llm_index.analysis import analyze_project_enhanced, analyze_project
from llm_index.reporting import generate_report
from llm_index.clustering import cluster_files
from llm_index.security import scan_for_malware, validate_archive_extension
from llm_index.utils import unique_tempdir, cleanup_tempdir

logger = logging.getLogger("llm-index.api.analyze")

MAX_FILE_SIZE = 5 * 1024 * 1024          # 5 MB
TIMEOUT_SECONDS = 8                      # hard stop after 8 s

def handler(request):
    """Vercel serverless function handler for /api/analyze"""
    
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            'body': ''
        }
    
    if request.method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    start_time = time.time()
    tempdir, sid = None, None
    
    try:
        # Parse multipart form data
        if not hasattr(request, 'files') or 'file' not in request.files:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'No file uploaded'})
            }
        
        file_item = request.files['file']
        
        # Size check
        if len(file_item.read()) > MAX_FILE_SIZE:
            return {
                'statusCode': 413,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'File too large. Maximum size is 5 MB.'})
            }
        
        file_item.seek(0)  # Reset file pointer
        
        # Create isolated temp directory
        tempdir, sid = unique_tempdir()
        
        validate_archive_extension(file_item.filename)
        
        # Persist upload
        zip_path = os.path.join(tempdir, "project.zip")
        with open(zip_path, "wb") as f:
            shutil.copyfileobj(file_item, f)
        
        # Extract archive
        try:
            shutil.unpack_archive(zip_path, tempdir)
        except Exception as e:
            logger.error("Archive extraction failed: %s", e)
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Failed to extract archive. Please check file format.'})
            }
        
        # Security scan
        scan_for_malware(tempdir)
        
        # Simple timeout guard
        if time.time() - start_time > TIMEOUT_SECONDS:
            raise TimeoutError("Analysis taking too long")
        
        # Run analysis (enhanced with graceful fallback)
        try:
            analysis_result = analyze_project_enhanced(tempdir)
            dep_graph = analysis_result["dep_graph"]
            complexity_scores = analysis_result.get("complexity_scores", {})
            debt_analysis = analysis_result.get("debt_analysis", {})
        except Exception as e:
            logger.warning("Enhanced analysis failed, falling back: %s", e)
            dep_graph = analyze_project(tempdir)
            complexity_scores = {}
            debt_analysis = {}
        
        # Clustering and report
        clusters = cluster_files(dep_graph, complexity_scores=complexity_scores)
        report = generate_report(dep_graph, clusters, complexity_scores, debt_analysis)
        
        processing_time = time.time() - start_time
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
                "file_size_bytes": len(file_item.read()),
                "avg_complexity": round(
                    sum(complexity_scores.values()) / len(complexity_scores), 2
                ) if complexity_scores else 0,
                "debt_items": debt_analysis.get("summary", {}).get("total_debt_items", 0)
                if isinstance(debt_analysis, dict) else 0,
            },
        }
        
        logger.info("Analysis complete: %d clusters, %.2fs", len(clusters), processing_time)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(response_data)
        }
        
    except TimeoutError:
        return {
            'statusCode': 408,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'error': 'Analysis timeout. Please try a smaller project.',
                'status': 'timeout'
            })
        }
    except Exception as e:
        logger.exception("Analysis failed")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e), 'status': 'failed'})
        }
    finally:
        if sid:
            cleanup_tempdir(sid)
