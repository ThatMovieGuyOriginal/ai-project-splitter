# llm_index/constants.py
import os

# Directories to always ignore in analysis, refactor, and backup
IGNORE_DIRS = {'.git', '__pycache__', 'node_modules', '.llm-index', '.venv', 'env', '.env'}

# Supported file extensions
PY_EXTS = {'.py'}
JS_TS_EXTS = {'.js', '.ts'}
SUPPORTED_ARCHIVES = {'.zip'}

# Dangerous file extensions
DANGEROUS_EXTS = {'.exe', '.dll', '.so', '.bin', '.sh', '.bat', '.msi'}

# Max concurrent temp dirs or sessions (for concurrency control)
MAX_TEMP_SESSIONS = 50

# Malware patterns (heuristics)
DANGEROUS_PATTERNS = [
    'eval(', 'exec(', 'rm -rf', 'os.system', 'subprocess.Popen', 'require("child_process")', 'import subprocess', 'import os'
]

# Max files allowed per upload (DoS protection)
MAX_FILES_PER_PROJECT = 2000

# Max file size (bytes)
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
