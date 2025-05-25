import tempfile, os, json, shutil
from werkzeug.wrappers import Request, Response
from werkzeug.utils import secure_filename
import cgi
from llm_index.analysis import analyze_project
from llm_index.reporting import generate_report
from llm_index.clustering import cluster_files
from llm_index.security import scan_for_malware, validate_archive_extension
from llm_index.utils import unique_tempdir, cleanup_tempdir

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
        
        # Extract and analyze
        shutil.unpack_archive(zip_path, tempdir)
        scan_for_malware(tempdir)
        dep_graph = analyze_project(tempdir)
        clusters = cluster_files(dep_graph)
        report = generate_report(dep_graph, clusters)
        
        # Send response
        response_data = {
            "dep_graph": dep_graph,
            "clusters": clusters,
            "report": report
        }
        
        response.status_code = 200
        response.headers['Content-Type'] = 'application/json'
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.data = json.dumps(response_data)
        return response
        
    except Exception as e:
        response.status_code = 500
        response.headers['Content-Type'] = 'application/json'
        response.data = json.dumps({'error': str(e)})
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
