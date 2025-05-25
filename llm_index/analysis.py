import os, ast, re, chardet
from typing import Dict, Set, List
from llm_index.constants import IGNORE_DIRS, MAX_FILES_PER_PROJECT

def analyze_project(root_dir: str) -> Dict[str, List[str]]:
    dep_graph = {}
    count = 0
    for dirpath, _, filenames in os.walk(root_dir):
        if any(x in dirpath for x in IGNORE_DIRS):
            continue
        for fname in filenames:
            if fname.startswith('.'):  # Ignore dotfiles
                continue
            fpath = os.path.abspath(os.path.join(dirpath, fname))
            ext = os.path.splitext(fname)[-1]
            count += 1
            if count > MAX_FILES_PER_PROJECT:
                raise Exception(f"Project exceeds file limit of {MAX_FILES_PER_PROJECT}.")
            # Non-UTF8: detect and skip or decode safely
            try:
                with open(fpath, "rb") as f:
                    raw = f.read(2048)
                    enc = chardet.detect(raw)['encoding'] or 'utf-8'
                with open(fpath, encoding=enc, errors="ignore") as f:
                    code = f.read()
            except Exception:
                continue
            deps = set()
            if ext == '.py':
                try:
                    tree = ast.parse(code, filename=fpath)
                    for node in ast.walk(tree):
                        if isinstance(node, ast.Import):
                            for n in node.names:
                                deps.add(n.name.split('.')[0])
                        elif isinstance(node, ast.ImportFrom):
                            if node.module:
                                deps.add(node.module.split('.')[0])
                except Exception:
                    pass
            elif ext in {'.js', '.ts'}:
                deps |= set(re.findall(r'import\s+.*?\s+from\s+[\'\"]([^\'\"]+)[\'\"]', code))
                deps |= set(re.findall(r'require\([\'\"]([^\'\"]+)[\'\"]\)', code))
            dep_graph[fpath] = list(deps)
    return dep_graph
