import React from 'react';
import { AnalysisResult } from '../pages';

interface AnalysisResultsProps {
  result: AnalysisResult;
}

export const AnalysisResults: React.FC<AnalysisResultsProps> = ({ result }) => {
  return (
    <div className="analysis-results">
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Files Analyzed</h3>
          <p>{result.files.length}</p>
        </div>
        <div className="metric-card">
          <h3>Clusters Found</h3>
          <p>{result.clusters.length}</p>
        </div>
        <div className="metric-card">
          <h3>Avg Complexity</h3>
          <p>{result.metadata.avgComplexity.toFixed(1)}</p>
        </div>
        <div className="metric-card">
          <h3>Processing Time</h3>
          <p>{result.metadata.processingTimeMs}ms</p>
        </div>
      </div>
      
      <div className="files-list">
        <h3>Files by Complexity</h3>
        {result.files
          .sort((a, b) => b.complexity - a.complexity)
          .slice(0, 10)
          .map(file => (
            <div key={file.path} className="file-item">
              <span>{file.path}</span>
              <span className="complexity">{file.complexity}</span>
            </div>
          ))}
      </div>
    </div>
  );
};
