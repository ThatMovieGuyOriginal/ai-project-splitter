import ast
import re
import os
import math
import logging
from typing import Dict, List, Tuple, Set, Optional, Any
from collections import defaultdict, Counter
from dataclasses import dataclass
from llm_index.constants import PY_EXTS, JS_TS_EXTS

logger = logging.getLogger('llm-index.debt_analyzer')

@dataclass
class ComplexityMetrics:
    """Container for various complexity measurements."""
    cyclomatic_complexity: float
    cognitive_complexity: float
    nesting_depth: int
    function_count: int
    class_count: int
    lines_of_code: int
    code_duplication_ratio: float
    maintainability_index: float
    
    def overall_score(self) -> float:
        """Calculate overall complexity score (0-100, lower is better)."""
        weights = {
            'cyclomatic': 0.25,
            'cognitive': 0.30,
            'nesting': 0.15,
            'duplication': 0.20,
            'maintainability': 0.10
        }
        
        # Normalize metrics to 0-100 scale
        normalized_cyclomatic = min(100, self.cyclomatic_complexity * 2)
        normalized_cognitive = min(100, self.cognitive_complexity * 1.5)
        normalized_nesting = min(100, self.nesting_depth * 10)
        normalized_duplication = self.code_duplication_ratio * 100
        normalized_maintainability = max(0, 100 - self.maintainability_index)
        
        score = (
            weights['cyclomatic'] * normalized_cyclomatic +
            weights['cognitive'] * normalized_cognitive +
            weights['nesting'] * normalized_nesting +
            weights['duplication'] * normalized_duplication +
            weights['maintainability'] * normalized_maintainability
        )
        
        return min(100, max(0, score))

@dataclass
class TechnicalDebtItem:
    """Represents a specific technical debt issue."""
    file_path: str
    line_number: int
    severity: str  # 'low', 'medium', 'high', 'critical'
    category: str  # 'complexity', 'duplication', 'security', 'maintainability'
    description: str
    suggestion: str
    estimated_effort: str  # 'minutes', 'hours', 'days'

