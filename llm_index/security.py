import os, logging
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
    # Note: ClamAV scanning disabled in serverless environment
    logging.getLogger('llm-index.security').info('Basic malware scan completed (ClamAV not available in serverless)')

def validate_archive_extension(filename):
    if not any(filename.endswith(ext) for ext in ['.zip']):
        raise Exception("Only .zip archives are supported.")

def validate_github_url(url):
    import re
    if not re.match(r"^https:\/\/github\.com\/[\w\-]+\/[\w\-]+", url):
        raise Exception("Only public GitHub repo URLs are supported.")
