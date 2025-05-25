import tempfile, os, shutil
from http.server import BaseHTTPRequestHandler
import cgi
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

            tempdir, sid = unique_tempdir()
            validate_archive_extension(file_item.filename)
            
            # Save uploaded file
            zip_path = os.path.join(tempdir, "project.zip")
            with open(zip_path, 'wb') as f:
                f.write(file_item.file.read())
            
            # Extract and scan
            shutil.unpack_archive(zip_path, tempdir)
            scan_for_malware(tempdir)
            
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'Scan OK')
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(str(e).encode())
        finally:
            if sid:
                cleanup_tempdir(sid)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
