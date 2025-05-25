import os, tempfile, shutil, uuid

from llm_index.constants import IGNORE_DIRS, MAX_TEMP_SESSIONS

_TEMP_SESSIONS = {}

def unique_tempdir():
    """Create a unique, isolated tempdir, and auto-expire if too many sessions."""
    if len(_TEMP_SESSIONS) > MAX_TEMP_SESSIONS:
        # Cleanup oldest
        for sid in sorted(_TEMP_SESSIONS)[:5]:
            shutil.rmtree(_TEMP_SESSIONS[sid], ignore_errors=True)
            _TEMP_SESSIONS.pop(sid)
    sid = str(uuid.uuid4())
    tempdir = tempfile.mkdtemp(prefix='llmindex_')
    _TEMP_SESSIONS[sid] = tempdir
    return tempdir, sid

def cleanup_tempdir(sid):
    if sid in _TEMP_SESSIONS:
        shutil.rmtree(_TEMP_SESSIONS[sid], ignore_errors=True)
        _TEMP_SESSIONS.pop(sid)

def is_ignored_dir(dirname):
    return any(dirname.endswith(x) for x in IGNORE_DIRS)
