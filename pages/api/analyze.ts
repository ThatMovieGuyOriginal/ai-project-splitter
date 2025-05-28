// pages/api/analyze.ts
import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { CodeAnalyzer } from '../../src/core/analyzer';
import { SecurityScanner } from '../../src/security/scanner';
import { archiveExtractor } from '../../utils/archive-extractor';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '50mb',
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ success: true });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let tempDir: string | null = null;

  try {
    // Enhanced form parsing with better file validation
    const form = formidable({
      maxFileSize: 25 * 1024 * 1024, // 25MB max file size
      maxFiles: 1,
      filter: ({ mimetype, originalFilename }) => {
        // Accept various archive types
        const allowedTypes = [
          'application/zip',
          'application/x-zip-compressed',
          'application/x-tar',
          'application/gzip',
          'application/x-gzip',
          'application/x-compressed',
          'application/x-7z-compressed',
          'application/octet-stream' // For some archive types
        ];
        
        const allowedExtensions = [
          '.zip', '.tar', '.tar.gz', '.tgz', '.gz', '.7z'
        ];
        
        // Check MIME type first
        if (mimetype && allowedTypes.includes(mimetype)) {
          return true;
        }
        
        // Fallback to extension check
        if (originalFilename) {
          return allowedExtensions.some(ext => 
            originalFilename.toLowerCase().endsWith(ext)
          );
        }
        
        return false;
      }
    });

    const [fields, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    const skipSecurity = Array.isArray(fields.skipSecurity) ? 
      fields.skipSecurity[0] === 'true' : 
      fields.skipSecurity === 'true';

    if (!file) {
      return res.status(400).json({ 
        error: 'No valid archive file uploaded. Supported formats: ZIP, TAR, TAR.GZ, TGZ, GZ' 
      });
    }

    // Create temporary directory with enhanced security
    tempDir = await mkdtemp(join(tmpdir(), 'llm-analyzer-'));
    
    // Extract archive using universal extractor with original filename
    console.log(`Extracting archive: ${file.originalFilename || 'unknown'}`);
    const extractedFiles = await archiveExtractor.extractArchive(
      file.filepath, 
      tempDir, 
      file.originalFilename || undefined
    );
    
    if (extractedFiles.length === 0) {
      throw new Error('No files were extracted from the archive');
    }

    console.log(`Extracted ${extractedFiles.length} files`);

    // Security scanning (optional)
    if (!skipSecurity) {
      console.log('Performing security scan...');
      const scanner = new SecurityScanner();
      await scanner.scanDirectory(tempDir);
      console.log('Security scan passed');
    }

    // Analyze the extracted project
    console.log('Starting code analysis...');
    const analyzer = new CodeAnalyzer();
    const result = await analyzer.analyzeProject(tempDir);
    console.log('Analysis completed');

    // Enhanced response with more metadata
    res.status(200).json({
      success: true,
      ...result,
      extractionInfo: {
        archiveName: file.originalFilename,
        archiveSize: file.size,
        extractedFiles: extractedFiles.length,
        securityScanSkipped: skipSecurity
      },
      supportedFormats: ['ZIP', 'TAR', 'TAR.GZ', 'TGZ', 'GZ']
    });

  } catch (error) {
    console.error('Analysis error:', error);
    
    // Enhanced error responses
    if (error instanceof Error) {
      let status = 500;
      let errorMessage = error.message;
      
      if (error.message.includes('Unsupported archive format') || error.message.includes('Cannot detect archive type')) {
        status = 400;
        errorMessage = `${error.message}. Supported formats: ZIP, TAR, TAR.GZ, TGZ, GZ`;
      } else if (error.message.includes('too large') || error.message.includes('Too many')) {
        status = 413;
      } else if (error.message.includes('security') || error.message.includes('dangerous')) {
        status = 403;
      } else if (error.message.includes('Path traversal') || error.message.includes('Invalid')) {
        status = 400;
      }
      
      res.status(status).json({
        success: false,
        error: errorMessage,
        supportedFormats: ['ZIP', 'TAR', 'TAR.GZ', 'TGZ', 'GZ']
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Analysis failed due to an unexpected error',
        supportedFormats: ['ZIP', 'TAR', 'TAR.GZ', 'TGZ', 'GZ']
      });
    }
  } finally {
    // Cleanup temporary directory
    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true });
        console.log('Cleaned up temporary directory');
      } catch (e) {
        console.warn('Failed to cleanup temp directory:', e);
      }
    }
  }
}

// Export the archiveExtractor for use in other parts of the application
export { archiveExtractor };
