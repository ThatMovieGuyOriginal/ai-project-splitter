import tempfile, os, json, shutil
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs
import cgi
from llm_index.analysis import analyze_project
from llm_index.clustering import cluster_files
from llm_index.refactor import dry_run_refactor, perform_refactor
from llm_index.backup import create_backup, restore_backup
from llm_index.security import scan_for_malware, validate_archive_extension
from llm_index.utils import unique_tempdir, cleanup_tempdir

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        tempdir, sid = None, None
        try:
            # Parse multipart form data
            content_type = self.headers.get('Content-Type', '')
            if not content_type.startswith('multipart/form-data'):
                self.send_error(400, 'Content-Type must be multipart/form-data')
                return

            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_error(400, 'No file uploaded')
                return

            # Parse the multipart data
            form_data = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST'}
            )

            if 'file' not in form_data:
                self.send_error(400, 'No file uploaded')
                return

            file_item = form_data['file']
            if not file_item.filename:
                self.send_error(400, 'No file uploaded')
                return

            # Check if accepting changes
            accept = form_data.get('accept', None)
            accept_changes = accept and accept.value == "true"

            tempdir, sid = unique_tempdir()
            validate_archive_extension(file_item.filename)
            
            # Save uploaded file
            zip_path = os.path.join(tempdir, "project.zip")
            with open(zip_path, 'wb') as f:
                f.write(file_item.file.read())
            
            # Extract and analyze
            shutil.unpack_archive(zip_path, tempdir)
            scan_for_malware(tempdir)
            dep_graph = analyze_project(tempdir)
            clusters = cluster_files(dep_graph)
            plan = dry_run_refactor(clusters, tempdir)
            
            if not accept_changes:
                # Return dry run plan
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"refactor_plan": plan}).encode())
                return

            # Perform actual refactor
            backup_dir = create_backup(tempdir)
            try:
                perform_refactor(clusters, tempdir)
                
                # Create zip of refactored project
                zip_refactored = os.path.join(tempdir, "refactored.zip")
                shutil.make_archive(zip_refactored.replace('.zip', ''), 'zip', tempdir)
                
                with open(zip_refactored, 'rb') as f:
                    refactored_bytes = f.read()
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/zip')
                self.send_header('Content-Disposition', 'attachment; filename="refactored.zip"')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(refactored_bytes)
                
            except Exception as err:
                restore_backup(backup_dir, tempdir)
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': f"Refactor failed: {err}"}).encode())
            
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
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
