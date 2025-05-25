import { useEffect } from 'react';
import Link from "next/link";

interface AnalysisResult {
  dep_graph: Record<string, string[]>;
  clusters: string[][];
  report: any[];
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setLoading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        body: form,
      });
      if (!resp.ok) {
        const msg = await resp.text();
        setError(msg);
        setLoading(false);
        return;
      }
      setResult(await resp.json());
    } catch (err) {
      setError("Network or server error.");
    }
    setLoading(false);
  }

  return (
    <main>
      <header>
        <img src="/logo.png" alt="LLM Index Logo" width={60} />
        <h1>LLM Index Analyzer</h1>
      </header>
      <form onSubmit={handleUpload} aria-label="Project Upload">
        <label htmlFor="file-upload">Select a ZIP file of your project:</label>
        <input
          id="file-upload"
          type="file"
          accept=".zip"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          aria-required="true"
        />
        <button type="submit" disabled={!file || loading} aria-busy={loading}>
          Analyze
        </button>
      </form>
      <div>
        <Link href="/dashboard">Go to Dashboard / Refactor &rarr;</Link>
      </div>
      <h3>Or analyze a public GitHub repo:</h3>
      <GitHubImport />
      {loading && <div role="status" aria-live="polite">Processing...</div>}
      {error && <div role="alert" style={{ color: "red" }}>{error}</div>}
      {result && (
        <section>
          <h2>Analysis Result</h2>
          <ClusterGraph clusters={result.clusters} depGraph={result.dep_graph} />
          <pre style={{ maxWidth: "800px", overflow: "auto" }}>
            {JSON.stringify(result.report, null, 2)}
          </pre>
        </section>
      )}
      <footer>
        <small>
          <Link href="/privacy">Privacy</Link> | <Link href="/legal">Legal</Link> | Abuse: abuse@example.com
        </small>
      </footer>
    </main>
  );
}

function GitHubImport() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    const resp = await fetch(`/api/github_import?repo=${encodeURIComponent(url)}`);
    if (!resp.ok) {
      setError(await resp.text());
      return;
    }
    setResult(await resp.json());
  }
  return (
    <>
      <input
        type="url"
        placeholder="https://github.com/user/repo"
        value={url}
        onChange={e => setUrl(e.target.value)}
        style={{ width: 400 }}
        aria-label="GitHub Repository URL"
      />
      <button onClick={handleClick} disabled={!url}>Import & Analyze</button>
      {error && <div role="alert" style={{ color: "red" }}>{error}</div>}
      {result && (
        <pre style={{ maxWidth: "800px", overflow: "auto" }}>
          {JSON.stringify(result.report, null, 2)}
        </pre>
      )}
    </>
  );
}

function ClusterGraph({ clusters, depGraph }: { clusters: string[][], depGraph: Record<string, string[]> }) {
  useEffect(() => {
    // Load Cytoscape from CDN
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.26.0/cytoscape.min.js';
    script.onload = () => {
      // Initialize graph after Cytoscape loads
      if (window.cytoscape && clusters) {
        const cy = window.cytoscape({
          container: document.getElementById('cy-graph'),
          elements: [
            // Nodes
            ...clusters.flatMap((cluster: string[], idx: number) =>
              cluster.map((file: string) => ({
                data: { id: file, label: file.split('/').pop(), group: idx }
              }))
            ),
            // Edges
            ...Object.entries(depGraph).flatMap(([src, tgts]: [string, string[]]) =>
              tgts.map((tgt: string) => ({
                data: { source: src, target: tgt }
              }))
            )
          ],
          style: [
            { 
              selector: 'node', 
              style: { 
                'background-color': '#5ba', 
                'label': 'data(label)',
                'text-valign': 'center',
                'color': 'white',
                'text-outline-width': 2,
                'text-outline-color': '#5ba'
              } 
            },
            { 
              selector: 'edge', 
              style: { 
                'width': 2, 
                'line-color': '#ccc',
                'target-arrow-color': '#ccc',
                'target-arrow-shape': 'triangle'
              } 
            }
          ],
          layout: { name: 'cose', animate: true, randomize: false }
        });
      }
    };
    document.head.appendChild(script);

    // Cleanup
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [clusters, depGraph]);

  if (typeof window === 'undefined' || !clusters) return null;
  
  return (
    <div id="cy-graph" style={{ width: 600, height: 400, margin: '1em auto', border: '1px solid #ddd' }}>
      <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
        Loading visualization...
      </div>
    </div>
  );
}
