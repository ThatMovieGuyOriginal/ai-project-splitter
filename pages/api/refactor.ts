// pages/api/refactor.ts
import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { CodeAnalyzer } from '../../src/core/analyzer';
import { RefactorEngine } from '../../src/refactor/engine';
import { tmpdir } from 'os';
import { join, resolve, relative } from 'path';
import { mkdtemp, rm, mkdir } from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { extract } from 'tar-stream';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import archiver from 'archiver';

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
    const accept = Array.isArray(fields.accept) ? fields.accept[0] : fields.accept;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    tempDir = await mkdtemp(join(tmpdir(), 'refactor-'));

    // Extract and analyze
    await extractArchive(file.filepath, tempDir);
    
    const analyzer = new CodeAnalyzer();
    const analysis = await analyzer.analyzeProject(tempDir);

    const refactorEngine = new RefactorEngine();
    
    if (accept === 'true') {
      // Perform actual refactor
      await refactorEngine.performRefactor(analysis, tempDir);

      // Create ZIP of refactored code
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="refactored.zip"',
      });

      archive.pipe(res);
      archive.directory(tempDir, false);
      await archive.finalize();

    } else {
      // Return refactor plan
      const plan = await refactorEngine.generatePlan(analysis);
      res.status(200).json({
        success: true,
        plan,
        analysis: {
          totalFiles: analysis.files.length,
          totalClusters: analysis.clusters.length,
          avgComplexity: analysis.metadata.avgComplexity,
        },
      });
    }

  } catch (error) {
    console.error('Refactor error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Refactor failed',
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
  } else {
    throw new Error('Unsupported archive format. Please use .tar.gz format.');
  }
}