class TechnicalDebtAnalyzer:
    """
    Comprehensive technical debt and complexity analyzer for codebases.
    """
    
    def __init__(self):
        self.complexity_cache = {}
        self.debt_patterns = self._initialize_debt_patterns()
        
    def analyze_project_debt(self, root_dir: str, dep_graph: Dict[str, List[str]]) -> Dict[str, Any]:
        """
        Analyze technical debt across the entire project.
        """
        try:
            logger.info("Starting technical debt analysis")
            
            file_complexities = {}
            debt_items = []
            
            # Analyze each file
            for file_path in dep_graph.keys():
                try:
                    if os.path.exists(file_path):
                        complexity = self.analyze_file_complexity(file_path)
                        file_complexities[file_path] = complexity
                        
                        # Detect debt items
                        file_debt = self.detect_debt_items(file_path)
                        debt_items.extend(file_debt)
                            
                except Exception as e:
                    logger.warning(f"Failed to analyze {file_path}: {e}")
                    continue
            
            # Generate prioritized action plan
            action_plan = self.generate_action_plan(debt_items, file_complexities)
            
            report = {
                'file_complexities': {k: v.__dict__ for k, v in file_complexities.items()},
                'debt_items': [item.__dict__ for item in debt_items],
                'action_plan': action_plan,
                'summary': self._generate_summary(debt_items, file_complexities)
            }
            
            logger.info(f"Debt analysis complete: {len(debt_items)} issues found")
            return report
            
        except Exception as e:
            logger.error(f"Technical debt analysis failed: {e}")
            return {'error': str(e)}
    
    def analyze_file_complexity(self, file_path: str) -> ComplexityMetrics:
        """Analyze complexity metrics for a single file."""
        if file_path in self.complexity_cache:
            return self.complexity_cache[file_path]
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            ext = os.path.splitext(file_path)[1]
            
            if ext in PY_EXTS:
                metrics = self._analyze_python_complexity(content, file_path)
            elif ext in JS_TS_EXTS:
                metrics = self._analyze_javascript_complexity(content, file_path)
            else:
                metrics = self._analyze_generic_complexity(content, file_path)
            
            self.complexity_cache[file_path] = metrics
            return metrics
            
        except Exception as e:
            logger.warning(f"Complexity analysis failed for {file_path}: {e}")
            return ComplexityMetrics(
                cyclomatic_complexity=1.0,
                cognitive_complexity=1.0,
                nesting_depth=1,
                function_count=0,
                class_count=0,
                lines_of_code=0,
                code_duplication_ratio=0.0,
                maintainability_index=100.0
            )
    
    def _analyze_python_complexity(self, content: str, file_path: str) -> ComplexityMetrics:
        """Analyze Python file complexity using AST."""
        try:
            tree = ast.parse(content)
            
            visitor = PythonComplexityVisitor()
            visitor.visit(tree)
            
            lines = content.split('\n')
            loc = len([line for line in lines if line.strip() and not line.strip().startswith('#')])
            
            # Calculate maintainability index
            halstead_volume = self._calculate_halstead_volume(content)
            cyclomatic_avg = visitor.cyclomatic_complexity / max(1, visitor.function_count)
            
            maintainability_index = max(0, 171 - 5.2 * math.log(halstead_volume) - 
                                     0.23 * cyclomatic_avg - 16.2 * math.log(max(1, loc)))
            
            return ComplexityMetrics(
                cyclomatic_complexity=visitor.cyclomatic_complexity,
                cognitive_complexity=visitor.cognitive_complexity,
                nesting_depth=visitor.max_nesting_depth,
                function_count=visitor.function_count,
                class_count=visitor.class_count,
                lines_of_code=loc,
                code_duplication_ratio=0.0,
                maintainability_index=maintainability_index
            )
            
        except SyntaxError as e:
            logger.warning(f"Python syntax error in {file_path}: {e}")
            return self._analyze_generic_complexity(content, file_path)
    
    def _analyze_javascript_complexity(self, content: str, file_path: str) -> ComplexityMetrics:
        """Analyze JavaScript/TypeScript file complexity."""
        lines = content.split('\n')
        loc = len([line for line in lines if line.strip() and not line.strip().startswith('//')])
        
        # Count functions and classes
        function_pattern = r'(?:function\s+\w+|const\s+\w+\s*=\s*(?:\([^)]*\)\s*=>|\([^)]*\)\s*\{)|class\s+\w+)'
        class_pattern = r'class\s+\w+'
        
        function_count = len(re.findall(function_pattern, content, re.MULTILINE))
        class_count = len(re.findall(class_pattern, content, re.MULTILINE))
        
        # Calculate cyclomatic complexity
        complexity_keywords = ['if', 'else', 'while', 'for', 'switch', 'case', 'catch', '&&', '||', '?']
        cyclomatic = 1
        for keyword in complexity_keywords:
            cyclomatic += len(re.findall(r'\b' + re.escape(keyword) + r'\b', content))
        
        # Calculate nesting depth
        max_nesting = self._calculate_max_nesting_depth(content)
        
        # Cognitive complexity
        cognitive = cyclomatic * 1.2 + max_nesting * 0.5
        
        # Maintainability index
        halstead_volume = self._calculate_halstead_volume(content)
        cyclomatic_avg = cyclomatic / max(1, function_count)
        maintainability_index = max(0, 171 - 5.2 * math.log(halstead_volume) - 
                                 0.23 * cyclomatic_avg - 16.2 * math.log(max(1, loc)))
        
        return ComplexityMetrics(
            cyclomatic_complexity=cyclomatic,
            cognitive_complexity=cognitive,
            nesting_depth=max_nesting,
            function_count=function_count,
            class_count=class_count,
            lines_of_code=loc,
            code_duplication_ratio=0.0,
            maintainability_index=maintainability_index
        )
    
    def _analyze_generic_complexity(self, content: str, file_path: str) -> ComplexityMetrics:
        """Generic complexity analysis for unsupported file types."""
        lines = content.split('\n')
        loc = len([line for line in lines if line.strip()])
        
        nesting = self._calculate_max_nesting_depth(content)
        
        return ComplexityMetrics(
            cyclomatic_complexity=max(1, loc / 10),
            cognitive_complexity=max(1, loc / 8),
            nesting_depth=nesting,
            function_count=0,
            class_count=0,
            lines_of_code=loc,
            code_duplication_ratio=0.0,
            maintainability_index=max(0, 100 - loc / 5)
        )
    
    def _calculate_halstead_volume(self, content: str) -> float:
        """Calculate simplified Halstead volume."""
        operators = re.findall(r'[+\-*/=%<>!&|]+|if|else|while|for|return', content)
        operands = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', content)
        
        n1 = len(set(operators))
        n2 = len(set(operands))
        N1 = len(operators)
        N2 = len(operands)
        
        if n1 == 0 or n2 == 0:
            return 1.0
            
        vocabulary = n1 + n2
        length = N1 + N2
        
        return length * math.log2(vocabulary) if vocabulary > 1 else 1.0
    
    def _calculate_max_nesting_depth(self, content: str) -> int:
        """Calculate maximum nesting depth in code."""
        max_depth = 0
        current_depth = 0
        
        for line in content.split('\n'):
            stripped = line.strip()
            if not stripped or stripped.startswith('//') or stripped.startswith('#'):
                continue
                
            # Count opening braces/control structures
            opens = stripped.count('{') + len(re.findall(r'\b(?:if|for|while|else|try|catch|with)\b', stripped))
            closes = stripped.count('}')
            
            current_depth += opens - closes
            max_depth = max(max_depth, current_depth)
            
        return max_depth
    
    def detect_debt_items(self, file_path: str) -> List[TechnicalDebtItem]:
        """Detect specific technical debt items in a file."""
        debt_items = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = f.readlines()
            
            for line_num, line in enumerate(lines, 1):
                # Check against debt patterns
                for pattern_name, pattern_info in self.debt_patterns.items():
                    if re.search(pattern_info['pattern'], line, re.IGNORECASE):
                        debt_items.append(TechnicalDebtItem(
                            file_path=file_path,
                            line_number=line_num,
                            severity=pattern_info['severity'],
                            category=pattern_info['category'],
                            description=f"{pattern_name}: {pattern_info['description']}",
                            suggestion=pattern_info['suggestion'],
                            estimated_effort=pattern_info['effort']
                        ))
            
            # File-level debt detection
            ext = os.path.splitext(file_path)[1]
            if ext in PY_EXTS:
                debt_items.extend(self._detect_python_debt(file_path, lines))
            elif ext in JS_TS_EXTS:
                debt_items.extend(self._detect_javascript_debt(file_path, lines))
                
        except Exception as e:
            logger.warning(f"Debt detection failed for {file_path}: {e}")
        
        return debt_items
    
    def _initialize_debt_patterns(self) -> Dict[str, Dict[str, str]]:
        """Initialize patterns for detecting technical debt."""
        return {
            'TODO_FIXME': {
                'pattern': r'#\s*(TODO|FIXME|HACK|XXX)',
                'severity': 'medium',
                'category': 'maintainability',
                'description': 'Unfinished work or temporary fixes',
                'suggestion': 'Complete the TODO item or create a proper issue',
                'effort': 'hours'
            },
            'MAGIC_NUMBERS': {
                'pattern': r'\b(?<![\w.])\d{2,}\b(?![\w.])',
                'severity': 'low',
                'category': 'maintainability',
                'description': 'Magic number found',
                'suggestion': 'Replace with named constant',
                'effort': 'minutes'
            },
            'DEEP_NESTING': {
                'pattern': r'^\s{16,}',
                'severity': 'medium',
                'category': 'complexity',
                'description': 'Deep nesting detected',
                'suggestion': 'Consider extracting methods or early returns',
                'effort': 'hours'
            },
            'LONG_LINE': {
                'pattern': r'^.{120,},
                'severity': 'low',
                'category': 'maintainability',
                'description': 'Line exceeds recommended length',
                'suggestion': 'Break long line into multiple lines',
                'effort': 'minutes'
            },
            'UNSAFE_EVAL': {
                'pattern': r'\b(?:eval|exec)\s*\(',
                'severity': 'critical',
                'category': 'security',
                'description': 'Unsafe code execution',
                'suggestion': 'Replace with safer alternatives',
                'effort': 'days'
            },
            'BROAD_EXCEPTION': {
                'pattern': r'except\s*:\s*,
                'severity': 'medium',
                'category': 'maintainability',
                'description': 'Broad exception catching',
                'suggestion': 'Catch specific exceptions',
                'effort': 'minutes'
            }
        }
    
    def _detect_python_debt(self, file_path: str, lines: List[str]) -> List[TechnicalDebtItem]:
        """Python-specific debt detection."""
        debt_items = []
        
        try:
            content = ''.join(lines)
            tree = ast.parse(content)
            
            for node in ast.walk(tree):
                # Long functions
                if isinstance(node, ast.FunctionDef):
                    func_lines = getattr(node, 'end_lineno', node.lineno) - node.lineno + 1
                    if func_lines > 50:
                        debt_items.append(TechnicalDebtItem(
                            file_path=file_path,
                            line_number=node.lineno,
                            severity='high',
                            category='complexity',
                            description=f"Function '{node.name}' is too long ({func_lines} lines)",
                            suggestion="Break into smaller, focused functions",
                            estimated_effort='hours'
                        ))
                
                # Too many arguments
                if isinstance(node, ast.FunctionDef) and len(node.args.args) > 5:
                    debt_items.append(TechnicalDebtItem(
                        file_path=file_path,
                        line_number=node.lineno,
                        severity='medium',
                        category='complexity',
                        description=f"Function '{node.name}' has too many parameters ({len(node.args.args)})",
                        suggestion="Consider using parameter objects or breaking the function",
                        estimated_effort='hours'
                    ))
                        
        except SyntaxError:
            pass
        except Exception as e:
            logger.warning(f"Python debt detection failed for {file_path}: {e}")
        
        return debt_items
    
    def _detect_javascript_debt(self, file_path: str, lines: List[str]) -> List[TechnicalDebtItem]:
        """JavaScript/TypeScript-specific debt detection."""
        debt_items = []
        content = ''.join(lines)
        
        # Long functions (simplified detection)
        function_pattern = r'(?:function\s+\w+|const\s+\w+\s*=\s*(?:\([^)]*\)\s*=>|\([^)]*\)\s*\{))'
        functions = re.finditer(function_pattern, content, re.MULTILINE)
        
        for match in functions:
            start_line = content[:match.start()].count('\n') + 1
            # Estimate function length (simplified)
            remaining_content = content[match.end():]
            brace_count = 1
            end_pos = 0
            
            for i, char in enumerate(remaining_content):
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_pos = i
                        break
            
            if end_pos > 0:
                func_content = remaining_content[:end_pos]
                func_lines = func_content.count('\n')
                
                if func_lines > 30:
                    debt_items.append(TechnicalDebtItem(
                        file_path=file_path,
                        line_number=start_line,
                        severity='medium',
                        category='complexity',
                        description=f"Function is too long ({func_lines} lines)",
                        suggestion="Break into smaller functions",
                        estimated_effort='hours'
                    ))
        
        return debt_items
    
    def generate_action_plan(self, debt_items: List[TechnicalDebtItem], 
                           complexities: Dict[str, ComplexityMetrics]) -> Dict[str, Any]:
        """Generate prioritized action plan for addressing technical debt."""
        
        # Categorize items by severity and effort
        critical_items = [item for item in debt_items if item.severity == 'critical']
        high_items = [item for item in debt_items if item.severity == 'high']
        medium_items = [item for item in debt_items if item.severity == 'medium']
        low_items = [item for item in debt_items if item.severity == 'low']
        
        # Calculate effort distribution
        effort_distribution = Counter([item.estimated_effort for item in debt_items])
        
        # Identify priority files
        file_debt_count = Counter([item.file_path for item in debt_items])
        priority_files = []
        
        for file_path, complexity in complexities.items():
            debt_count = file_debt_count.get(file_path, 0)
            priority_score = complexity.overall_score() + (debt_count * 10)
            
            if priority_score > 80:
                priority_files.append({
                    'file': file_path,
                    'priority_score': priority_score,
                    'complexity_score': complexity.overall_score(),
                    'debt_count': debt_count
                })
        
        priority_files.sort(key=lambda x: x['priority_score'], reverse=True)
        
        return {
            'total_debt_items': len(debt_items),
            'severity_breakdown': {
                'critical': len(critical_items),
                'high': len(high_items),
                'medium': len(medium_items),
                'low': len(low_items)
            },
            'effort_distribution': dict(effort_distribution),
            'priority_files': priority_files[:10],
            'quick_wins': [item.__dict__ for item in debt_items 
                          if item.estimated_effort == 'minutes' and item.severity in ['medium', 'high']][:5],
            'recommendations': self._generate_recommendations(debt_items, complexities)
        }
    
    def _generate_recommendations(self, debt_items: List[TechnicalDebtItem], 
                                complexities: Dict[str, ComplexityMetrics]) -> List[str]:
        """Generate high-level recommendations."""
        recommendations = []
        
        critical_count = len([item for item in debt_items if item.severity == 'critical'])
        if critical_count > 0:
            recommendations.append(f"Address {critical_count} critical security/stability issues immediately")
        
        high_complexity_files = [f for f, c in complexities.items() if c.overall_score() > 80]
        if high_complexity_files:
            recommendations.append(f"Prioritize refactoring {len(high_complexity_files)} high-complexity files")
        
        quick_wins = [item for item in debt_items if item.estimated_effort == 'minutes']
        if len(quick_wins) > 10:
            recommendations.append(f"Start with {len(quick_wins)} quick wins to build momentum")
        
        return recommendations
    
    def _generate_summary(self, debt_items: List[TechnicalDebtItem], 
                        complexities: Dict[str, ComplexityMetrics]) -> Dict[str, Any]:
        """Generate executive summary of technical debt analysis."""
        if not complexities:
            return {'error': 'No complexity data available'}
        
        avg_complexity = sum(c.overall_score() for c in complexities.values()) / len(complexities)
        high_complexity_count = len([c for c in complexities.values() if c.overall_score() > 70])
        
        return {
            'total_files_analyzed': len(complexities),
            'total_debt_items': len(debt_items),
            'average_complexity_score': round(avg_complexity, 2),
            'high_complexity_files': high_complexity_count,
            'critical_issues': len([item for item in debt_items if item.severity == 'critical']),
            'estimated_refactoring_effort': self._estimate_total_effort(debt_items),
            'overall_health_grade': self._calculate_health_grade(avg_complexity, debt_items)
        }
    
    def _estimate_total_effort(self, debt_items: List[TechnicalDebtItem]) -> str:
        """Estimate total effort required to address all debt."""
        effort_weights = {'minutes': 0.1, 'hours': 1, 'days': 8}
        total_hours = sum(effort_weights.get(item.estimated_effort, 1) for item in debt_items)
        
        if total_hours < 8:
            return f"{int(total_hours)} hours"
        elif total_hours < 40:
            return f"{int(total_hours/8)} days"
        else:
            return f"{int(total_hours/40)} weeks"
    
    def _calculate_health_grade(self, avg_complexity: float, debt_items: List[TechnicalDebtItem]) -> str:
        """Calculate overall codebase health grade."""
        complexity_score = min(100, avg_complexity)
        debt_density = min(100, len(debt_items) * 5)
        
        overall_score = (complexity_score + debt_density) / 2
        
        if overall_score < 30:
            return 'A'
        elif overall_score < 50:
            return 'B'
        elif overall_score < 70:
            return 'C'
        elif overall_score < 85:
            return 'D'
        else:
            return 'F'


