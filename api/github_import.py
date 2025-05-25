import tempfile, os, json, shutil, subprocess
from llm_index.analysis import analyze_project
from llm_index.clustering import cluster_files
from llm_index.reporting import generate_report
from llm_index.security import scan_for_malware, validate_github_url
from llm_index.utils import unique_tempdir, cleanup_tempdir

def handler(request, response):
    tempdir, sid = unique_tempdir()
    try:
        repo_url = request.args.get("repo")
        branch = request.args.get("branch") or "main"
        validate_github_url(repo_url)
        with tempfile.TemporaryDirectory() as tmpdir:
            subprocess.run(["git", "clone", "--depth", "1", "--branch", branch, repo_url, tmpdir], check=True)
            scan_for_malware(tmpdir)
            dep_graph = analyze_project(tmpdir)
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
