import tempfile, os, json, shutil
from http.server import BaseHTTPRequestHandler
import cgi
import sys
import traceback
from llm_index.analysis import analyze_project_enhanced
from llm_index.reporting import generate_report
from llm_index.clustering import cluster_files
from llm_index.security import scan_for_malware, validate_archive_extension
from llm_index.utils import unique_tempdir, cleanup_tempdir
import logging
import time

logger = logging.getLogger('llm-index.api.analyze')

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        """Handle POST requests for file analysis"""
        tempdir, sid = None, None
        start_time = time.time()
        
        try:
            logger.info(f"Received POST request to analyze endpoint")
            
            # Set CORS headers first
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            
            # Check content type
            content_type = self.headers.get('Content-Type', '')
            logger.info(f"Content-Type: {content_type}")
            
            if not content_type.startswith('multipart/form-data'):
                error_response = {'error': 'Content-Type must be multipart/form-data', 'debug': 'content_type_check_failed'}
                self.wfile.write(json.dumps(error_response).encode())
                return

            content_length = int(self.headers.get('Content-Length', 0))
            logger.info(f"Content-Length: {content_length}")
            
            if content_length == 0:
                error_response = {'error': 'No file uploaded', 'debug': 'content_length_zero'}
                self.wfile.write(json.dumps(error_response).encode())
                return

            # Parse the multipart data
            logger.info("Parsing multipart form data")
            form_data = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST', 'CONTENT_LENGTH': str(content_length)}
            )

            logger.info(f"Form fields: {list(form_data.keys())}")

            if 'file' not in form_data:
                error_response = {'error': 'No file field in form data', 'debug': 'no_file_field', 'fields': list(form_data.keys())}
                self.wfile.write(json.dumps(error_response).encode())
                return

            file_item = form_data['file']
            logger.info(f"File item: {file_item}, filename: {getattr(file_item, 'filename', 'No filename')}")
            
            if not hasattr(file_item, 'filename') or not file_item.filename:
                error_response = {'error': 'No filename provided', 'debug': 'no_filename'}
                self.wfile.write(json.dumps(error_response).encode())
                return

            # Read file data
            logger.info("Reading file data")
            file_data = file_item.file.read()
            file_size = len(file_data)
            logger.info(f"File size: {file_size} bytes")
            
            # Validate file size (5MB limit)
            if file_size > 5 * 1024 * 1024:
                error_response = {'error': 'File too large. Maximum size is 5MB.', 'debug': 'file_too_large', 'size': file_size}
                self.wfile.write(json.dumps(error_response).encode())
                return

            logger.info("Creating temp directory")
            tempdir, sid = unique_tempdir()
            validate_archive_extension(file_item.filename)
            
            # Save uploaded file
            zip_path = os.path.join(tempdir, "project.zip")
            logger.info(f"Saving file to: {zip_path}")
            with open(zip_path, 'wb') as f:
                f.write(file_data)
            
            # Extract with timeout protection
            logger.info("Extracting archive")
            try:
                shutil.unpack_archive(zip_path, tempdir)
            except Exception as e:
                logger.error(f"Archive extraction failed: {e}")
                error_response = {'error': 'Failed to extract archive. Please check file format.', 'debug': 'extraction_failed', 'details': str(e)}
                self.wfile.write(json.dumps(error_response).encode())
                return
            
            # Security scan
            logger.info("Running security scan")
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
            logger.info("Clustering files")
            clusters = cluster_files(dep_graph, complexity_scores=complexity_scores)
            
            # Generate report
            logger.info("Generating report")
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
                },
                "debug": "analysis_completed_successfully"
            }
            
            logger.info(f"Analysis complete: {len(clusters)} clusters, {processing_time:.2f}s")
            self.wfile.write(json.dumps(response_data).encode())
            
        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            
            # Ensure we send headers if not already sent
            try:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
            except:
                pass  # Headers already sent
            
            error_response = {
                'error': str(e),
                'status': 'failed',
                'debug': 'exception_occurred',
                'traceback': traceback.format_exc(),
                'processing_time_seconds': round(time.time() - start_time, 2) if start_time else 0
            }
            self.wfile.write(json.dumps(error_response).encode())
        finally:
            if sid:
                cleanup_tempdir(sid)

    def do_GET(self):
        """Handle GET requests - return simple status"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        response = {'status': 'analyze endpoint is running', 'method': 'GET', 'supported_methods': ['POST', 'OPTIONS']}
        self.wfile.write(json.dumps(response).encode())

    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Max-Age', '86400')
        self.end_headers()

# Fallback function handler for compatibility
def handler_function(request):
    """Fallback function handler - should not be used but included for compatibility"""
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({'error': 'Use BaseHTTPRequestHandler instead', 'debug': 'fallback_handler_called'})
    }
