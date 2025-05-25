try:
    from llm_index.llm_optimization import LLMContextOptimizer
    LLM_OPTIMIZATION_AVAILABLE = True
except ImportError:
    LLM_OPTIMIZATION_AVAILABLE = False

import logging

logger = logging.getLogger('llm-index.reporting')

def generate_report(dep_graph, clusters, complexity_scores=None, debt_analysis=None):
    """Enhanced reporting with technical debt and LLM optimization insights."""
    try:
        # Basic cluster report
        report = []
        cluster_map = {file: idx for idx, cluster in enumerate(clusters) for file in cluster}
        
        for idx, cluster in enumerate(clusters):
            files = [file for file in cluster]
            cluster_info = {
                "cluster": idx,
                "files": files,
                "file_count": len(files),
                "cross_cluster_deps": []
            }
            
            # Add complexity information if available
            if complexity_scores:
                cluster_complexities = [complexity_scores.get(f, 0) for f in files]
                if cluster_complexities:
                    cluster_info["avg_complexity"] = sum(cluster_complexities) / len(cluster_complexities)
                    cluster_info["max_complexity"] = max(cluster_complexities)
                    cluster_info["complexity_distribution"] = {
                        "low": len([c for c in cluster_complexities if c < 30]),
                        "medium": len([c for c in cluster_complexities if 30 <= c < 70]),
                        "high": len([c for c in cluster_complexities if c >= 70])
                    }
            
            report.append(cluster_info)
        
        # Cross-cluster dependencies
        for src, deps in dep_graph.items():
            src_cluster = cluster_map.get(src)
            if src_cluster is not None:
                for dep in deps:
                    for tgt, tgt_idx in cluster_map.items():
                        if dep in tgt and src_cluster != tgt_idx:
                            report[src_cluster]["cross_cluster_deps"].append({
                                "from": src,
                                "to": tgt,
                                "dependency": dep
                            })
        
        # Add LLM optimization insights
        if LLM_OPTIMIZATION_AVAILABLE:
            try:
                optimizer = LLMContextOptimizer()
                llm_optimization = optimizer.optimize_for_llm(
                    clusters, dep_graph, complexity_scores)
                
                # Add optimization metrics to report
                for i, cluster_info in enumerate(report):
                    matching_chunks = [chunk for chunk in llm_optimization.get('context_chunks', [])
                                     if f"cluster_{i}" in chunk.get('chunk_id', '')]
                    if matching_chunks:
                        chunk = matching_chunks[0]
                        cluster_info["llm_optimization"] = {
                            "token_estimate": chunk.get('token_estimate', {}),
                            "priority_score": chunk.get('priority_score', 0),
                            "context_type": chunk.get('context_type', 'unknown'),
                            "content_summary": chunk.get('content_summary', '')
                        }
                
            except Exception as e:
                logger.warning(f"LLM optimization failed: {e}")
        
        # Add technical debt summary if available
        if debt_analysis and isinstance(debt_analysis, dict):
            summary = debt_analysis.get('summary', {})
            report.append({
                "cluster": "technical_debt_summary",
                "total_debt_items": summary.get('total_debt_items', 0),
                "average_complexity": summary.get('average_complexity_score', 0),
                "health_grade": summary.get('overall_health_grade', 'N/A'),
                "high_complexity_files": summary.get('high_complexity_files', 0)
            })
        
        return report
        
    except Exception as e:
        logger.error(f"Enhanced reporting failed: {e}")
        # Fallback to basic reporting
        return generate_basic_report(dep_graph, clusters)

def generate_basic_report(dep_graph, clusters):
    """Fallback basic report generation."""
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
                    if cluster_map.get(src) is not None:
                        report[cluster_map[src]]["cross_cluster_deps"].append({
                            "from": src,
                            "to": tgt
                        })
    
    return report
