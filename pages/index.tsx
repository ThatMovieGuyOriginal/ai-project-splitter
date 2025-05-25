import { useState } from "react";
import Link from "next/link";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
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
  const [result, setResult] = useState<any>(null);
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

function ClusterGraph({ clusters, depGraph }: { clusters: any, depGraph: any }) {
  // Simple Cytoscape integration for clusters
  // (See "public/cytoscape.min.js" included in file tree)
  // Production: load only if clusters exist.
  if (typeof window === 'undefined' || !clusters) return null;
  // Use effect to render cytoscape graph after mount
  return <div id="cy-graph" style={{ width: 600, height: 400, margin: '1em auto' }}>
    {/* Visualization handled client-side */}
    <script dangerouslySetInnerHTML={{
      __html: `
        if (window.cytoscape) {
          const cy = cytoscape({
            container: document.getElementById('cy-graph'),
            elements: [
              ${clusters.map((cluster: any, idx: number) =>
                cluster.map((file: string) =>
                  `{ data: { id: '${file}', label: '${file}', group: ${idx} } }`
                ).join(',')
              ).join(',')},
              ${Object.entries(depGraph).flatMap(([src, tgts]) =>
                tgts.map((tgt: string) =>
                  `{ data: { source: '${src}', target: '${tgt}' } }`
                )).join(',')}
            ],
            style: [
              { selector: 'node', style: { 'background-color': '#5ba', 'label': 'data(label)' } },
              { selector: 'edge', style: { 'width': 2, 'line-color': '#ccc' } }
            ],
            layout: { name: 'cose', animate: true }
          });
        }
      `
    }} />
  </div>;
}
