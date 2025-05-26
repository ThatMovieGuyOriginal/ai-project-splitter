# api/analyze.py
#
# Vercel Python Serverless Function for POST /api/analyze
# -------------------------------------------------------
# Uses http.server.BaseHTTPRequestHandler because the Vercel
# runtime looks for that class name (`handler`).  Accepts a ZIP
# upload (≤ 5 MB), runs the LLM‑Index analysis pipeline, and
# returns a JSON report.

from http.server import BaseHTTPRequestHandler
import json
import os
import shutil
import time
import cgi
import logging

from llm_index.analysis import analyze_project_enhanced, analyze_project
from llm_index.reporting import generate_report
from llm_index.clustering import cluster_files
from llm_index.security import scan_for_malware, validate_archive_extension
from llm_index.utils import unique_tempdir, cleanup_tempdir

logger = logging.getLogger("llm-index.api.analyze")

MAX_FILE_SIZE = 5 * 1024 * 1024          # 5 MB
TIMEOUT_SECONDS = 8                      # hard stop after 8 s


class handler(BaseHTTPRequestHandler):   # noqa: N801  (required name for Vercel)
    """Entrypoint for the /api/analyze route."""

    # ------------- internal helpers -----------------

    def _send_json(self, status_code: int, payload, extra_headers=None) -> None:
        """Send a JSON HTTP response with common CORS headers."""
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        if extra_headers:
            for key, value in extra_headers.items():
                self.send_header(key, value)
        self.end_headers()
        if payload != "":
            self.wfile.write(json.dumps(payload).encode())

    # ------------- CORS pre‑flight ------------------

    def do_OPTIONS(self):  # noqa: N802
        self._send_json(
            200,
            "",
            {
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        )

    # ------------- main POST handler ----------------

    def do_POST(self):  # noqa: N802
        start_time = time.time()

        # Parse multipart/form‑data
        ctype, pdict = cgi.parse_header(self.headers.get("Content-Type"))
        if ctype != "multipart/form-data":
            return self._send_json(400, {"error": "Expected multipart/form‑data"})

        pdict["boundary"] = bytes(pdict["boundary"], "utf-8")
        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={"REQUEST_METHOD": "POST"},
            keep_blank_values=True,
        )

        if "file" not in form or not form["file"].filename:
            return self._send_json(400, {"error": "No file uploaded"})

        file_item = form["file"]

        # Size check
        file_item.file.seek(0, os.SEEK_END)
        file_size = file_item.file.tell()
        file_item.file.seek(0)
        if file_size > MAX_FILE_SIZE:
            return self._send_json(
                413, {"error": "File too large. Maximum size is 5 MB."}
            )

        # Create isolated temp directory
        tempdir, sid = unique_tempdir()

        try:
            validate_archive_extension(file_item.filename)

            # Persist upload
            zip_path = os.path.join(tempdir, "project.zip")
            with open(zip_path, "wb") as f:
                shutil.copyfileobj(file_item.file, f)

            # Extract archive
            try:
                shutil.unpack_archive(zip_path, tempdir)
            except Exception as e:
                logger.error("Archive extraction failed: %s", e)
                return self._send_json(
                    400,
                    {"error": "Failed to extract archive. Please check file format."},
                )

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
            report = generate_report(
                dep_graph, clusters, complexity_scores, debt_analysis
            )

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
                    "file_size_bytes": file_size,
                    "avg_complexity": round(
                        sum(complexity_scores.values()) / len(complexity_scores), 2
                    )
                    if complexity_scores
                    else 0,
                    "debt_items": debt_analysis.get("summary", {}).get(
                        "total_debt_items", 0
                    )
                    if isinstance(debt_analysis, dict)
                    else 0,
                },
            }

            logger.info(
                "Analysis complete: %d clusters, %.2fs",
                len(clusters),
                processing_time,
            )
            return self._send_json(200, response_data)

        except TimeoutError:
            return self._send_json(
                408,
                {"error": "Analysis timeout. Please try a smaller project.", "status": "timeout"},
            )

        except Exception as e:
            logger.exception("Analysis failed")
            return self._send_json(500, {"error": str(e), "status": "failed"})

        finally:
            if sid:
                cleanup_tempdir(sid)
