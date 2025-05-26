// pages/index.tsx
import { useState, useEffect } from 'react';
import Link from "next/link";

interface AnalysisResult {
  dep_graph: Record<string, string[]>;
  clusters: string[][];
  report: any[];
  complexity_scores: Record<string, number>;
  debt_analysis: any;
  metadata: {
    total_files: number;
    total_clusters: number;
    processing_time_seconds: number;
    avg_complexity: number;
    debt_items: number;
  };
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5MB.');
      return;
    }

    setError(null);
    setLoading(true);
    setUploadProgress(0);
    setResult(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      const response = await new Promise<Response>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(new Response(xhr.responseText, {
              status: xhr.status,
              statusText: xhr.statusText,
              headers: new Headers({
                'Content-Type': xhr.getResponseHeader('Content-Type') || 'application/json'
              })
            }));
          } else {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.ontimeout = () => reject(new Error('Request timeout'));
        
        xhr.open('POST', '/api/analyze');
        xhr.timeout = 30000; // 30 second timeout
        xhr.send(form);
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const analysisResult = await response.json();
      setResult(analysisResult);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      console.error('Analysis error:', err);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  }

  return (
    <main>
      <header>
        <img src="/logo.png" alt="LLM Index Logo" width={60} />
        <h1>LLM Index Analyzer</h1>
        <p>Privacy-first codebase analysis for LLM context optimization</p>
      </header>

      <form onSubmit={handleUpload} aria-label="Project Upload">
        <div className="upload-section">
          <label htmlFor="file-upload">Select a ZIP file of your project (max 5MB):</label>
          <input
            id="file-upload"
            type="file"
            accept=".zip"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            aria-required="true"
            disabled={loading}
          />
          <button type="submit" disabled={!file || loading} aria-busy={loading}>
            {loading ? 'Analyzing...' : 'Analyze Project'}
          </button>
        </div>
        
        {loading && (
          <div className="progress-container">
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                <span>Uploading: {uploadProgress}%</span>
              </div>
            )}
            {uploadProgress === 100 && (
              <div className="analysis-status">
                <span>Processing... This may take up to 30 seconds</span>
              </div>
            )}
          </div>
        )}
      </form>

      <div className="navigation">
        <Link href="/dashboard">Go to Dashboard / Refactor &rarr;</Link>
      </div>

      <section className="github-section">
        <h3>Or analyze a public GitHub repo:</h3>
        <GitHubImport />
      </section>

      {error && <ErrorDisplay error={error} />}
      {result && <ResultDisplay result={result} />}

      <footer>
        <small>
          <Link href="/privacy">Privacy</Link> | <Link href="/legal">Legal</Link> | 
          Abuse: abuse@example.com
        </small>
      </footer>
    </main>
  );
}

function GitHubImport() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    if (!url) return;
    
    setError(null);
    setLoading(true);
    
    try {
      const response = await fetch(`/api/github_import?repo=${encodeURIComponent(url)}&timeout=25`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const analysisResult = await response.json();
      setResult(analysisResult);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "GitHub import failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="github-import">
      <div className="input-group">
        <input
          type="url"
          placeholder="https://github.com/user/repo"
          value={url}
          onChange={e => setUrl(e.target.value)}
          disabled={loading}
          aria-label="GitHub Repository URL"
        />
        <button onClick={handleImport} disabled={!url || loading}>
          {loading ? 'Importing...' : 'Import & Analyze'}
        </button>
      </div>
      
      {error && <div className="error-message" role="alert">{error}</div>}
      {result && <ResultDisplay result={result} />}
    </div>
  );
}

function ErrorDisplay({ error }: { error: string }) {
  return (
    <div className="error-container" role="alert">
      <h3>Analysis Failed</h3>
      <p className="error-message">{error}</p>
      <details className="troubleshooting">
        <summary>Troubleshooting Tips</summary>
        <ul>
          <li>Ensure ZIP file is under 5MB</li>
          <li>Check that project contains supported file types (.py, .js, .ts)</li>
          <li>Verify ZIP file is not corrupted</li>
          <li>Try a smaller subset of your project</li>
          <li>Remove large binary files or dependencies</li>
        </ul>
      </details>
    </div>
  );
}

