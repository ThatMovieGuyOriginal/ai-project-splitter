import tempfile, os, json, shutil, subprocess
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse
from llm_index.analysis import analyze_project
from llm_index.clustering import cluster_files
from llm_index.reporting import generate_report
from llm_index.security import scan_for_malware, validate_github_url
from llm_index.utils import unique_tempdir, cleanup_tempdir

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        tempdir, sid = None, None
        try:
            # Parse query parameters
            parsed_url = urlparse(self.path)
            query_params = parse_qs(parsed_url.query)
            
            repo_url = query_params.get('repo', [None])[0]
            branch = query_params.get('branch', ['main'])[0]
            
            if not repo_url:
                self.send_error(400, 'Missing repo parameter')
                return
                
            validate_github_url(repo_url)
            tempdir, sid = unique_tempdir()
            
            # Clone repository
            clone_dir = os.path.join(tempdir, 'repo')
            subprocess.run([
                "git", "clone", "--depth", "1", "--branch", branch, 
                repo_url, clone_dir
            ], check=True)
            
            scan_for_malware(clone_dir)
            dep_graph = analyze_project(clone_dir)
            clusters = cluster_files(dep_graph)
            report = generate_report(dep_graph, clusters)
            
            response_data = {
                "dep_graph": dep_graph,
                "clusters": clusters,
                "report": report
            }
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
        finally:
            if sid:
                cleanup_tempdir(sid)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
