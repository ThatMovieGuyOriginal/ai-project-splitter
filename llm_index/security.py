import os, logging, subprocess
from llm_index.constants import DANGEROUS_EXTS, DANGEROUS_PATTERNS, MAX_FILE_SIZE

def scan_for_malware(root_dir):
    # Block binaries, scripts, and suspicious patterns
    for dirpath, _, filenames in os.walk(root_dir):
        for fname in filenames:
            if any(fname.endswith(ext) for ext in DANGEROUS_EXTS):
                raise Exception(f"Malicious or unsafe file detected: {fname}")
            fpath = os.path.join(dirpath, fname)
            if os.path.getsize(fpath) > MAX_FILE_SIZE:
                raise Exception(f"File {fname} is too large ({os.path.getsize(fpath)} bytes)")
            try:
                with open(fpath, encoding="utf-8", errors="ignore") as f:
                    head = f.read(1024)
                    for pattern in DANGEROUS_PATTERNS:
                        if pattern in head:
                            raise Exception(f"Suspicious pattern '{pattern}' found in {fname}")
            except Exception:
                continue
    # Optional: use ClamAV if available
    try:
        result = subprocess.run(['clamscan', '-r', root_dir], capture_output=True, text=True, timeout=20)
        if result.returncode == 1:
            raise Exception(f"Malware detected by ClamAV: {result.stdout}")
    except FileNotFoundError:
        logging.getLogger('llm-index.security').info('ClamAV not installed; skipping AV scan.')
    except Exception as e:
        raise Exception(f"Malware scan failed: {e}")

def validate_archive_extension(filename):
    if not any(filename.endswith(ext) for ext in ['.zip']):
        raise Exception("Only .zip archives are supported.")

def validate_github_url(url):
    import re
    if not re.match(r"^https:\/\/github\.com\/[\w\-]+\/[\w\-]+", url):
        raise Exception("Only public GitHub repo URLs are supported.")
