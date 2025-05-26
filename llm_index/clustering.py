# llm_index/clustering.py
import networkx as nx
import math
from collections import defaultdict, Counter
from typing import Dict, List, Tuple, Optional
from llm_index.constants import IGNORE_DIRS
import logging

logger = logging.getLogger('llm-index.clustering')

class LightweightClusteringEngine:
    """Pure Python clustering without heavy dependencies."""
    
    def __init__(self, max_cluster_size: int = 12, min_cluster_size: int = 2):
        self.max_cluster_size = max_cluster_size
        self.min_cluster_size = min_cluster_size
        self.quality_metrics = {}
    
    def cluster_files(self, dep_graph: Dict[str, List[str]], 
                     complexity_scores: Optional[Dict[str, float]] = None) -> List[List[str]]:
        """Lightweight clustering using network analysis."""
        try:
            if not dep_graph:
                logger.warning("Empty dependency graph provided")
                return []
                
            files = list(dep_graph.keys())
            if len(files) <= self.max_cluster_size:
                return [files]
            
            # Build adjacency matrix using simple dict structure
            adjacency = self._build_adjacency_dict(dep_graph)
            
            # Use modularity-based clustering
            clusters = self._modularity_clustering(adjacency, complexity_scores or {})
            
            # Ensure size constraints
            optimized_clusters = self._enforce_size_constraints(clusters)
            
            # Calculate quality metrics
            self.quality_metrics = self._calculate_quality_metrics(optimized_clusters, adjacency)
            
            logger.info(f"Generated {len(optimized_clusters)} clusters")
            return optimized_clusters
            
        except Exception as e:
            logger.error(f"Clustering failed: {e}")
            return self._fallback_clustering(list(dep_graph.keys()))
    
    def _build_adjacency_dict(self, dep_graph: Dict[str, List[str]]) -> Dict[str, Dict[str, float]]:
        """Build weighted adjacency dictionary."""
        adjacency = defaultdict(lambda: defaultdict(float))
        files = list(dep_graph.keys())
        
        for src_file, deps in dep_graph.items():
            for dep in deps:
                # Find matching files
                targets = self._find_target_files(dep, files)
                for target in targets:
                    if src_file != target:
                        weight = self._calculate_edge_weight(src_file, target, dep)
                        adjacency[src_file][target] += weight
                        adjacency[target][src_file] += weight  # Undirected
        
        return adjacency
    
    def _find_target_files(self, dep: str, files: List[str]) -> List[str]:
        """Find files that match a dependency string."""
        targets = []
        dep_lower = dep.lower()
        
        for file in files:
            # Direct match
            if dep in file:
                targets.append(file)
            # Module name match
            elif file.endswith(f"{dep}.py") or file.endswith(f"{dep}.js") or file.endswith(f"{dep}.ts"):
                targets.append(file)
            # Partial path match
            elif dep_lower in file.lower():
                targets.append(file)
                
        return targets
    
    def _calculate_edge_weight(self, src_file: str, target_file: str, dep: str) -> float:
        """Calculate edge weight between two files."""
        weight = 1.0
        
        # Boost weight for exact matches
        if dep in target_file:
            weight += 0.5
        
        # Boost weight for same-directory files
        import os
        if os.path.dirname(src_file) == os.path.dirname(target_file):
            weight += 0.3
        
        return weight
    
    def _modularity_clustering(self, adjacency: Dict[str, Dict[str, float]], 
                             complexity_scores: Dict[str, float]) -> List[List[str]]:
        """Simple modularity-based clustering."""
        nodes = list(adjacency.keys())
        clusters = [[node] for node in nodes]  # Start with each node in its own cluster
        
        improved = True
        iterations = 0
        max_iterations = min(50, len(nodes))
        
        while improved and iterations < max_iterations:
            improved = False
            iterations += 1
            
            best_gain = 0
            best_merge = None
            
            for i in range(len(clusters)):
                for j in range(i + 1, len(clusters)):
                    if len(clusters[i]) + len(clusters[j]) <= self.max_cluster_size:
                        # Calculate modularity gain
                        gain = self._modularity_gain(clusters[i], clusters[j], adjacency)
                        
                        # Add complexity-based bonus
                        if complexity_scores:
                            gain += self._complexity_bonus(clusters[i], clusters[j], complexity_scores)
                        
                        if gain > best_gain and gain > 0.05:  # Threshold for merging
                            best_gain = gain
                            best_merge = (i, j)
            
            if best_merge:
                i, j = best_merge
                clusters[i].extend(clusters[j])
                clusters.pop(j)
                improved = True
        
        return [cluster for cluster in clusters if cluster]
    
    def _complexity_bonus(self, cluster1: List[str], cluster2: List[str], 
                         complexity_scores: Dict[str, float]) -> float:
        """Calculate complexity-based clustering bonus."""
        avg_complexity_1 = sum(complexity_scores.get(f, 1) for f in cluster1) / len(cluster1)
        avg_complexity_2 = sum(complexity_scores.get(f, 1) for f in cluster2) / len(cluster2)
        
        # Bonus for similar complexity levels
        complexity_diff = abs(avg_complexity_1 - avg_complexity_2)
        if complexity_diff < 20:  # Similar complexity
            return 0.1
        return 0
    
    def _modularity_gain(self, cluster1: List[str], cluster2: List[str], 
                        adjacency: Dict[str, Dict[str, float]]) -> float:
        """Calculate modularity gain from merging two clusters."""
        # Count edges between clusters
        inter_edges = 0
        total_weight = 0
        
        for node1 in cluster1:
            for node2 in cluster2:
                weight = adjacency[node1].get(node2, 0)
                if weight > 0:
                    inter_edges += 1
                    total_weight += weight
        
        # Calculate normalized gain
        total_possible = len(cluster1) * len(cluster2)
        edge_density = inter_edges / max(1, total_possible)
        weight_density = total_weight / max(1, total_possible)
        
        return (edge_density + weight_density) / 2
    
    def _enforce_size_constraints(self, clusters: List[List[str]]) -> List[List[str]]:
        """Ensure clusters don't exceed size limits."""
        result = []
        
        for cluster in clusters:
            if len(cluster) <= self.max_cluster_size:
                if len(cluster) >= self.min_cluster_size:
                    result.append(cluster)
                else:
                    # Handle small clusters
                    result.extend(self._handle_small_cluster(cluster, result))
            else:
                # Split large clusters
                result.extend(self._split_large_cluster(cluster))
        
        return [cluster for cluster in result if cluster]
    
    def _handle_small_cluster(self, small_cluster: List[str], 
                            existing_clusters: List[List[str]]) -> List[List[str]]:
        """Handle clusters that are too small."""
        if not existing_clusters:
            return [small_cluster]
        
        # Try to merge with the most compatible existing cluster
        best_cluster_idx = -1
        best_compatibility = 0
        
        for i, existing_cluster in enumerate(existing_clusters):
            if len(existing_cluster) + len(small_cluster) <= self.max_cluster_size:
                # Simple compatibility score based on file paths
                compatibility = self._calculate_path_similarity(small_cluster, existing_cluster)
                if compatibility > best_compatibility:
                    best_compatibility = compatibility
                    best_cluster_idx = i
        
        if best_cluster_idx >= 0:
            existing_clusters[best_cluster_idx].extend(small_cluster)
            return []
        else:
            return [small_cluster]
    
    def _calculate_path_similarity(self, cluster1: List[str], cluster2: List[str]) -> float:
        """Calculate similarity between clusters based on file paths."""
        import os
        
        dirs1 = set(os.path.dirname(f) for f in cluster1)
        dirs2 = set(os.path.dirname(f) for f in cluster2)
        
        if not dirs1 or not dirs2:
            return 0.0
        
        intersection = len(dirs1 & dirs2)
        union = len(dirs1 | dirs2)
        
        return intersection / max(1, union)
    
    def _split_large_cluster(self, large_cluster: List[str]) -> List[List[str]]:
        """Split large clusters into smaller ones."""
        if len(large_cluster) <= self.max_cluster_size:
            return [large_cluster]
        
        # Simple chunking strategy
        chunks = []
        chunk_size = self.max_cluster_size
        
        for i in range(0, len(large_cluster), chunk_size):
            chunks.append(large_cluster[i:i + chunk_size])
        
        return chunks
    
    def _calculate_quality_metrics(self, clusters: List[List[str]], 
                                 adjacency: Dict[str, Dict[str, float]]) -> Dict[str, float]:
        """Calculate clustering quality metrics."""
        if not clusters:
            return {}
        
        try:
            # Modularity calculation
            modularity = self._calculate_modularity(clusters, adjacency)
            
            # Size balance
            sizes = [len(cluster) for cluster in clusters]
            size_variance = sum((size - sum(sizes)/len(sizes))**2 for size in sizes) / len(sizes)
            size_balance = 1.0 / (1.0 + math.sqrt(size_variance))
            
            return {
                'modularity': modularity,
                'size_balance': size_balance,
                'n_clusters': len(clusters),
                'avg_cluster_size': sum(sizes) / len(sizes)
            }
        except Exception as e:
            logger.warning(f"Quality metrics calculation failed: {e}")
            return {}
    
    def _calculate_modularity(self, clusters: List[List[str]], 
                            adjacency: Dict[str, Dict[str, float]]) -> float:
        """Calculate Newman's modularity."""
        if not adjacency:
            return 0.0
        
        # Create cluster membership map
        node_to_cluster = {}
        for i, cluster in enumerate(clusters):
            for node in cluster:
                node_to_cluster[node] = i
        
        # Calculate total edge weight
        total_weight = 0
        for node, neighbors in adjacency.items():
            total_weight += sum(neighbors.values())
        
        if total_weight == 0:
            return 0.0
        
        total_weight /= 2  # Each edge counted twice
        
        # Calculate modularity
        modularity = 0.0
        for node, neighbors in adjacency.items():
            node_cluster = node_to_cluster.get(node)
            node_degree = sum(neighbors.values())
            
            for neighbor, weight in neighbors.items():
                neighbor_cluster = node_to_cluster.get(neighbor)
                neighbor_degree = sum(adjacency.get(neighbor, {}).values())
                
                if node_cluster == neighbor_cluster:
                    expected = (node_degree * neighbor_degree) / (2 * total_weight)
                    modularity += weight - expected
        
        return modularity / (2 * total_weight) if total_weight > 0 else 0.0
    
    def _fallback_clustering(self, files: List[str]) -> List[List[str]]:
        """Simple fallback clustering when advanced methods fail."""
        chunk_size = self.max_cluster_size
        return [files[i:i + chunk_size] for i in range(0, len(files), chunk_size)]

