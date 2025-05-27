// pages/api/analyze.ts
import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { CodeAnalyzer } from '../../src/core/analyzer';
import { SecurityScanner } from '../../src/security/scanner';
import { tmpdir } from 'os';
import { join, resolve, relative } from 'path';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
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

    const [, files] = await form.parse(req);
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
  const readStream = createReadStream(archivePath);
  
  if (archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz')) {
    const gunzip = createGunzip();
    const extractor = extract();
    
    extractor.on('entry', async (header, stream, next) => {
      try {
        if (header.type === 'file') {
          const outputPath = resolve(join(outputDir, header.name));
          
          // Security: Prevent path traversal attacks
          const relativePath = relative(outputDir, outputPath);
          if (relativePath.startsWith('..') || resolve(outputPath) !== outputPath) {
            stream.resume();
            return next();
          }
          
          // Create directory structure
          await mkdir(resolve(outputPath, '..'), { recursive: true });
          
          const writeStream = createWriteStream(outputPath);
          await pipeline(stream, writeStream);
        } else {
          stream.resume();
        }
        next();
      } catch (error) {
        console.warn(`Failed to extract ${header.name}:`, error);
        stream.resume();
        next();
      }
    });

    await pipeline(readStream, gunzip, extractor);
  } else if (archivePath.endsWith('.zip')) {
    // For ZIP files, create a simple extraction fallback
    // In production, you'd want to use a proper ZIP library
    throw new Error('ZIP files not supported yet. Please use .tar.gz format.');
  } else {
    throw new Error('Unsupported archive format. Please use .tar.gz format.');
  }
}