function ResultDisplay({ result }: { result: AnalysisResult }) {
  const { metadata, dep_graph, clusters, complexity_scores } = result;

  return (
    <section className="results">
      <h2>Analysis Complete</h2>
      
      <div className="results-summary">
        <div className="metric-card">
          <span className="metric-value">{metadata.total_files}</span>
          <span className="metric-label">Files Analyzed</span>
        </div>
        <div className="metric-card">
          <span className="metric-value">{metadata.total_clusters}</span>
          <span className="metric-label">Clusters Created</span>
        </div>
        <div className="metric-card">
          <span className="metric-value">{metadata.avg_complexity.toFixed(1)}</span>
          <span className="metric-label">Avg Complexity</span>
        </div>
        <div className="metric-card">
          <span className="metric-value">{metadata.processing_time_seconds}s</span>
          <span className="metric-label">Processing Time</span>
        </div>
      </div>

      {metadata.debt_items > 0 && (
        <div className="debt-summary">
          <h3>Technical Debt Summary</h3>
          <p>{metadata.debt_items} issues found that may need attention</p>
        </div>
      )}

      <div className="visualization-section">
        <h3>Cluster Visualization</h3>
        <ClusterVisualization clusters={clusters} depGraph={dep_graph} />
      </div>

      <details className="detailed-report">
        <summary>Detailed Analysis Report</summary>
        <pre className="report-content">
          {JSON.stringify(result.report, null, 2)}
        </pre>
      </details>
    </section>
  );
}

function ClusterVisualization({ clusters, depGraph }: { 
  clusters: string[][], 
  depGraph: Record<string, string[]> 
}) {
  const [graphLoaded, setGraphLoaded] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);

  useEffect(() => {
    if (!clusters || typeof window === 'undefined') return;

    const loadCytoscape = () => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.26.0/cytoscape.min.js';
      script.onload = () => initializeGraph();
      script.onerror = () => setGraphError('Failed to load visualization library');
      document.head.appendChild(script);
    };

    const initializeGraph = () => {
      try {
        if (!window.cytoscape) {
          setGraphError('Cytoscape library not available');
          return;
        }

        const container = document.getElementById('cy-graph');
        if (!container) return;

        // Generate color palette for clusters
        const colors = [
          '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
          '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43'
        ];

        const elements = [
          // Nodes
          ...clusters.flatMap((cluster, idx) =>
            cluster.map(file => ({
              data: { 
                id: file, 
                label: file.split('/').pop() || file,
                group: idx,
                color: colors[idx % colors.length]
              }
            }))
          ),
          // Edges
          ...Object.entries(depGraph).flatMap(([src, deps]) =>
            deps.map(dep => {
              // Find actual target files
              const targets = clusters.flat().filter(file => 
                dep in file || file.endsWith(`${dep}.py`) || file.endsWith(`${dep}.js`)
              );
              return targets.map(target => ({
                data: { source: src, target: target }
              }));
            }).flat()
          )
        ];

        const cy = window.cytoscape({
          container: container,
          elements: elements,
          style: [
            {
              selector: 'node',
              style: {
                'background-color': 'data(color)',
                'label': 'data(label)',
                'text-valign': 'center',
                'text-halign': 'center',
                'color': 'white',
                'text-outline-width': 2,
                'text-outline-color': 'data(color)',
                'font-size': '10px',
                'width': 30,
                'height': 30
              }
            },
            {
              selector: 'edge',
              style: {
                'width': 1,
                'line-color': '#ccc',
                'target-arrow-color': '#ccc',
                'target-arrow-shape': 'triangle',
                'arrow-scale': 0.8
              }
            }
          ],
          layout: {
            name: 'cose',
            animate: true,
            animationDuration: 1000,
            nodeRepulsion: 400000,
            nodeOverlap: 10,
            idealEdgeLength: 100,
            edgeElasticity: 100,
            nestingFactor: 5,
            gravity: 80,
            numIter: 1000,
            initialTemp: 200,
            coolingFactor: 0.95,
            minTemp: 1.0
          }
        });

        setGraphLoaded(true);
      } catch (error) {
        setGraphError('Failed to initialize graph visualization');
        console.error('Graph initialization error:', error);
      }
    };

    loadCytoscape();

    return () => {
      const existingScript = document.querySelector('script[src*="cytoscape"]');
      if (existingScript && document.head.contains(existingScript)) {
        document.head.removeChild(existingScript);
      }
    };
  }, [clusters, depGraph]);

  if (!clusters || clusters.length === 0) {
    return <div className="graph-placeholder">No clusters to visualize</div>;
  }

  if (graphError) {
    return (
      <div className="graph-error">
        <p>Visualization unavailable: {graphError}</p>
        <p>Cluster summary: {clusters.length} clusters with {clusters.reduce((sum, c) => sum + c.length, 0)} files</p>
      </div>
    );
  }

  return (
    <div className="graph-container">
      <div 
        id="cy-graph" 
        style={{ 
          width: '100%', 
          height: '400px', 
          border: '1px solid #ddd',
          borderRadius: '4px',
          backgroundColor: '#f8f9fa'
        }}
      >
        {!graphLoaded && (
          <div className="graph-loading">
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              Loading visualization...
            </div>
          </div>
        )}
      </div>
      <div className="graph-legend">
        <p><strong>Legend:</strong> Each color represents a cluster. Lines show dependencies between files.</p>
      </div>
    </div>
  );
}
