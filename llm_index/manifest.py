def generate_manifest(dep_graph, clusters, entry_points=None):
    """
    Outputs a manifest for LLM/agent use: files, clusters, deps, entry points.
    """
    cluster_map = {file: idx for idx, cluster in enumerate(clusters) for file in cluster}
    manifest = {
        "files": list(dep_graph.keys()),
        "clusters": [
            {"id": idx, "files": cluster}
            for idx, cluster in enumerate(clusters)
        ],
        "file_to_cluster": cluster_map,
        "dependencies": dep_graph,
        "entry_points": entry_points or []
    }
    return manifest
