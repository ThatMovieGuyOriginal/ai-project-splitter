// components/GitHubImporter.tsx
import React, { useState } from 'react';
import styles from '../styles/GitHubImporter.module.css';

interface GitHubImporterProps {
  onAnalyze: (repoUrl: string, branch: string) => Promise<void>;
  loading: boolean;
}

export const GitHubImporter: React.FC<GitHubImporterProps> = ({ onAnalyze, loading }) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;

    if (!repoUrl.match(/^https:\/\/github\.com\/[\w-]+\/[\w-]+/)) {
      alert('Please enter a valid GitHub repository URL');
      return;
    }

    await onAnalyze(repoUrl.trim(), branch.trim());
  };

  return (
    <div className={styles.importer}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="repo-url">Repository URL</label>
          <input
            id="repo-url"
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repository"
            disabled={loading}
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="branch">Branch</label>
          <input
            id="branch"
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
            disabled={loading}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading || !repoUrl.trim()}
          className={styles.button}
        >
          {loading ? (
            <>
              <div className={styles.spinner} />
              Importing...
            </>
          ) : (
            '🐙 Import & Analyze'
          )}
        </button>
      </form>

      <div className={styles.examples}>
        <h4>Popular examples:</h4>
        <div className={styles.exampleList}>
          {[
            'https://github.com/vercel/next.js',
            'https://github.com/facebook/react',
            'https://github.com/microsoft/typescript'
          ].map(url => (
            <button 
              key={url}
              onClick={() => setRepoUrl(url)}
              className={styles.exampleButton}
              disabled={loading}
            >
              {url.split('/').slice(-2).join('/')}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
