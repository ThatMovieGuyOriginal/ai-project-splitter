import networkx as nx
from collections import defaultdict
from llm_index.constants import IGNORE_DIRS

def cluster_files(dep_graph, max_cluster_size=12):
    """Lightweight clustering using community detection instead of scikit-learn"""
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
        return [nodes]
    
    # Use simple community detection instead of SpectralClustering
    clusters = simple_community_detection(G, max_cluster_size)
    return clusters

def simple_community_detection(G, max_size):
    """Simple community detection without scikit-learn"""
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
