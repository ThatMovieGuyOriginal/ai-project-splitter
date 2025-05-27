import React from 'react';

interface ClusterVisualizationProps {
  clusters: any[];
  depGraph: Record<string, string[]>;
}

const ClusterVisualization: React.FC<ClusterVisualizationProps> = ({ clusters, depGraph }) => {
  return (
    <div className="cluster-viz">
      <div className="clusters-grid">
        {clusters.map((cluster, index) => (
          <div key={cluster.id || index} className="cluster-card">
            <h4>Cluster {index + 1}</h4>
            <p>{cluster.files?.length || 0} files</p>
            <p>Avg Complexity: {cluster.avgComplexity?.toFixed(1) || 'N/A'}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClusterVisualization;
