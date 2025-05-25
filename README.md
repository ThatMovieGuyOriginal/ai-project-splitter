# LLM Index Analyzer

A privacy-first, malware-scanned, ephemeral codebase analyzer and refactor dashboard for LLM context optimization.

- Upload .zip files, or analyze any public GitHub repo
- No account needed, nothing is stored
- Malware scan and full backup before any refactor
- Visualize project clusters and dependencies
- Review all changes before accepting

See `/privacy` and `/legal` for our privacy policy and terms.

---

## Development

- Python backend: see `/llm_index/`
- Next.js frontend: see `/pages/`
- Deploys instantly to Vercel


```
/
├── api/ # Python serverless API endpoints (Vercel)
│ ├── analyze.py
│ ├── refactor.py
│ ├── github_import.py
│ ├── scan.py
│ └── utils.py
├── llm_index/ # Core analysis, clustering, refactor logic
│ ├── init.py
│ ├── analysis.py
│ ├── backup.py
│ ├── clustering.py
│ ├── constants.py
│ ├── manifest.py
│ ├── refactor.py
│ ├── reporting.py
│ ├── security.py
│ └── utils.py
├── pages/ # Next.js frontend pages and routes
│ ├── _app.tsx
│ ├── dashboard.tsx
│ ├── index.tsx
│ ├── privacy.tsx
│ └── legal.tsx
├── public/ # Static public assets
│ ├── cytoscape.min.js
│ └── logo.png
├── styles/ # Global CSS/styles for Next.js
│ └── globals.css
├── utils/ # Frontend utilities (e.g., GitHub OAuth logic)
│ └── github_oauth.ts
├── package.json # Next.js/package dependencies
├── requirements.txt # Python dependencies for API/serverless
├── vercel.json # Vercel project configuration
├── README.md
```
