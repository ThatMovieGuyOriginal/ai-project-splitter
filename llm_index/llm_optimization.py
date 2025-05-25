import os
import re
import json
import logging
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
from collections import defaultdict, Counter
import math

logger = logging.getLogger('llm-index.llm_optimization')

@dataclass
class TokenEstimate:
    """Token count estimates for different content types."""
    code_tokens: int
    comments_tokens: int
    documentation_tokens: int
    total_tokens: int
    
    def __post_init__(self):
        if self.total_tokens == 0:
            self.total_tokens = self.code_tokens + self.comments_tokens + self.documentation_tokens

@dataclass
class ContextChunk:
    """Represents an optimized context chunk for LLM consumption."""
    chunk_id: str
    files: List[str]
    content_summary: str
    token_estimate: TokenEstimate
    priority_score: float
    dependencies: List[str]
    context_type: str  # 'core', 'supporting', 'documentation', 'tests'
    
class LLMContextOptimizer:
    """
    Advanced LLM context optimization engine that prepares code for optimal
    LLM consumption by considering token limits, attention patterns, and reasoning chains.
    """
    
    def __init__(self, max_context_tokens: int = 128000, target_chunk_tokens: int = 8000):
        self.max_context_tokens = max_context_tokens
        self.target_chunk_tokens = target_chunk_tokens
        self.token_estimates_cache = {}
        
        # Different LLM models have different optimal context patterns
        self.llm_profiles = {
            'claude': {
                'max_tokens': 200000,
                'optimal_chunk_size': 8000,
                'attention_decay': 0.95,
                'prefers_structured': True
            },
            'gpt4': {
                'max_tokens': 128000,
                'optimal_chunk_size': 6000,
                'attention_decay': 0.90,
                'prefers_structured': True
            },
            'generic': {
                'max_tokens': 32000,
                'optimal_chunk_size': 4000,
                'attention_decay': 0.85,
                'prefers_structured': False
            }
        }
    
    def optimize_for_llm(self, clusters: List[List[str]], dep_graph: Dict[str, List[str]], 
                        complexity_scores: Optional[Dict[str, float]] = None,
                        llm_model: str = 'claude') -> Dict[str, Any]:
        """
        Optimize clusters for LLM context consumption.
        """
        try:
            logger.info(f"Optimizing context for {llm_model} model")
            
            profile = self.llm_profiles.get(llm_model, self.llm_profiles['generic'])
            
            # Estimate tokens for all files
            file_tokens = self._estimate_all_file_tokens(list(dep_graph.keys()))
            
            # Create context-aware clusters
            context_chunks = self._create_context_chunks(
                clusters, dep_graph, file_tokens, complexity_scores, profile)
            
            # Optimize chunk ordering for progressive context loading
            ordered_chunks = self._optimize_chunk_ordering(context_chunks, dep_graph)
            
            # Generate multi-modal context integration
            multimodal_context = self._integrate_multimodal_context(
                ordered_chunks, dep_graph, file_tokens)
            
            # Create progressive loading strategy
            loading_strategy = self._create_progressive_loading_strategy(
                ordered_chunks, profile)
            
            return {
                'context_chunks': [chunk.__dict__ for chunk in ordered_chunks],
                'multimodal_context': multimodal_context,
                'loading_strategy': loading_strategy,
                'optimization_metrics': self._calculate_optimization_metrics(
                    ordered_chunks, profile),
                'recommendations': self._generate_llm_recommendations(
                    ordered_chunks, profile)
            }
            
        except Exception as e:
            logger.error(f"LLM optimization failed: {e}")
            return {'error': str(e)}
    
    def _estimate_all_file_tokens(self, file_paths: List[str]) -> Dict[str, TokenEstimate]:
        """Estimate token counts for all files."""
        token_estimates = {}
        
        for file_path in file_paths:
            if file_path in self.token_estimates_cache:
                token_estimates[file_path] = self.token_estimates_cache[file_path]
                continue
                
            try:
                estimate = self._estimate_file_tokens(file_path)
                token_estimates[file_path] = estimate
                self.token_estimates_cache[file_path] = estimate
            except Exception as e:
                logger.warning(f"Token estimation failed for {file_path}: {e}")
                token_estimates[file_path] = TokenEstimate(
                    code_tokens=500, comments_tokens=100, 
                    documentation_tokens=50, total_tokens=650)
        
        return token_estimates
    
    def _estimate_file_tokens(self, file_path: str) -> TokenEstimate:
        """Estimate tokens for a single file with content type breakdown."""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            
            lines = content.split('\n')
            
            # Separate different types of content
            code_lines = []
            comment_lines = []
            doc_lines = []
            
            ext = os.path.splitext(file_path)[1]
            
            if ext == '.py':
                code_lines, comment_lines, doc_lines = self._categorize_python_content(lines)
            elif ext in ['.js', '.ts']:
                code_lines, comment_lines, doc_lines = self._categorize_js_content(lines)
            else:
                # Create chunk from current files
                if current_chunk_files:
                    chunk = self._create_single_chunk(
                        f"cluster_{cluster_id}_part_{len(chunks)}", 
                        current_chunk_files, dep_graph, file_tokens, complexity_scores)
                    chunks.append(chunk)
                
                # Start new chunk
                current_chunk_files = [file]
                current_chunk_tokens = file_token_count
        
        # Create final chunk
        if current_chunk_files:
            chunk = self._create_single_chunk(
                f"cluster_{cluster_id}_part_{len(chunks)}", 
                current_chunk_files, dep_graph, file_tokens, complexity_scores)
            chunks.append(chunk)
        
        return chunks
    
    def _calculate_chunk_priority(self, files: List[str], dep_graph: Dict[str, List[str]],
                                complexity_scores: Optional[Dict[str, float]]) -> float:
        """Calculate priority score for a chunk."""
        
        # Average complexity of files
        avg_complexity = 0.0
        if complexity_scores:
            complexities = [complexity_scores.get(f, 1.0) for f in files]
            avg_complexity = sum(complexities) / len(complexities) if complexities else 1.0
        
        # Count dependencies
        outgoing_deps = sum(len(dep_graph.get(f, [])) for f in files)
        incoming_deps = 0
        for other_file, deps in dep_graph.items():
            if other_file not in files:
                for dep in deps:
                    if any(dep in f for f in files):
                        incoming_deps += 1
        
        total_deps = outgoing_deps + incoming_deps
        
        # File type bonus
        type_bonus = 0
        for file in files:
            if any(keyword in file.lower() for keyword in ['main', 'index', 'app', 'core']):
                type_bonus += 5
            elif any(keyword in file.lower() for keyword in ['util', 'helper', 'config']):
                type_bonus += 2
        
        priority_score = avg_complexity + (total_deps * 0.1) + type_bonus
        return priority_score
    
    def _determine_context_type(self, files: List[str]) -> str:
        """Determine the context type of a chunk."""
        
        file_indicators = {
            'core': ['main', 'index', 'app', 'core', 'engine', 'manager'],
            'supporting': ['util', 'helper', 'lib', 'common', 'shared'],
            'documentation': ['readme', 'doc', 'guide', '.md'],
            'tests': ['test', 'spec', '__test__', '.test.', '.spec.']
        }
        
        type_scores = defaultdict(int)
        
        for file in files:
            file_lower = file.lower()
            for context_type, indicators in file_indicators.items():
                for indicator in indicators:
                    if indicator in file_lower:
                        type_scores[context_type] += 1
        
        if not type_scores:
            return 'core'
        
        return max(type_scores.items(), key=lambda x: x[1])[0]
    
    def _find_chunk_dependencies(self, files: List[str], dep_graph: Dict[str, List[str]]) -> List[str]:
        """Find dependencies between this chunk and others."""
        dependencies = set()
        
        for file in files:
            file_deps = dep_graph.get(file, [])
            for dep in file_deps:
                # Find which files this dependency might refer to
                for other_file in dep_graph.keys():
                    if other_file not in files and dep in other_file:
                        dependencies.add(other_file)
        
        return list(dependencies)
    
    def _generate_content_summary(self, files: List[str], dep_graph: Dict[str, List[str]]) -> str:
        """Generate a brief summary of what this chunk contains."""
        
        # Analyze file names and types
        file_types = Counter()
        main_purposes = []
        
        for file in files:
            ext = os.path.splitext(file)[1]
            file_types[ext] += 1
            
            basename = os.path.basename(file).lower()
            if any(keyword in basename for keyword in ['main', 'index', 'app']):
                main_purposes.append('main application logic')
            elif any(keyword in basename for keyword in ['util', 'helper']):
                main_purposes.append('utility functions')
            elif any(keyword in basename for keyword in ['config', 'setting']):
                main_purposes.append('configuration')
            elif any(keyword in basename for keyword in ['test', 'spec']):
                main_purposes.append('tests')
            elif any(keyword in basename for keyword in ['model', 'data']):
                main_purposes.append('data models')
            elif any(keyword in basename for keyword in ['api', 'service']):
                main_purposes.append('API services')
        
        # Build summary
        summary_parts = []
        
        if len(files) == 1:
            summary_parts.append(f"Single file: {os.path.basename(files[0])}")
        else:
            summary_parts.append(f"{len(files)} files")
        
        if file_types:
            main_type = file_types.most_common(1)[0][0]
            summary_parts.append(f"primarily {main_type} files")
        
        if main_purposes:
            unique_purposes = list(set(main_purposes))
            if len(unique_purposes) == 1:
                summary_parts.append(f"containing {unique_purposes[0]}")
            else:
                summary_parts.append(f"containing {', '.join(unique_purposes[:2])}")
        
        total_deps = sum(len(dep_graph.get(f, [])) for f in files)
        if total_deps > 0:
            summary_parts.append(f"with {total_deps} dependencies")
        
        return '; '.join(summary_parts)
    
    def _optimize_chunk_ordering(self, chunks: List[ContextChunk], 
                               dep_graph: Dict[str, List[str]]) -> List[ContextChunk]:
        """Optimize the ordering of chunks for progressive loading."""
        
        # Create dependency graph between chunks
        chunk_deps = {}
        for chunk in chunks:
            chunk_deps[chunk.chunk_id] = []
            for dep_file in chunk.dependencies:
                # Find which chunk contains this dependency
                for other_chunk in chunks:
                    if dep_file in other_chunk.files and other_chunk.chunk_id != chunk.chunk_id:
                        chunk_deps[chunk.chunk_id].append(other_chunk.chunk_id)
                        break
        
        # Topological sort with priority consideration
        ordered_chunks = []
        remaining_chunks = {chunk.chunk_id: chunk for chunk in chunks}
        processed_chunks = set()
        
        while remaining_chunks:
            # Find chunks with no unprocessed dependencies
            candidates = []
            for chunk_id, chunk in remaining_chunks.items():
                deps = chunk_deps.get(chunk_id, [])
                unprocessed_deps = [d for d in deps if d not in processed_chunks]
                
                if not unprocessed_deps:
                    candidates.append(chunk)
            
            if not candidates:
                # Handle circular dependencies - take highest priority
                candidates = [max(remaining_chunks.values(), key=lambda x: x.priority_score)]
            
            # Sort candidates by priority and context type
            candidates.sort(key=lambda x: (
                self._get_context_type_priority(x.context_type),
                -x.priority_score
            ))
            
            selected_chunk = candidates[0]
            ordered_chunks.append(selected_chunk)
            processed_chunks.add(selected_chunk.chunk_id)
            del remaining_chunks[selected_chunk.chunk_id]
        
        return ordered_chunks
    
    def _get_context_type_priority(self, context_type: str) -> int:
        """Get priority order for context types."""
        priorities = {
            'core': 0,
            'supporting': 1,
            'documentation': 2,
            'tests': 3
        }
        return priorities.get(context_type, 2)
    
    def _integrate_multimodal_context(self, chunks: List[ContextChunk], 
                                    dep_graph: Dict[str, List[str]],
                                    file_tokens: Dict[str, TokenEstimate]) -> Dict[str, Any]:
        """Integrate multiple types of context beyond just code."""
        
        multimodal_context = {
            'project_overview': self._generate_project_overview(chunks, dep_graph),
            'architecture_summary': self._generate_architecture_summary(chunks, dep_graph),
            'key_relationships': self._identify_key_relationships(chunks, dep_graph),
            'context_metadata': self._generate_context_metadata(chunks, file_tokens)
        }
        
        return multimodal_context
    
    def _generate_project_overview(self, chunks: List[ContextChunk], 
                                 dep_graph: Dict[str, List[str]]) -> str:
        """Generate a high-level project overview."""
        
        total_files = sum(len(chunk.files) for chunk in chunks)
        total_chunks = len(chunks)
        
        context_types = Counter(chunk.context_type for chunk in chunks)
        main_technologies = self._identify_technologies(chunks)
        
        overview = f"Project with {total_files} files organized into {total_chunks} logical chunks. "
        
        if context_types:
            type_desc = ", ".join(f"{count} {type_name}" for type_name, count in context_types.most_common(3))
            overview += f"Contains {type_desc} components. "
        
        if main_technologies:
            tech_desc = ", ".join(main_technologies[:3])
            overview += f"Primary technologies: {tech_desc}."
        
        return overview
    
    def _identify_technologies(self, chunks: List[ContextChunk]) -> List[str]:
        """Identify main technologies used in the project."""
        tech_indicators = {
            'Python': ['.py'],
            'JavaScript': ['.js'],
            'TypeScript': ['.ts'],
            'React': ['jsx', 'tsx', 'react'],
            'Node.js': ['package.json', 'node_modules'],
            'Flask': ['flask', 'app.py'],
            'Django': ['django', 'models.py'],
            'Next.js': ['next.config', 'pages/'],
            'Express': ['express', 'server.js']
        }
        
        identified_techs = []
        all_files = []
        for chunk in chunks:
            all_files.extend(chunk.files)
        
        for tech, indicators in tech_indicators.items():
            for indicator in indicators:
                if any(indicator in file.lower() for file in all_files):
                    identified_techs.append(tech)
                    break
        
        return identified_techs
    
    def _generate_architecture_summary(self, chunks: List[ContextChunk], 
                                     dep_graph: Dict[str, List[str]]) -> str:
        """Generate architecture summary."""
        
        patterns = []
        file_paths = []
        for chunk in chunks:
            file_paths.extend(chunk.files)
        
        if any('model' in path.lower() for path in file_paths):
            patterns.append('data modeling')
        if any('view' in path.lower() or 'template' in path.lower() for path in file_paths):
            patterns.append('view layer')
        if any('controller' in path.lower() or 'handler' in path.lower() for path in file_paths):
            patterns.append('controller logic')
        if any('api' in path.lower() or 'endpoint' in path.lower() for path in file_paths):
            patterns.append('API endpoints')
        if any('test' in path.lower() for path in file_paths):
            patterns.append('testing infrastructure')
        
        summary = f"Architecture organized into {len(chunks)} logical modules. "
        if patterns:
            summary += f"Follows patterns: {', '.join(patterns)}. "
        
        # Dependency complexity
        total_deps = sum(len(deps) for deps in dep_graph.values())
        avg_deps = total_deps / len(dep_graph) if dep_graph else 0
        
        if avg_deps > 5:
            summary += "High interdependency between modules."
        elif avg_deps > 2:
            summary += "Moderate coupling between modules."
        else:
            summary += "Low coupling between modules."
        
        return summary
    
    def _identify_key_relationships(self, chunks: List[ContextChunk], 
                                  dep_graph: Dict[str, List[str]]) -> List[Dict[str, Any]]:
        """Identify key relationships between chunks."""
        relationships = []
        
        for chunk in chunks:
            if chunk.dependencies:
                # Find the chunks that contain these dependencies
                dep_chunks = []
                for dep_file in chunk.dependencies:
                    for other_chunk in chunks:
                        if dep_file in other_chunk.files and other_chunk.chunk_id != chunk.chunk_id:
                            dep_chunks.append(other_chunk.chunk_id)
                            break
                
                if dep_chunks:
                    relationships.append({
                        'source_chunk': chunk.chunk_id,
                        'depends_on': dep_chunks,
                        'relationship_type': 'dependency',
                        'strength': len(chunk.dependencies)
                    })
        
        # Sort by relationship strength
        relationships.sort(key=lambda x: x['strength'], reverse=True)
        
        return relationships[:10]
    
    def _generate_context_metadata(self, chunks: List[ContextChunk], 
                                 file_tokens: Dict[str, TokenEstimate]) -> Dict[str, Any]:
        """Generate metadata about the context structure."""
        
        total_tokens = sum(chunk.token_estimate.total_tokens for chunk in chunks)
        avg_chunk_size = total_tokens / len(chunks) if chunks else 0
        
        token_distribution = {
            'code_tokens': sum(chunk.token_estimate.code_tokens for chunk in chunks),
            'comment_tokens': sum(chunk.token_estimate.comments_tokens for chunk in chunks),
            'doc_tokens': sum(chunk.token_estimate.documentation_tokens for chunk in chunks)
        }
        
        context_type_distribution = Counter(chunk.context_type for chunk in chunks)
        
        return {
            'total_context_tokens': total_tokens,
            'average_chunk_size': round(avg_chunk_size, 2),
            'chunk_count': len(chunks),
            'token_distribution': token_distribution,
            'context_type_distribution': dict(context_type_distribution),
            'largest_chunk': max(chunks, key=lambda x: x.token_estimate.total_tokens).chunk_id if chunks else None,
            'highest_priority_chunk': max(chunks, key=lambda x: x.priority_score).chunk_id if chunks else None
        }
    
    def _create_progressive_loading_strategy(self, chunks: List[ContextChunk], 
                                           profile: Dict[str, Any]) -> Dict[str, Any]:
        """Create a strategy for progressively loading context."""
        
        max_tokens = profile['max_tokens']
        attention_decay = profile['attention_decay']
        
        # Create loading phases
        phases = []
        current_phase_tokens = 0
        current_phase_chunks = []
        phase_number = 1
        
        for chunk in chunks:
            chunk_tokens = chunk.token_estimate.total_tokens
            
            if current_phase_tokens + chunk_tokens <= max_tokens // 3:
                current_phase_chunks.append(chunk.chunk_id)
                current_phase_tokens += chunk_tokens
            else:
                # Create current phase
                if current_phase_chunks:
                    phases.append({
                        'phase': phase_number,
                        'chunks': current_phase_chunks,
                        'total_tokens': current_phase_tokens,
                        'loading_priority': self._calculate_phase_priority(current_phase_chunks, chunks),
                        'attention_weight': attention_decay ** (phase_number - 1)
                    })
                    phase_number += 1
                
                # Start new phase
                current_phase_chunks = [chunk.chunk_id]
                current_phase_tokens = chunk_tokens
        
        # Add final phase
        if current_phase_chunks:
            phases.append({
                'phase': phase_number,
                'chunks': current_phase_chunks,
                'total_tokens': current_phase_tokens,
                'loading_priority': self._calculate_phase_priority(current_phase_chunks, chunks),
                'attention_weight': attention_decay ** (phase_number - 1)
            })
        
        return {
            'loading_phases': phases,
            'recommended_order': [phase['chunks'] for phase in phases],
            'total_phases': len(phases),
            'context_overflow_strategy': self._generate_overflow_strategy(chunks, max_tokens),
            'attention_optimization': self._generate_attention_optimization(phases, profile)
        }
    
    def _calculate_phase_priority(self, chunk_ids: List[str], all_chunks: List[ContextChunk]) -> float:
        """Calculate priority for a loading phase."""
        phase_chunks = [chunk for chunk in all_chunks if chunk.chunk_id in chunk_ids]
        if not phase_chunks:
            return 0.0
        
        avg_priority = sum(chunk.priority_score for chunk in phase_chunks) / len(phase_chunks)
        return avg_priority
    
    def _generate_overflow_strategy(self, chunks: List[ContextChunk], max_tokens: int) -> Dict[str, Any]:
        """Generate strategy for handling context overflow."""
        total_tokens = sum(chunk.token_estimate.total_tokens for chunk in chunks)
        
        if total_tokens <= max_tokens:
            return {'overflow_risk': 'none', 'strategy': 'load_all'}
        
        overflow_ratio = total_tokens / max_tokens
        
        strategies = {
            'prioritize_core': 'Load only core and high-priority chunks',
            'summarize_supporting': 'Summarize supporting chunks, load full core chunks',
            'progressive_detail': 'Load with decreasing detail levels',
            'chunk_selection': 'Select most relevant chunks only'
        }
        
        if overflow_ratio <= 1.5:
            recommended_strategy = 'prioritize_core'
        elif overflow_ratio <= 2.0:
            recommended_strategy = 'summarize_supporting' 
        elif overflow_ratio <= 3.0:
            recommended_strategy = 'progressive_detail'
        else:
            recommended_strategy = 'chunk_selection'
        
        # Select chunks that fit within token limit
        priority_sorted_chunks = sorted(chunks, key=lambda x: x.priority_score, reverse=True)
        selected_chunks = []
        running_tokens = 0
        
        for chunk in priority_sorted_chunks:
            if running_tokens + chunk.token_estimate.total_tokens <= max_tokens:
                selected_chunks.append(chunk.chunk_id)
                running_tokens += chunk.token_estimate.total_tokens
            else:
                break
        
        return {
            'overflow_risk': 'high' if overflow_ratio > 2 else 'medium',
            'overflow_ratio': round(overflow_ratio, 2),
            'recommended_strategy': recommended_strategy,
            'strategy_description': strategies[recommended_strategy],
            'selected_chunks': selected_chunks,
            'tokens_saved': total_tokens - running_tokens
        }
    
    def _generate_attention_optimization(self, phases: List[Dict[str, Any]], 
                                       profile: Dict[str, Any]) -> Dict[str, Any]:
        """Generate recommendations for optimal attention patterns."""
        
        attention_tips = []
        
        if len(phases) > 3:
            attention_tips.append("Consider consolidating chunks to reduce context switching")
        
        if profile['attention_decay'] < 0.9:
            attention_tips.append("Place most critical chunks in early phases for this model")
        
        phase_sizes = [phase['total_tokens'] for phase in phases]
        if len(phase_sizes) > 1 and max(phase_sizes) / min(phase_sizes) > 3:
            attention_tips.append("Balance phase sizes for consistent attention distribution")
        
        return {
            'optimization_tips': attention_tips,
            'attention_weights': [phase['attention_weight'] for phase in phases],
            'recommended_focus_phases': [i+1 for i, phase in enumerate(phases) 
                                       if phase['attention_weight'] > 0.8],
            'context_switching_cost': len(phases) * 0.1
        }
    
    def _calculate_optimization_metrics(self, chunks: List[ContextChunk], 
                                      profile: Dict[str, Any]) -> Dict[str, float]:
        """Calculate metrics for the optimization quality."""
        
        if not chunks:
            return {}
        
        # Token efficiency
        total_tokens = sum(chunk.token_estimate.total_tokens for chunk in chunks)
        max_tokens = profile['max_tokens']
        token_efficiency = min(1.0, total_tokens / max_tokens)
        
        # Chunk size variance
        chunk_sizes = [chunk.token_estimate.total_tokens for chunk in chunks]
        mean_size = sum(chunk_sizes) / len(chunk_sizes)
        variance = sum((size - mean_size) ** 2 for size in chunk_sizes) / len(chunk_sizes)
        size_consistency = 1.0 / (1.0 + math.sqrt(variance) / mean_size) if mean_size > 0 else 0
        
        # Priority distribution
        priorities = [chunk.priority_score for chunk in chunks]
        priority_range = max(priorities) - min(priorities) if len(priorities) > 1 else 0
        priority_distribution = 1.0 - (priority_range / max(priorities)) if max(priorities) > 0 else 1.0
        
        # Context type balance
        context_types = Counter(chunk.context_type for chunk in chunks)
        type_balance = len(context_types) / 4.0
        
        # Dependency optimization
        cross_chunk_deps = sum(len(chunk.dependencies) for chunk in chunks)
        total_possible_deps = len(chunks) * (len(chunks) - 1)
        dependency_optimization = 1.0 - (cross_chunk_deps / max(1, total_possible_deps))
        
        return {
            'token_efficiency': round(token_efficiency, 3),
            'size_consistency': round(size_consistency, 3),
            'priority_distribution': round(priority_distribution, 3),
            'context_type_balance': round(min(1.0, type_balance), 3),
            'dependency_optimization': round(dependency_optimization, 3),
            'overall_score': round((token_efficiency + size_consistency + 
                                  priority_distribution + dependency_optimization) / 4, 3)
        }
    
    def _generate_llm_recommendations(self, chunks: List[ContextChunk], 
                                    profile: Dict[str, Any]) -> List[str]:
        """Generate specific recommendations for LLM usage."""
        
        recommendations = []
        
        total_tokens = sum(chunk.token_estimate.total_tokens for chunk in chunks)
        max_tokens = profile['max_tokens']
        
        # Token management recommendations
        if total_tokens > max_tokens * 0.8:
            recommendations.append(
                f"Context uses {total_tokens:,} tokens ({total_tokens/max_tokens:.1%} of limit). "
                "Consider using progressive loading or summarization for optimal performance."
            )
        
        # Chunk ordering recommendations  
        core_chunks = [c for c in chunks if c.context_type == 'core']
        if core_chunks and chunks.index(core_chunks[0]) > 2:
            recommendations.append(
                "Core functionality chunks should be loaded earlier for better LLM understanding."
            )
        
        # Context type recommendations
        context_types = Counter(chunk.context_type for chunk in chunks)
        if context_types.get('documentation', 0) == 0:
            recommendations.append(
                "Consider including documentation chunks to provide context for the LLM."
            )
        
        # Complexity recommendations
        high_complexity_chunks = [c for c in chunks if c.priority_score > 50]
        if high_complexity_chunks:
            recommendations.append(
                f"{len(high_complexity_chunks)} chunks have high complexity. "
                "Provide additional context or break down further for better analysis."
            )
        
        # Dependency recommendations
        highly_dependent_chunks = [c for c in chunks if len(c.dependencies) > 5]
        if highly_dependent_chunks:
            recommendations.append(
                f"{len(highly_dependent_chunks)} chunks have many dependencies. "
                "Ensure dependency chunks are loaded first."
            )
        
        return recommendations
                # Generic categorization
                for line in lines:
                    stripped = line.strip()
                    if not stripped:
                        continue
                    elif stripped.startswith('#') or stripped.startswith('//'):
                        comment_lines.append(line)
                    else:
                        code_lines.append(line)
            
            # Estimate tokens (rough approximation: 1 token ≈ 4 characters for code)
            code_tokens = self._estimate_tokens_from_text('\n'.join(code_lines))
            comment_tokens = self._estimate_tokens_from_text('\n'.join(comment_lines))
            doc_tokens = self._estimate_tokens_from_text('\n'.join(doc_lines))
            
            return TokenEstimate(
                code_tokens=code_tokens,
                comments_tokens=comment_tokens,
                documentation_tokens=doc_tokens,
                total_tokens=code_tokens + comment_tokens + doc_tokens
            )
            
        except Exception as e:
            logger.warning(f"File token estimation failed for {file_path}: {e}")
            return TokenEstimate(code_tokens=500, comments_tokens=100, 
                               documentation_tokens=50, total_tokens=650)
    
    def _categorize_python_content(self, lines: List[str]) -> Tuple[List[str], List[str], List[str]]:
        """Categorize Python content into code, comments, and documentation."""
        code_lines = []
        comment_lines = []
        doc_lines = []
        
        in_docstring = False
        docstring_quotes = None
        
        for line in lines:
            stripped = line.strip()
            
            if not stripped:
                continue
            
            # Check for docstring start/end
            if '"""' in line or "'''" in line:
                if not in_docstring:
                    in_docstring = True
                    docstring_quotes = '"""' if '"""' in line else "'''"
                    doc_lines.append(line)
                elif docstring_quotes in line:
                    in_docstring = False
                    doc_lines.append(line)
                else:
                    doc_lines.append(line)
                continue
            
            if in_docstring:
                doc_lines.append(line)
            elif stripped.startswith('#'):
                comment_lines.append(line)
            else:
                code_lines.append(line)
        
        return code_lines, comment_lines, doc_lines
    
    def _categorize_js_content(self, lines: List[str]) -> Tuple[List[str], List[str], List[str]]:
        """Categorize JavaScript/TypeScript content."""
        code_lines = []
        comment_lines = []
        doc_lines = []
        
        in_block_comment = False
        in_jsdoc = False
        
        for line in lines:
            stripped = line.strip()
            
            if not stripped:
                continue
            
            # Handle block comments and JSDoc
            if '/*' in line:
                if '/**' in line:
                    in_jsdoc = True
                    doc_lines.append(line)
                else:
                    in_block_comment = True
                    comment_lines.append(line)
                continue
            
            if '*/' in line:
                if in_jsdoc:
                    in_jsdoc = False
                    doc_lines.append(line)
                else:
                    in_block_comment = False
                    comment_lines.append(line)
                continue
            
            if in_jsdoc:
                doc_lines.append(line)
            elif in_block_comment:
                comment_lines.append(line)
            elif stripped.startswith('//'):
                comment_lines.append(line)
            else:
                code_lines.append(line)
        
        return code_lines, comment_lines, doc_lines
    
    def _estimate_tokens_from_text(self, text: str) -> int:
        """Estimate token count from text using heuristics."""
        if not text.strip():
            return 0
        
        # Count words and symbols
        words = len(re.findall(r'\b\w+\b', text))
        symbols = len(re.findall(r'[^\w\s]', text))
        
        # Code tokens are typically shorter, so adjust the ratio
        estimated_tokens = int(words * 1.3 + symbols * 0.5)
        
        return max(1, estimated_tokens)
    
    def _create_context_chunks(self, clusters: List[List[str]], dep_graph: Dict[str, List[str]],
                             file_tokens: Dict[str, TokenEstimate], 
                             complexity_scores: Optional[Dict[str, float]],
                             profile: Dict[str, Any]) -> List[ContextChunk]:
        """Create optimized context chunks from clusters."""
        context_chunks = []
        target_size = profile['optimal_chunk_size']
        
        for i, cluster in enumerate(clusters):
            # Calculate total tokens for this cluster
            total_tokens = sum(file_tokens.get(f, TokenEstimate(0,0,0,0)).total_tokens 
                             for f in cluster)
            
            if total_tokens <= target_size:
                # Cluster fits in one chunk
                chunk = self._create_single_chunk(
                    f"cluster_{i}", cluster, dep_graph, file_tokens, complexity_scores)
                context_chunks.append(chunk)
            else:
                # Split cluster into multiple chunks
                sub_chunks = self._split_cluster_into_chunks(
                    cluster, dep_graph, file_tokens, complexity_scores, target_size, i)
                context_chunks.extend(sub_chunks)
        
        return context_chunks
    
    def _create_single_chunk(self, chunk_id: str, files: List[str], 
                           dep_graph: Dict[str, List[str]], 
                           file_tokens: Dict[str, TokenEstimate],
                           complexity_scores: Optional[Dict[str, float]]) -> ContextChunk:
        """Create a single context chunk."""
        
        # Calculate total tokens
        total_code_tokens = sum(file_tokens.get(f, TokenEstimate(0,0,0,0)).code_tokens for f in files)
        total_comment_tokens = sum(file_tokens.get(f, TokenEstimate(0,0,0,0)).comments_tokens for f in files)
        total_doc_tokens = sum(file_tokens.get(f, TokenEstimate(0,0,0,0)).documentation_tokens for f in files)
        
        token_estimate = TokenEstimate(
            code_tokens=total_code_tokens,
            comments_tokens=total_comment_tokens,
            documentation_tokens=total_doc_tokens,
            total_tokens=total_code_tokens + total_comment_tokens + total_doc_tokens
        )
        
        # Calculate priority score
        priority_score = self._calculate_chunk_priority(files, dep_graph, complexity_scores)
        
        # Determine context type
        context_type = self._determine_context_type(files)
        
        # Find dependencies
        dependencies = self._find_chunk_dependencies(files, dep_graph)
        
        # Generate content summary
        content_summary = self._generate_content_summary(files, dep_graph)
        
        return ContextChunk(
            chunk_id=chunk_id,
            files=files,
            content_summary=content_summary,
            token_estimate=token_estimate,
            priority_score=priority_score,
            dependencies=dependencies,
            context_type=context_type
        )
    
    def _split_cluster_into_chunks(self, cluster: List[str], dep_graph: Dict[str, List[str]],
                                 file_tokens: Dict[str, TokenEstimate], 
                                 complexity_scores: Optional[Dict[str, float]],
                                 target_size: int, cluster_id: int) -> List[ContextChunk]:
        """Split a large cluster into optimally-sized chunks."""
        
        # Sort files by priority
        file_priorities = []
        for file in cluster:
            complexity = complexity_scores.get(file, 1.0) if complexity_scores else 1.0
            dep_count = len(dep_graph.get(file, []))
            priority = complexity + (dep_count * 0.1)
            file_priorities.append((file, priority))
        
        file_priorities.sort(key=lambda x: x[1], reverse=True)
        
        chunks = []
        current_chunk_files = []
        current_chunk_tokens = 0
        
        for file, _ in file_priorities:
            file_token_count = file_tokens.get(file, TokenEstimate(0,0,0,0)).total_tokens
            
            if current_chunk_tokens + file_token_count <= target_size:
                current_chunk_files.append(file)
                current_chunk_tokens += file_token_count
            else
