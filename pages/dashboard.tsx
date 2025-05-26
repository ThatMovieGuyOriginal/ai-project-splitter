import { useState } from "react";

export default function Dashboard() {
  const [plan, setPlan] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
// dash
  async function dryRun(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("accept", "false");
    const resp = await fetch("/api/refactor", { method: "POST", body: form });
    if (!resp.ok) {
      setError(await resp.text());
      setLoading(false);
      return;
    }
    const res = await resp.json();
    setPlan(res.refactor_plan || []);
    setLoading(false);
  }

  async function acceptChanges() {
    if (!file) return;
    setLoading(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("accept", "true");
    const resp = await fetch("/api/refactor", { method: "POST", body: form });
    if (resp.ok) {
      // Download resulting zip
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "refactored.zip";
      a.click();
      setAccepted(true);
    } else {
      setError(await resp.text());
    }
    setLoading(false);
  }

  return (
    <main>
      <h1>Dry Run & Refactor</h1>
      <form onSubmit={dryRun} aria-label="Dry Run Refactor">
        <input
          type="file"
          accept=".zip"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          aria-required="true"
        />
        <button type="submit" disabled={!file || loading}>
          Dry Run
        </button>
      </form>
      {loading && <div role="status" aria-live="polite">Processing...</div>}
      {error && <div role="alert" style={{ color: "red" }}>{error}</div>}
      {plan.length > 0 && (
        <>
          <h3>Refactor Plan</h3>
          <table>
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.from}</td>
                  <td>{item.to}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!accepted && (
            <button onClick={acceptChanges} disabled={loading}>
              Accept & Download ZIP
            </button>
          )}
          {accepted && <div>Refactor complete! Download started.</div>}
        </>
      )}
      <footer>
        <small>
          <a href="/privacy">Privacy</a> | <a href="/legal">Legal</a> | Abuse: abuse@example.com
        </small>
      </footer>
    </main>
  );
}
