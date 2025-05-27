import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { CodeAnalyzer } from '../../src/core/analyzer';
import { SecurityScanner } from '../../src/security/scanner';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { createReadStream } from 'fs';
import { extract } from 'tar-stream';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let tempDir: string | null = null;

  try {
    const form = formidable({
      maxFileSize: 5 * 1024 * 1024,
      maxFiles: 1,
    });

    const [fields, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    tempDir = await mkdtemp(join(tmpdir(), 'analyzer-'));
    
    // Extract archive
    await extractArchive(file.filepath, tempDir);

    // Security scan
    const scanner = new SecurityScanner();
    await scanner.scanDirectory(tempDir);

    // Analyze
    const analyzer = new CodeAnalyzer();
    const result = await analyzer.analyzeProject(tempDir);

    res.status(200).json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Analysis failed',
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

async function extractArchive(archivePath: string, outputDir: string): Promise<void> {
  // Basic tar.gz extraction logic
  const readStream = createReadStream(archivePath);
  const gunzip = createGunzip();
  const extractor = extract();
  
  // Implementation would go here...
  // For now, just create a dummy structure
}
