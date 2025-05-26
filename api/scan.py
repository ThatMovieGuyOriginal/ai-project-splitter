import tempfile, os, shutil
import cgi, io
from llm_index.security import scan_for_malware, validate_archive_extension
from llm_index.utils import unique_tempdir, cleanup_tempdir

def handler(request):
    headers = {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    }
    
    if request.method == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': ''}
    
    if request.method != 'POST':
        return {
            'statusCode': 405, 
            'headers': headers,
            'body': 'Method not allowed'
        }
    
    tempdir, sid = None, None
    try:
        # Parse multipart form data
        content_type = request.headers.get('content-type', '')
        if not content_type.startswith('multipart/form-data'):
            return {
                'statusCode': 400,
                'headers': headers,
                'body': 'Content-Type must be multipart/form-data'
            }

        # Parse form data
        form_data = cgi.FieldStorage(
            fp=io.StringIO(request.body.decode()) if isinstance(request.body, bytes) else io.StringIO(request.body),
            environ={
                'REQUEST_METHOD': 'POST',
                'CONTENT_TYPE': content_type,
                'CONTENT_LENGTH': str(len(request.body))
            }
        )

        if 'file' not in form_data or not form_data['file'].filename:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': 'No file uploaded'
            }

        file_item = form_data['file']

        tempdir, sid = unique_tempdir()
        validate_archive_extension(file_item.filename)
        
        # Save uploaded file
        zip_path = os.path.join(tempdir, "project.zip")
        with open(zip_path, 'wb') as f:
            if hasattr(file_item, 'file'):
                shutil.copyfileobj(file_item.file, f)
            else:
                f.write(file_item.value)
        
        # Extract and scan
        shutil.unpack_archive(zip_path, tempdir)
        scan_for_malware(tempdir)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': 'Scan OK'
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': str(e)
        }
    finally:
        if sid:
            cleanup_tempdir(sid)
