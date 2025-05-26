import tempfile, os, json, shutil
from http.server import BaseHTTPRequestHandler
import cgi
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
        tempdir, sid = None, None
        start_time = time.time()
        
        try:
            # Parse multipart form data
            content_type = self.headers.get('Content-Type', '')
            if not content_type.startswith('multipart/form-data'):
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Content-Type must be multipart/form-data'}).encode())
                return

            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'No file uploaded'}).encode())
                return

            # Parse the multipart data
            form_data = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={'REQUEST_METHOD': 'POST'}
            )

            if 'file' not in form_data:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'No file uploaded'}).encode())
                return

            file_item = form_data['file']
            if not file_item.filename:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'No file uploaded'}).encode())
                return

            # Get file size by reading the file data
            file_data = file_item.file.read()
            file_size = len(file_data)
            
            # Validate file size (5MB limit)
            if file_size > 5 * 1024 * 1024:
                self.send_response(413)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'File too large. Maximum size is 5MB.'}).encode())
                return

            tempdir, sid = unique_tempdir()
            validate_archive_extension(file_item.filename)
            
            # Save uploaded file
            zip_path = os.path.join(tempdir, "project.zip")
            with open(zip_path, 'wb') as f:
                f.write(file_data)
            
            # Extract with timeout protection
            try:
                shutil.unpack_archive(zip_path, tempdir)
            except Exception as e:
                logger.error(f"Archive extraction failed: {e}")
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Failed to extract archive. Please check file format.'}).encode())
                return
            
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
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode())
            
        except TimeoutError:
            logger.error("Analysis timeout")
            self.send_response(408)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'error': 'Analysis timeout. Please try a smaller project or contact support.',
                'status': 'timeout'
            }).encode())
        except MemoryError:
            logger.error("Analysis out of memory")
            self.send_response(413)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'error': 'Project too large to analyze. Please try a smaller subset.',
                'status': 'memory_limit'
            }).encode())
        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({
                'error': str(e),
                'status': 'failed',
                'processing_time_seconds': round(time.time() - start_time, 2) if start_time else 0
            }).encode())
        finally:
            if sid:
                cleanup_tempdir(sid)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
