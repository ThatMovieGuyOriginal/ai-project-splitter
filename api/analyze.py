import tempfile, os, json, shutil
from werkzeug.wrappers import Request, Response
from werkzeug.utils import secure_filename
import cgi
from llm_index.analysis import analyze_project_enhanced
from llm_index.reporting import generate_report
from llm_index.clustering import cluster_files
from llm_index.security import scan_for_malware, validate_archive_extension
from llm_index.utils import unique_tempdir, cleanup_tempdir
import logging

logger = logging.getLogger('llm-index.api.analyze')

def handler(request, response):
    if request.method == 'OPTIONS':
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return response
    
    if request.method != 'POST':
        response.status_code = 405
        return response
    
    tempdir, sid = None, None
    try:
        # Check content type
        content_type = request.headers.get('Content-Type', '')
        if not content_type.startswith('multipart/form-data'):
            response.status_code = 400
            response.data = json.dumps({'error': 'Content-Type must be multipart/form-data'})
            return response

        # Get uploaded file
        files = request.files.getlist('file')
        if not files or not files[0]:
            response.status_code = 400
            response.data = json.dumps({'error': 'No file uploaded'})
            return response

        file_item = files[0]
        if not file_item.filename:
            response.status_code = 400
            response.data = json.dumps({'error': 'No file uploaded'})
            return response

        tempdir, sid = unique_tempdir()
        validate_archive_extension(file_item.filename)
        
        # Save uploaded file
        zip_path = os.path.join(tempdir, "project.zip")
        file_item.save(zip_path)
        
        # Extract and analyze with enhanced features
        shutil.unpack_archive(zip_path, tempdir)
        scan_for_malware(tempdir)
        
        logger.info("Starting enhanced project analysis")
        
        # Use enhanced analysis
        analysis_result = analyze_project_enhanced(tempdir)
        dep_graph = analysis_result['dep_graph']
        complexity_scores = analysis_result['complexity_scores']
        debt_analysis = analysis_result['debt_analysis']
        
        # Enhanced clustering with complexity scores
        clusters = cluster_files(dep_graph, complexity_scores=complexity_scores)
        
        # Enhanced reporting
        report = generate_report(dep_graph, clusters, complexity_scores, debt_analysis)
        
        # Send comprehensive response
        response_data = {
            "dep_graph": dep_graph,
            "clusters": clusters,
            "report": report,
            "complexity_scores": complexity_scores,
            "debt_analysis": debt_analysis,
            "enhancement_status": "success",
            "metadata": {
                "total_files": len(dep_graph),
                "total_clusters": len(clusters),
                "avg_complexity": round(sum(complexity_scores.values()) / len(complexity_scores), 2) if complexity_scores else 0,
                "debt_items": debt_analysis.get('summary', {}).get('total_debt_items', 0)
            }
        }
        
        logger.info(f"Enhanced analysis complete: {len(clusters)} clusters, {len(complexity_scores)} complexity scores")
        
        response.status_code = 200
        response.headers['Content-Type'] = 'application/json'
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.data = json.dumps(response_data)
        return response
        
    except Exception as e:
        logger.error(f"Enhanced analysis failed: {e}")
        response.status_code = 500
        response.headers['Content-Type'] = 'application/json'
        response.data = json.dumps({
            'error': str(e),
            'enhancement_status': 'failed',
            'fallback_available': True
        })
        return response
    finally:
        if sid:
            cleanup_tempdir(sid)

# Vercel Python runtime handler
def main(request):
    from werkzeug.wrappers import Request, Response
    req = Request(request.environ)
    resp = Response()
    return handler(req, resp)
