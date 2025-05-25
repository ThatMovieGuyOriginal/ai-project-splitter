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


/
├── api/
│   ├── analyze.py
│   ├── refactor.py
│   ├── github_import.py
│   ├── scan.py
│   └── utils.py
├── llm_index/
│   ├── __init__.py
│   ├── analysis.py
│   ├── backup.py
│   ├── clustering.py
│   ├── constants.py
│   ├── manifest.py
│   ├── refactor.py
│   ├── reporting.py
│   ├── security.py
│   └── utils.py
├── pages/
│   ├── _app.tsx
│   ├── dashboard.tsx
│   ├── index.tsx
│   ├── privacy.tsx
│   └── legal.tsx
├── public/
│   ├── cytoscape.min.js
│   └── logo.png
├── styles/
│   └── globals.css
├── utils/
│   └── github_oauth.ts
├── package.json
├── requirements.txt
├── vercel.json
├── README.md
