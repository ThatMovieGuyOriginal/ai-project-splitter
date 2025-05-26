# llm_index/backup.py
import shutil, os, tempfile
from llm_index.constants import IGNORE_DIRS

def create_backup(root_dir):
    backup_dir = tempfile.mkdtemp(prefix='llmindex_backup_')
    dst = os.path.join(backup_dir, "backup")
    shutil.copytree(root_dir, dst, ignore=shutil.ignore_patterns(*IGNORE_DIRS))
    return backup_dir

def restore_backup(backup_dir, root_dir):
    backup = os.path.join(backup_dir, "backup")
    for fname in os.listdir(root_dir):
        if fname not in IGNORE_DIRS:
            fpath = os.path.join(root_dir, fname)
            try:
                if os.path.isfile(fpath):
                    os.remove(fpath)
                else:
                    shutil.rmtree(fpath)
            except Exception:
                pass
    for fname in os.listdir(backup):
        src = os.path.join(backup, fname)
        dst = os.path.join(root_dir, fname)
        if os.path.isdir(src):
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)
