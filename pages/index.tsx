// pages/index.tsx
import React, { useState, useCallback } from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { FileUploader } from '../components/FileUploader';
import { GitHubImporter } from '../components/GitHubImporter';
import { AnalysisResults } from '../components/AnalysisResults';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useAnalysis } from '../hooks/useAnalysis';
import styles from '../styles/Home.module.css';

// Dynamically import heavy components
const ClusterVisualization = dynamic(() => import('../components/ClusterVisualization'), {
  ssr: false,
  loading: () => <div className={styles.loading}>Loading visualization...</div>
});

export interface AnalysisResult {
  files: Array<{
    path: string;
    dependencies: string[];
    complexity: number;
    loc: number;
  }>;
  clusters: Array<{
    id: string;
    files: string[];
    avgComplexity: number;
    totalLoc: number;
  }>;
  depGraph: Record<string, string[]>;
  metadata: {
    totalFiles: number;
    totalClusters: number;
    avgComplexity: number;
    processingTimeMs: number;
  };
}

const HomePage: NextPage = () => {
  const [activeTab, setActiveTab] = useState<'upload' | 'github'>('upload');
  const { result, error, loading, analyze, clearResults } = useAnalysis();

  const handleFileAnalysis = useCallback(async (file: File) => {
    await analyze({ type: 'file', file });
  }, [analyze]);

  const handleGitHubAnalysis = useCallback(async (repoUrl: string, branch: string) => {
    await analyze({ type: 'github', repoUrl, branch });
  }, [analyze]);

  return (
    <>
      <Head>
        <title>LLM Index Analyzer - AI-Optimized Code Structure</title>
        <meta name="description" content="Analyze and optimize your codebase structure for better LLM context understanding" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.logo}>
            <h1>🧠 LLM Index Analyzer</h1>
            <p>AI-optimized code structure analysis</p>
          </div>
        </header>

        <div className={styles.container}>
          <div className={styles.tabs}>
            <button 
              className={`${styles.tab} ${activeTab === 'upload' ? styles.active : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              📁 Upload Project
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'github' ? styles.active : ''}`}
              onClick={() => setActiveTab('github')}
            >
              🐙 GitHub Import
            </button>
          </div>

          <div className={styles.content}>
            <ErrorBoundary>
              {activeTab === 'upload' && (
                <FileUploader 
                  onAnalyze={handleFileAnalysis}
                  loading={loading}
                />
              )}
              
              {activeTab === 'github' && (
                <GitHubImporter 
                  onAnalyze={handleGitHubAnalysis}
                  loading={loading}
                />
              )}

              {error && (
                <div className={styles.error}>
                  <h3>⚠️ Analysis Failed</h3>
                  <p>{error}</p>
                  <button onClick={clearResults} className={styles.clearButton}>
                    Try Again
                  </button>
                </div>
              )}

              {result && (
                <div className={styles.results}>
                  <div className={styles.resultsHeader}>
                    <h2>✅ Analysis Complete</h2>
                    <button onClick={clearResults} className={styles.clearButton}>
                      New Analysis
                    </button>
                  </div>

                  <AnalysisResults result={result} />
                  
                  <div className={styles.visualization}>
                    <h3>📊 Cluster Visualization</h3>
                    <ClusterVisualization 
                      clusters={result.clusters} 
                      depGraph={result.depGraph} 
                    />
                  </div>
                </div>
              )}
            </ErrorBoundary>
          </div>
        </div>

        <footer className={styles.footer}>
          <p>
            <a href="/privacy">Privacy</a> • 
            <a href="/terms">Terms</a> • 
            <a href="https://github.com/your-repo">GitHub</a>
          </p>
          <p>No data is stored. All analysis happens in-memory.</p>
        </footer>
      </main>
    </>
  );
};

export default HomePage;