def cluster_files(dep_graph: Dict[str, List[str]], max_cluster_size: int = 12, 
                 complexity_scores: Optional[Dict[str, float]] = None) -> List[List[str]]:
    """Enhanced clustering function using lightweight optimization."""
    try:
        engine = LightweightClusteringEngine(max_cluster_size=max_cluster_size)
        clusters = engine.cluster_files(dep_graph, complexity_scores)
        
        # Log quality metrics
        if hasattr(engine, 'quality_metrics') and engine.quality_metrics:
            logger.info(f"Clustering quality: {engine.quality_metrics}")
        
        return clusters
    except Exception as e:
        logger.error(f"Clustering failed: {e}")
        # Ultimate fallback
        files = list(dep_graph.keys())
        chunk_size = max_cluster_size
        return [files[i:i + chunk_size] for i in range(0, len(files), chunk_size)]

def simple_clustering_fallback(dep_graph, max_cluster_size=12):
    """Fallback to simple clustering if enhanced clustering fails."""
    try:
        G = nx.DiGraph()
        files = list(dep_graph.keys())
        
        # Build dependency graph
        for src, deps in dep_graph.items():
            for dep in deps:
                dep_files = [f for f in files if dep in f or f.endswith(dep + '.py') or f.endswith(dep + '.js') or f.endswith(dep + '.ts')]
                for dfile in dep_files:
                    if src != dfile:
                        G.add_edge(src, dfile)
        
        nodes = list(G.nodes)
        if len(nodes) <= max_cluster_size:
            return [nodes] if nodes else []
        
        # Use simple community detection
        clusters = simple_community_detection(G, max_cluster_size)
        return clusters
        
    except Exception as e:
        logger.error(f"Simple clustering fallback failed: {e}")
        # Ultimate fallback - just chunk the files
        files = list(dep_graph.keys())
        chunk_size = max_cluster_size
        return [files[i:i + chunk_size] for i in range(0, len(files), chunk_size)]

def simple_community_detection(G, max_size):
    """Simple community detection without external dependencies."""
    try:
        # Convert to undirected for community detection
        UG = G.to_undirected()
        
        # Use connected components and break large ones
        components = list(nx.connected_components(UG))
        clusters = []
        
        for component in components:
            component_list = list(component)
            if len(component_list) <= max_size:
                clusters.append(component_list)
            else:
                # Break large components into smaller chunks
                for i in range(0, len(component_list), max_size):
                    clusters.append(component_list[i:i + max_size])
        
        return clusters
        
    except Exception as e:
        logger.error(f"Community detection failed: {e}")
        # Final fallback
        all_nodes = list(G.nodes())
        return [all_nodes[i:i + max_size] for i in range(0, len(all_nodes), max_size)]
