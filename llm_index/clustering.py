import networkx as nx
import numpy as np
from sklearn.cluster import SpectralClustering
from llm_index.constants import IGNORE_DIRS

def cluster_files(dep_graph, max_cluster_size=12):
    G = nx.DiGraph()
    files = list(dep_graph.keys())
    for src, deps in dep_graph.items():
        for dep in deps:
            dep_files = [f for f in files if dep in f or f.endswith(dep + '.py') or f.endswith(dep + '.js') or f.endswith(dep + '.ts')]
            for dfile in dep_files:
                if src != dfile:
                    G.add_edge(src, dfile)
    nodes = list(G.nodes)
    if len(nodes) <= max_cluster_size:
        return [nodes]
    adj = nx.to_numpy_array(G, nodelist=nodes)
    n_clusters = max(2, len(nodes) // max_cluster_size)
    clustering = SpectralClustering(
        n_clusters=n_clusters, affinity='precomputed', assign_labels='kmeans', random_state=42
    )
    labels = clustering.fit_predict(adj + adj.T)
    clusters = []
    for label in range(n_clusters):
        cluster = [nodes[i] for i in range(len(nodes)) if labels[i] == label]
        clusters.append(cluster)
    return clusters
