import networkx as nx
import numpy as np
from collections import defaultdict, Counter
from typing import Dict, List, Tuple, Set, Optional
import logging
import math
from scipy import sparse
from scipy.sparse.linalg import eigsh
from sklearn.cluster import SpectralClustering
from llm_index.constants import IGNORE_DIRS

logger = logging.getLogger('llm-index.clustering')

class EnhancedClusteringEngine:
    """
    Advanced clustering engine using spectral analysis, information theory,
    and mathematical rigor for optimal code organization.
    """
    
    def __init__(self, max_cluster_size: int = 12, min_cluster_size: int = 2):
        self.max_cluster_size = max_cluster_size
        self.min_cluster_size = min_cluster_size
        self.quality_metrics = {}
        
    def cluster_files(self, dep_graph: Dict[str, List[str]], 
                     complexity_scores: Optional[Dict[str, float]] = None) -> List[List[str]]:
        """
        Enhanced clustering with spectral analysis and quality optimization.
        
        Args:
            dep_graph: File dependency graph
            complexity_scores: Optional complexity scores for each file
            
        Returns:
            List of file clusters optimized for LLM context
        """
        try:
            if not dep_graph:
                logger.warning("Empty dependency graph provided")
                return []
                
            files = list(dep_graph.keys())
            if len(files) <= self.max_cluster_size:
                return [files]
            
            # Build enhanced weighted graph
            G = self._build_enhanced_graph(dep_graph, complexity_scores)
            
            # Apply spectral clustering
            initial_clusters = self._spectral_clustering(G, files)
            
            # Optimize clusters for size constraints and quality
            optimized_clusters = self._optimize_clusters(initial_clusters, G)
            
            # Calculate and store quality metrics
            self.quality_metrics = self._calculate_quality_metrics(optimized_clusters, G)
            
            logger.info(f"Generated {len(optimized_clusters)} clusters with modularity: {self.quality_metrics.get('modularity', 0):.3f}")
            
            return optimized_clusters
            
        except Exception as e:
            logger.error(f"Clustering failed: {e}")
            # Fallback to simple clustering
            return self._fallback_clustering(list(dep_graph.keys()))
    
    def _build_enhanced_graph(self, dep_graph: Dict[str, List[str]], 
                            complexity_scores: Optional[Dict[str, float]] = None) -> nx.Graph:
        """Build weighted graph with mutual information and complexity weighting."""
        G = nx.Graph()
        files = list(dep_graph.keys())
        
        # Add nodes with attributes
        for file in files:
            complexity = complexity_scores.get(file, 1.0) if complexity_scores else 1.0
            G.add_node(file, complexity=complexity, degree_centrality=0)
        
        # Calculate mutual information for edge weighting
        file_deps = {f: set(deps) for f, deps in dep_graph.items()}
        
        for src_file, src_deps in dep_graph.items():
            for dep in src_deps:
                # Find actual target files that match this dependency
                target_files = self._find_target_files(dep, files)
                
                for target_file in target_files:
                    if src_file != target_file:
                        # Calculate mutual information weight
                        weight = self._calculate_mutual_information(
                            src_file, target_file, file_deps)
                        
                        # Add complexity weighting
                        if complexity_scores:
                            complexity_factor = (complexity_scores.get(src_file, 1.0) + 
                                              complexity_scores.get(target_file, 1.0)) / 2
                            weight *= (1 + math.log(complexity_factor))
                        
                        if weight > 0:
                            G.add_edge(src_file, target_file, weight=weight)
        
        # Calculate centrality measures
        centrality = nx.degree_centrality(G)
        nx.set_node_attributes(G, centrality, 'degree_centrality')
        
        return G
    
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
    
    def _calculate_mutual_information(self, file1: str, file2: str, 
                                    file_deps: Dict[str, Set[str]]) -> float:
        """Calculate mutual information between two files based on shared dependencies."""
        deps1 = file_deps.get(file1, set())
        deps2 = file_deps.get(file2, set())
        
        if not deps1 and not deps2:
            return 0.0
            
        # Calculate mutual information
        intersection = len(deps1 & deps2)
        union = len(deps1 | deps2)
        
        if union == 0:
            return 0.0
            
        # Normalized mutual information
        if intersection > 0:
            p_xy = intersection / union
            p_x = len(deps1) / union if union > 0 else 0
            p_y = len(deps2) / union if union > 0 else 0
            
            if p_x > 0 and p_y > 0 and p_xy > 0:
                mi = p_xy * math.log2(p_xy / (p_x * p_y))
                return max(0, mi)
        
        return 0.0
    
    def _spectral_clustering(self, G: nx.Graph, files: List[str]) -> List[List[str]]:
        """Apply spectral clustering to the enhanced graph."""
        if len(files) < 4:  # Too few nodes for spectral clustering
            return [files]
            
        try:
            # Create adjacency matrix
            nodes = list(G.nodes())
            node_to_idx = {node: i for i, node in enumerate(nodes)}
            
            n = len(nodes)
            adj_matrix = np.zeros((n, n))
            
            for edge in G.edges(data=True):
                i, j = node_to_idx[edge[0]], node_to_idx[edge[1]]
                weight = edge[2].get('weight', 1.0)
                adj_matrix[i, j] = weight
                adj_matrix[j, i] = weight
            
            # Determine optimal number of clusters
            n_clusters = min(max(2, n // self.max_cluster_size), 8)
            
            # Apply spectral clustering
            if np.sum(adj_matrix) > 0:  # Has edges
                clustering = SpectralClustering(
                    n_clusters=n_clusters,
                    affinity='precomputed',
                    random_state=42,
                    assign_labels='discretize'
                )
                labels = clustering.fit_predict(adj_matrix)
            else:
                # No edges, use simple partitioning
                labels = np.arange(n) % n_clusters
            
            # Group files by cluster labels
            clusters = defaultdict(list)
            for i, label in enumerate(labels):
                clusters[label].append(nodes[i])
                
            return list(clusters.values())
            
        except Exception as e:
            logger.warning(f"Spectral clustering failed: {e}, falling back to community detection")
            return self._community_detection_fallback(G)
    
    def _community_detection_fallback(self, G: nx.Graph) -> List[List[str]]:
        """Fallback community detection when spectral clustering fails."""
        try:
            # Use Louvain community detection if available
            if hasattr(nx, 'community') and hasattr(nx.community, 'louvain_communities'):
                communities = nx.community.louvain_communities(G, seed=42)
                return [list(community) for community in communities]
            else:
                # Simple connected components
                components = list(nx.connected_components(G))
                return [list(component) for component in components]
        except Exception as e:
            logger.error(f"Community detection fallback failed: {e}")
            return self._fallback_clustering(list(G.nodes()))
    
    def _optimize_clusters(self, clusters: List[List[str]], G: nx.Graph) -> List[List[str]]:
        """Optimize clusters for size constraints and quality."""
        optimized = []
        
        for cluster in clusters:
            if len(cluster) <= self.max_cluster_size:
                if len(cluster) >= self.min_cluster_size:
                    optimized.append(cluster)
                else:
                    # Too small, try to merge with most connected cluster
                    optimized.extend(self._handle_small_cluster(cluster, optimized, G))
            else:
                # Too large, split intelligently
                split_clusters = self._split_large_cluster(cluster, G)
                optimized.extend(split_clusters)
        
        # Handle remaining small clusters
        optimized = self._merge_small_clusters(optimized, G)
        
        return [cluster for cluster in optimized if cluster]  # Remove empty clusters
    
    def _handle_small_cluster(self, small_cluster: List[str], 
                            existing_clusters: List[List[str]], 
                            G: nx.Graph) -> List[List[str]]:
        """Handle clusters that are too small."""
        if not existing_clusters:
            return [small_cluster]  # Keep it for now
            
        # Find best cluster to merge with based on connectivity
        best_merge_idx = -1
        best_connectivity = 0
        
        for i, existing_cluster in enumerate(existing_clusters):
            if len(existing_cluster) + len(small_cluster) <= self.max_cluster_size:
                connectivity = self._calculate_inter_cluster_connectivity(
                    small_cluster, existing_cluster, G)
                if connectivity > best_connectivity:
                    best_connectivity = connectivity
                    best_merge_idx = i
        
        if best_merge_idx >= 0:
            existing_clusters[best_merge_idx].extend(small_cluster)
            return []
        else:
            return [small_cluster]  # Keep separate if no good merge found
    
    def _split_large_cluster(self, large_cluster: List[str], G: nx.Graph) -> List[List[str]]:
        """Split large clusters using subgraph analysis."""
        if len(large_cluster) <= self.max_cluster_size:
            return [large_cluster]
            
        # Create subgraph
        subgraph = G.subgraph(large_cluster)
        
        # Apply recursive spectral clustering on subgraph
        try:
            n_splits = math.ceil(len(large_cluster) / self.max_cluster_size)
            sub_clusters = self._spectral_clustering(subgraph, large_cluster)
            
            # If spectral clustering didn't split enough, use simple partitioning
            if len(sub_clusters) < n_splits:
                chunk_size = self.max_cluster_size
                sub_clusters = [large_cluster[i:i + chunk_size] 
                              for i in range(0, len(large_cluster), chunk_size)]
            
            return sub_clusters
            
        except Exception as e:
            logger.warning(f"Cluster splitting failed: {e}")
            # Simple chunking fallback
            chunk_size = self.max_cluster_size
            return [large_cluster[i:i + chunk_size] 
                   for i in range(0, len(large_cluster), chunk_size)]
    
    def _merge_small_clusters(self, clusters: List[List[str]], G: nx.Graph) -> List[List[str]]:
        """Merge remaining small clusters."""
        small_clusters = [i for i, cluster in enumerate(clusters) 
                         if len(cluster) < self.min_cluster_size]
        
        if not small_clusters:
            return clusters
        
        # Try to merge small clusters with each other or with larger ones
        merged = list(clusters)  # Copy
        
        for i in reversed(small_clusters):  # Reverse to maintain indices
            small_cluster = merged[i]
            best_merge_target = self._find_best_merge_target(small_cluster, merged, i, G)
            
            if best_merge_target >= 0:
                merged[best_merge_target].extend(small_cluster)
                merged.pop(i)
        
        return merged
    
    def _find_best_merge_target(self, small_cluster: List[str], 
                              all_clusters: List[List[str]], 
                              exclude_idx: int, G: nx.Graph) -> int:
        """Find the best cluster to merge a small cluster with."""
        best_idx = -1
        best_score = 0
        
        for i, target_cluster in enumerate(all_clusters):
            if i == exclude_idx:
                continue
                
            if len(target_cluster) + len(small_cluster) <= self.max_cluster_size:
                connectivity = self._calculate_inter_cluster_connectivity(
                    small_cluster, target_cluster, G)
                
                # Prefer merging with other small clusters
                size_bonus = 1.0 if len(target_cluster) < self.min_cluster_size else 0.5
                score = connectivity * size_bonus
                
                if score > best_score:
                    best_score = score
                    best_idx = i
        
        return best_idx
    
    def _calculate_inter_cluster_connectivity(self, cluster1: List[str], 
                                           cluster2: List[str], G: nx.Graph) -> float:
        """Calculate connectivity between two clusters."""
        total_edges = 0
        total_weight = 0.0
        
        for node1 in cluster1:
            for node2 in cluster2:
                if G.has_edge(node1, node2):
                    total_edges += 1
                    total_weight += G[node1][node2].get('weight', 1.0)
        
        # Normalize by potential connections
        max_connections = len(cluster1) * len(cluster2)
        return total_weight / max_connections if max_connections > 0 else 0.0
    
    def _calculate_quality_metrics(self, clusters: List[List[str]], G: nx.Graph) -> Dict[str, float]:
        """Calculate comprehensive quality metrics for the clustering."""
        if not clusters or not G.nodes():
            return {}
            
        try:
            # Modularity
            modularity = self._calculate_modularity(clusters, G)
            
            # Silhouette coefficient approximation
            silhouette = self._calculate_clustering_silhouette(clusters, G)
            
            # Intra-cluster density
            intra_density = self._calculate_average_intra_cluster_density(clusters, G)
            
            # Inter-cluster separation
            inter_separation = self._calculate_inter_cluster_separation(clusters, G)
            
            # Size balance (how well-balanced are cluster sizes)
            size_balance = self._calculate_size_balance(clusters)
            
            return {
                'modularity': modularity,
                'silhouette': silhouette,
                'intra_density': intra_density,
                'inter_separation': inter_separation,
                'size_balance': size_balance,
                'n_clusters': len(clusters),
                'total_nodes': sum(len(cluster) for cluster in clusters)
            }
            
        except Exception as e:
            logger.error(f"Quality metrics calculation failed: {e}")
            return {'error': str(e)}
    
    def _calculate_modularity(self, clusters: List[List[str]], G: nx.Graph) -> float:
        """Calculate Newman's modularity for the clustering."""
        if not G.edges():
            return 0.0
            
        node_to_cluster = {}
        for i, cluster in enumerate(clusters):
            for node in cluster:
                node_to_cluster[node] = i
        
        m = G.number_of_edges()
        if m == 0:
            return 0.0
            
        modularity = 0.0
        
        for edge in G.edges(data=True):
            u, v = edge[0], edge[1]
            weight = edge[2].get('weight', 1.0)
            
            if node_to_cluster.get(u) == node_to_cluster.get(v):
                # Same cluster
                degree_u = G.degree(u, weight='weight')
                degree_v = G.degree(v, weight='weight')
                expected = (degree_u * degree_v) / (2 * m)
                modularity += weight - expected
        
        return modularity / (2 * m)
    
    def _calculate_clustering_silhouette(self, clusters: List[List[str]], G: nx.Graph) -> float:
        """Calculate approximate silhouette coefficient for graph clustering."""
        if len(clusters) <= 1:
            return 0.0
            
        node_to_cluster = {}
        for i, cluster in enumerate(clusters):
            for node in cluster:
                node_to_cluster[node] = i
        
        silhouette_scores = []
        
        for node in G.nodes():
            cluster_id = node_to_cluster[node]
            
            # Average distance to nodes in same cluster
            same_cluster_nodes = [n for n in clusters[cluster_id] if n != node]
            if same_cluster_nodes:
                a = np.mean([1.0 / (G[node][neighbor].get('weight', 1.0) + 1e-6) 
                           for neighbor in same_cluster_nodes if G.has_edge(node, neighbor)])
            else:
                a = 0.0
            
            # Average distance to nodes in nearest other cluster
            other_cluster_distances = []
            for i, other_cluster in enumerate(clusters):
                if i != cluster_id:
                    distances = [1.0 / (G[node][neighbor].get('weight', 1.0) + 1e-6)
                               for neighbor in other_cluster if G.has_edge(node, neighbor)]
                    if distances:
                        other_cluster_distances.append(np.mean(distances))
            
            if other_cluster_distances:
                b = min(other_cluster_distances)
                if max(a, b) > 0:
                    silhouette_scores.append((b - a) / max(a, b))
        
        return np.mean(silhouette_scores) if silhouette_scores else 0.0
    
    def _calculate_average_intra_cluster_density(self, clusters: List[List[str]], G: nx.Graph) -> float:
        """Calculate average density within clusters."""
        densities = []
        
        for cluster in clusters:
            if len(cluster) < 2:
                continue
                
            subgraph = G.subgraph(cluster)
            possible_edges = len(cluster) * (len(cluster) - 1) / 2
            actual_edges = subgraph.number_of_edges()
            
            density = actual_edges / possible_edges if possible_edges > 0 else 0.0
            densities.append(density)
        
        return np.mean(densities) if densities else 0.0
    
    def _calculate_inter_cluster_separation(self, clusters: List[List[str]], G: nx.Graph) -> float:
        """Calculate separation between clusters (lower is better separation)."""
        if len(clusters) < 2:
            return 1.0
            
        total_inter_edges = 0
        total_possible_inter = 0
        
        for i in range(len(clusters)):
            for j in range(i + 1, len(clusters)):
                cluster1, cluster2 = clusters[i], clusters[j]
                
                inter_edges = sum(1 for n1 in cluster1 for n2 in cluster2 
                                if G.has_edge(n1, n2))
                possible_inter = len(cluster1) * len(cluster2)
                
                total_inter_edges += inter_edges
                total_possible_inter += possible_inter
        
        return total_inter_edges / total_possible_inter if total_possible_inter > 0 else 0.0
    
    def _calculate_size_balance(self, clusters: List[List[str]]) -> float:
        """Calculate how balanced the cluster sizes are (1.0 = perfectly balanced)."""
        if not clusters:
            return 0.0
            
        sizes = [len(cluster) for cluster in clusters]
        mean_size = np.mean(sizes)
        
        if mean_size == 0:
            return 1.0
            
        # Coefficient of variation (lower is more balanced)
        cv = np.std(sizes) / mean_size
        
        # Convert to balance score (1.0 = perfectly balanced, 0.0 = very imbalanced)
        return 1.0 / (1.0 + cv)
    
    def _fallback_clustering(self, files: List[str]) -> List[List[str]]:
        """Simple fallback clustering when advanced methods fail."""
        chunk_size = self.max_cluster_size
        return [files[i:i + chunk_size] for i in range(0, len(files), chunk_size)]

# Update the main clustering function to use the enhanced engine
def cluster_files(dep_graph: Dict[str, List[str]], max_cluster_size: int = 12, 
                 complexity_scores: Optional[Dict[str, float]] = None) -> List[List[str]]:
    """
    Enhanced clustering function using mathematical optimization.
    
    Args:
        dep_graph: File dependency graph
        max_cluster_size: Maximum files per cluster
        complexity_scores: Optional complexity scores for files
        
    Returns:
        Optimized file clusters
    """
    engine = EnhancedClusteringEngine(max_cluster_size=max_cluster_size)
    clusters = engine.cluster_files(dep_graph, complexity_scores)
    
    # Log quality metrics
    if hasattr(engine, 'quality_metrics') and engine.quality_metrics:
        logger.info(f"Clustering quality: {engine.quality_metrics}")
    
    return clusters
