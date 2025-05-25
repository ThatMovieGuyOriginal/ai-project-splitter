import tempfile, os, json, shutil
from llm_index.analysis import analyze_project
from llm_index.clustering import cluster_files
from llm_index.refactor import dry_run_refactor, perform_refactor
from llm_index.backup import create_backup, restore_backup
from llm_index.security import scan_for_malware, validate_archive_extension
from llm_index.utils import unique_tempdir, cleanup_tempdir

def handler(request, response):
    tempdir, sid = unique_tempdir()
    try:
        file = request.files.get("file")
        accept = request.form.get("accept") == "true"
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
        plan = dry_run_refactor(clusters, tempdir)
        if not accept:
            response.headers["Content-Type"] = "application/json"
            response.body = json.dumps({"refactor_plan": plan}).encode()
            return response
        backup_dir = create_backup(tempdir)
        try:
            perform_refactor(clusters, tempdir)
            # Zip and send refactored project
            zip_refactored = os.path.join(tempdir, "refactored.zip")
            shutil.make_archive(zip_refactored.replace('.zip', ''), 'zip', tempdir)
            with open(zip_refactored, 'rb') as f:
                refactored_bytes = f.read()
            response.headers["Content-Type"] = "application/zip"
            response.body = refactored_bytes
            return response
        except Exception as err:
            restore_backup(backup_dir, tempdir)
            response.status_code = 500
            response.body = f"Refactor failed: {err}".encode()
            return response
    except Exception as e:
        response.status_code = 500
        response.body = str(e).encode()
        return response
    finally:
        cleanup_tempdir(sid)
