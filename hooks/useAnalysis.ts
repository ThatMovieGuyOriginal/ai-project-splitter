// hooks/useAnalysis.ts
import { useState, useCallback } from 'react';
import { AnalysisResult } from '../pages';

interface AnalysisOptions {
  type: 'file' | 'github';
  file?: File;
  repoUrl?: string;
  branch?: string;
}

export const useAnalysis = () => {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = useCallback(async (options: AnalysisOptions) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let response: Response;

      if (options.type === 'file' && options.file) {
        const formData = new FormData();
        formData.append('file', options.file);
        
        response = await fetch('/api/analyze', {
          method: 'POST',
          body: formData,
        });
      } else if (options.type === 'github' && options.repoUrl) {
        const params = new URLSearchParams({
          repo: options.repoUrl,
          branch: options.branch || 'main'
        });
        
        response = await fetch(`/api/github?${params}`);
      } else {
        throw new Error('Invalid analysis options');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    result,
    error,
    loading,
    analyze,
    clearResults
  };
};
