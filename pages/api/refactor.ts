// pages/api/refactor.ts
import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { CodeAnalyzer } from '../../src/core/analyzer';
import { RefactorEngine } from '../../src/refactor/engine';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
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
