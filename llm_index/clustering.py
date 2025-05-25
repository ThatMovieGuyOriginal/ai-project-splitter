try:
    from llm_index.enhanced_clustering import EnhancedClusteringEngine
    ENHANCED_AVAILABLE = True
except ImportError:
    ENHANCED_AVAILABLE = False

import networkx as nx
from collections import defaultdict
from llm_index.constants import IGNORE_DIRS
import logging

logger = logging.getLogger('llm-index.clustering')

def cluster_files(dep_graph, max_cluster_size=12, complexity_scores=None):
    """Enhanced clustering using mathematical optimization and spectral analysis."""
    try:
        if ENHANCED_AVAILABLE:
            engine = EnhancedClusteringEngine(max_cluster_size=max_cluster_size)
            clusters = engine.cluster_files(dep_graph, complexity_scores)
            
            # Log quality metrics for monitoring
            if hasattr(engine, 'quality_metrics') and engine.quality_metrics:
                logger.info(f"Clustering quality metrics: {engine.quality_metrics}")
            
            return clusters
        else:
            logger.warning("Enhanced clustering not available, using simple clustering")
            return simple_clustering_fallback(dep_graph, max_cluster_size)
        
    except Exception as e:
        logger.error(f"Enhanced clustering failed, falling back to simple clustering: {e}")
        return simple_clustering_fallback(dep_graph, max_cluster_size)

def simple_clustering_fallback(dep_graph, max_cluster_size=12):
    """Fallback to original simple clustering if enhanced clustering fails."""
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
    """Simple community detection without scikit-learn"""
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