class PythonComplexityVisitor(ast.NodeVisitor):
    """AST visitor for calculating Python code complexity."""
    
    def __init__(self):
        self.cyclomatic_complexity = 1
        self.cognitive_complexity = 0
        self.nesting_level = 0
        self.max_nesting_depth = 0
        self.function_count = 0
        self.class_count = 0
    
    def visit_FunctionDef(self, node):
        self.function_count += 1
        self._enter_scope()
        self.generic_visit(node)
        self._exit_scope()
    
    def visit_AsyncFunctionDef(self, node):
        self.function_count += 1
        self._enter_scope()
        self.generic_visit(node)
        self._exit_scope()
    
    def visit_ClassDef(self, node):
        self.class_count += 1
        self._enter_scope()
        self.generic_visit(node)
        self._exit_scope()
    
    def visit_If(self, node):
        self._add_complexity()
        self._enter_scope()
        self.generic_visit(node)
        self._exit_scope()
    
    def visit_While(self, node):
        self._add_complexity()
        self._enter_scope()
        self.generic_visit(node)
        self._exit_scope()
    
    def visit_For(self, node):
        self._add_complexity()
        self._enter_scope()
        self.generic_visit(node)
        self._exit_scope()
    
    def visit_Try(self, node):
        self._add_complexity()
        self.generic_visit(node)
    
    def visit_ExceptHandler(self, node):
        self._add_complexity()
        self.generic_visit(node)
    
    def visit_With(self, node):
        self._add_complexity()
        self.generic_visit(node)
    
    def visit_BoolOp(self, node):
        self.cyclomatic_complexity += len(node.values) - 1
        self.cognitive_complexity += len(node.values) - 1
        self.generic_visit(node)
    
    def _add_complexity(self):
        self.cyclomatic_complexity += 1
        self.cognitive_complexity += 1 + self.nesting_level
    
    def _enter_scope(self):
        self.nesting_level += 1
        self.max_nesting_depth = max(self.max_nesting_depth, self.nesting_level)
    
    def _exit_scope(self):
        self.nesting_level -= 1
