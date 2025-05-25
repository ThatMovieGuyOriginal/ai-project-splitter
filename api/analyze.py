import tempfile, os, json, shutil
from llm_index.analysis import analyze_project
from llm_index.reporting import generate_report
from llm_index.clustering import cluster_files
from llm_index.security import scan_for_malware, validate_archive_extension
from llm_index.utils import unique_tempdir, cleanup_tempdir

def handler(request, response):
    tempdir, sid = unique_tempdir()
    try:
        file = request.files.get("file")
        if not file:
            response.status_code = 400
            response.body = b'No file uploaded.'
            return response
        validate_archive_extension(file.filename)
        zip_path = os.path.join(tempdir, "project.zip")
        file.save(zip_path)
        shutil.unpack_archive(zip_path, tempdir)
        scan_for_malware(tempdir)
        dep_graph = analyze_project(tempdir)
        clusters = cluster_files(dep_graph)
        report = generate_report(dep_graph, clusters)
        response.headers["Content-Type"] = "application/json"
        response.body = json.dumps({
            "dep_graph": dep_graph,
            "clusters": clusters,
            "report": report
        }).encode()
        return response
    except Exception as e:
        response.status_code = 500
        response.body = str(e).encode()
        return response
    finally:
        cleanup_tempdir(sid)
