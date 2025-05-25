def generate_report(dep_graph, clusters):
    # Dry-run report for dashboard and manifest
    report = []
    cluster_map = {file: idx for idx, cluster in enumerate(clusters) for file in cluster}
    for idx, cluster in enumerate(clusters):
        files = [file for file in cluster]
        report.append({
            "cluster": idx,
            "files": files,
            "cross_cluster_deps": []
        })
    # Cross-cluster edges
    for src, deps in dep_graph.items():
        for dep in deps:
            for tgt, tgt_idx in cluster_map.items():
                if dep in tgt and cluster_map.get(src) != tgt_idx:
                    report[cluster_map[src]]["cross_cluster_deps"].append({
                        "from": src,
                        "to": tgt
                    })
    return report
