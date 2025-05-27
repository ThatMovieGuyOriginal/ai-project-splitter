// pages/api/github.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CodeAnalyzer } from '../../src/core/analyzer';
import { SecurityScanner } from '../../src/security/scanner';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';

const execAsync = promisify(exec);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { repo, branch = 'main' } = req.query;

  if (!repo || typeof repo !== 'string') {
    return res.status(400).json({ error: 'Repository URL required' });
  }

  if (!isValidGitHubUrl(repo)) {
    return res.status(400).json({ error: 'Invalid GitHub URL' });
  }

  let tempDir: string | null = null;

  try {
    // Create temp directory
    tempDir = await mkdtemp(join(tmpdir(), 'github-analyzer-'));

    // Clone repository (shallow clone for speed)
    await execAsync(`git clone --depth 1 --branch ${branch} ${repo} ${tempDir}/repo`, {
      timeout: 30000, // 30 second timeout
    });

    const repoDir = join(tempDir, 'repo');

    // Security scan
    const scanner = new SecurityScanner();
    await scanner.scanDirectory(repoDir);

    // Analyze project
    const analyzer = new CodeAnalyzer();
    const result = await analyzer.analyzeProject(repoDir);

    res.status(200).json({
      success: true,
      repository: repo,
      branch,
      ...result,
    });

  } catch (error) {
    console.error('GitHub analysis error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'GitHub analysis failed',
    });
  } finally {
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.warn('Failed to cleanup temp directory:', e);
      }
    }
  }
}

function isValidGitHubUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'github.com' && 
           parsed.pathname.split('/').length >= 3;
  } catch {
    return false;
  }
}
