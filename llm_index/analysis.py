# llm_index/analysis.py
import os, ast, re, chardet
from typing import Dict, Set, List
from llm_index.constants import IGNORE_DIRS, MAX_FILES_PER_PROJECT
from llm_index.technical_debt import TechnicalDebtAnalyzer
import logging

logger = logging.getLogger('llm-index.analysis')

def analyze_project(root_dir: str) -> Dict[str, List[str]]:
    """Basic project analysis for dependency graph extraction."""
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
            except Exception as e:
                logger.warning(f"Failed to read {fpath}: {e}")
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
                except Exception as e:
                    logger.warning(f"AST parsing failed for {fpath}: {e}")
                    pass
            elif ext in {'.js', '.ts'}:
                deps |= set(re.findall(r'import\s+.*?\s+from\s+[\'\"]([^\'\"]+)[\'\"]', code))
                deps |= set(re.findall(r'require\([\'\"]([^\'\"]+)[\'\"]\)', code))
            
            dep_graph[fpath] = list(deps)
    
    logger.info(f"Analyzed {len(dep_graph)} files with dependencies")
    return dep_graph

def analyze_project_enhanced(root_dir: str) -> Dict[str, any]:
    """Enhanced analysis including technical debt and complexity metrics."""
    try:
        # Get basic dependency graph
        dep_graph = analyze_project(root_dir)
        
        # Perform technical debt analysis  
        debt_analyzer = TechnicalDebtAnalyzer()
        debt_analysis = debt_analyzer.analyze_project_debt(root_dir, dep_graph)
        
        # Extract complexity scores for clustering
        complexity_scores = {}
        if 'file_complexities' in debt_analysis:
            for file_path, complexity_data in debt_analysis['file_complexities'].items():
                if isinstance(complexity_data, dict):
                    # Create a ComplexityMetrics-like object for scoring
                    try:
                        # Calculate overall score from the complexity data
                        cyclomatic = complexity_data.get('cyclomatic_complexity', 1.0)
                        cognitive = complexity_data.get('cognitive_complexity', 1.0)
                        nesting = complexity_data.get('nesting_depth', 1)
                        maintainability = complexity_data.get('maintainability_index', 100.0)
                        
                        # Simplified overall score calculation
                        score = (cyclomatic * 0.3 + cognitive * 0.4 + nesting * 5 + 
                                max(0, 100 - maintainability) * 0.3)
                        complexity_scores[file_path] = min(100, max(0, score))
                    except Exception as e:
                        logger.warning(f"Failed to calculate complexity score for {file_path}: {e}")
                        complexity_scores[file_path] = 1.0
        
        logger.info(f"Enhanced analysis complete: {len(complexity_scores)} files with complexity scores")
        
        return {
            'dep_graph': dep_graph,
            'complexity_scores': complexity_scores,
            'debt_analysis': debt_analysis
        }
        
    except Exception as e:
        logger.error(f"Enhanced analysis failed: {e}")
        # Fallback to basic analysis
        return {
            'dep_graph': analyze_project(root_dir),
            'complexity_scores': {},
            'debt_analysis': {'error': str(e)}
        }
