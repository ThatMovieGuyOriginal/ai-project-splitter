import tempfile, os, shutil
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
        response.body = b'Scan OK'
        return response
    except Exception as e:
        response.status_code = 500
        response.body = str(e).encode()
        return response
    finally:
        cleanup_tempdir(sid)
