// utils/archive-extractor.ts
import { createReadStream, createWriteStream, readFileSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { extract } from 'tar-stream';
import * as zlib from 'zlib';

interface ArchiveEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
  data?: Buffer;
}

export class UniversalArchiveExtractor {
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB per file
  private readonly maxTotalSize = 100 * 1024 * 1024; // 100MB total
  private readonly maxFiles = 1000;

  async extractArchive(archivePath: string, outputDir: string): Promise<string[]> {
    const archiveType = this.detectArchiveType(archivePath);
    
    switch (archiveType) {
      case 'zip':
        return this.extractZip(archivePath, outputDir);
      case 'tar.gz':
      case 'tgz':
        return this.extractTarGz(archivePath, outputDir);
      case 'tar':
        return this.extractTar(archivePath, outputDir);
      case '7z':
        return this.extract7z(archivePath, outputDir);
      case 'rar':
        return this.extractRar(archivePath, outputDir);
      default:
        throw new Error(`Unsupported archive format: ${archiveType}`);
    }
  }

  private detectArchiveType(filePath: string): string {
    const lower = filePath.toLowerCase();
    
    if (lower.endsWith('.zip')) return 'zip';
    if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'tar.gz';
    if (lower.endsWith('.tar')) return 'tar';
    if (lower.endsWith('.7z')) return '7z';
    if (lower.endsWith('.rar')) return 'rar';
    if (lower.endsWith('.gz')) return 'tar.gz'; // Assume tar.gz for .gz files
    
    throw new Error(`Cannot detect archive type from filename: ${filePath}`);
  }

  private async extractZip(archivePath: string, outputDir: string): Promise<string[]> {
    // Use ADM-ZIP for reliable ZIP extraction
    try {
      const { default: AdmZip } = await import('adm-zip');
      const zip = new AdmZip(archivePath);
      const entries = zip.getEntries();
      const files: string[] = [];
      
      let totalSize = 0;
      let fileCount = 0;

      for (const entry of entries) {
        // Security checks
        if (++fileCount > this.maxFiles) {
          throw new Error(`Too many files in archive (max ${this.maxFiles})`);
        }

        if (entry.header.size > this.maxFileSize) {
          throw new Error(`File too large: ${entry.entryName} (${entry.header.size} bytes)`);
        }

        totalSize += entry.header.size;
        if (totalSize > this.maxTotalSize) {
          throw new Error(`Archive too large (max ${this.maxTotalSize} bytes)`);
        }

        // Security: Prevent path traversal
        const safePath = this.sanitizePath(entry.entryName);
        const outputPath = join(outputDir, safePath);
        
        // Security check: ensure the resolved path is within outputDir
        const resolvedOutputPath = resolve(outputPath);
        const resolvedOutputDir = resolve(outputDir);
        if (!resolvedOutputPath.startsWith(resolvedOutputDir)) {
          console.warn(`Skipping potentially dangerous path: ${entry.entryName}`);
          continue;
        }

        if (!entry.isDirectory) {
          try {
            // Create directory structure
            await mkdir(dirname(outputPath), { recursive: true });
            
            // Extract the file data
            const fileData = zip.readFile(entry);
            if (fileData) {
              await writeFile(outputPath, fileData);
              files.push(outputPath);
            }
          } catch (error) {
            console.warn(`Failed to extract ${entry.entryName}:`, error);
          }
        }
      }

      return files;
    } catch (error) {
      // Fallback to buffer-based parsing if ADM-ZIP fails
      console.warn('ADM-ZIP extraction failed, trying buffer-based parsing:', error);
      const buffer = readFileSync(archivePath);
      return this.parseZipBuffer(buffer, outputDir);
    }
  }

  private async parseZipBuffer(buffer: Buffer, outputDir: string): Promise<string[]> {
    const files: string[] = [];
    let offset = 0;
    let totalSize = 0;
    let fileCount = 0;

    while (offset < buffer.length - 4) {
      const signature = buffer.readUInt32LE(offset);
      
      // Local file header signature
      if (signature === 0x04034b50) {
        const entry = this.parseZipEntry(buffer, offset);
        if (!entry) break;

        // Security checks
        if (++fileCount > this.maxFiles) {
          throw new Error(`Too many files in archive (max ${this.maxFiles})`);
        }

        if (entry.size > this.maxFileSize) {
          throw new Error(`File too large: ${entry.name} (${entry.size} bytes)`);
        }

        totalSize += entry.size;
        if (totalSize > this.maxTotalSize) {
          throw new Error(`Archive too large (max ${this.maxTotalSize} bytes)`);
        }

        // Security: Prevent path traversal
        const safePath = this.sanitizePath(entry.name);
        const outputPath = join(outputDir, safePath);
        
        // Security check: ensure the resolved path is within outputDir
        const resolvedOutputPath = resolve(outputPath);
        const resolvedOutputDir = resolve(outputDir);
        if (!resolvedOutputPath.startsWith(resolvedOutputDir)) {
          throw new Error(`Path traversal attempt: ${entry.name}`);
        }

        if (entry.type === 'file' && entry.data) {
          await mkdir(dirname(outputPath), { recursive: true });
          await writeFile(outputPath, entry.data);
          files.push(outputPath);
        }

        offset += (entry as any).totalSize;
      } else {
        // Try to find next valid signature
        offset++;
      }
    }

    return files;
  }

  private parseZipEntry(buffer: Buffer, offset: number): (ArchiveEntry & { totalSize: number }) | null {
    try {
      // ZIP local file header structure
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const uncompressedSize = buffer.readUInt32LE(offset + 22);
      const nameLength = buffer.readUInt16LE(offset + 26);
      const extraLength = buffer.readUInt16LE(offset + 28);
      const method = buffer.readUInt16LE(offset + 8);
      
      const nameStart = offset + 30;
      const name = buffer.toString('utf8', nameStart, nameStart + nameLength);
      
      const dataStart = nameStart + nameLength + extraLength;
      const dataEnd = dataStart + compressedSize;
      
      if (dataEnd > buffer.length) return null;

      let data: Buffer | undefined;
      if (method === 0) {
        // No compression
        data = buffer.subarray(dataStart, dataEnd);
      } else if (method === 8) {
        // Deflate compression
        try {
          const compressed = buffer.subarray(dataStart, dataEnd);
          data = zlib.inflateRawSync(compressed);
        } catch (e) {
          console.warn(`Failed to decompress ${name}:`, e);
          return null;
        }
      } else {
        console.warn(`Unsupported compression method ${method} for ${name}`);
        return null;
      }

      return {
        name,
        type: name.endsWith('/') ? 'directory' : 'file',
        size: uncompressedSize,
        data,
        totalSize: 30 + nameLength + extraLength + compressedSize
      };
    } catch (e) {
      console.warn(`Failed to parse ZIP entry at offset ${offset}:`, e);
      return null;
    }
  }

  private async extractTarGz(archivePath: string, outputDir: string): Promise<string[]> {
    const files: string[] = [];
    const readStream = createReadStream(archivePath);
    const gunzip = createGunzip();
    const extractor = extract();
    
    let totalSize = 0;
    let fileCount = 0;

    return new Promise((resolve, reject) => {
      extractor.on('entry', async (header, stream, next) => {
        try {
          // Security checks
          if (++fileCount > this.maxFiles) {
            stream.destroy();
            return reject(new Error(`Too many files in archive (max ${this.maxFiles})`));
          }

          const headerSize = header.size || 0;
          if (headerSize > this.maxFileSize) {
            stream.destroy();
            return reject(new Error(`File too large: ${header.name || 'unknown'} (${headerSize} bytes)`));
          }

          totalSize += headerSize;
          if (totalSize > this.maxTotalSize) {
            stream.destroy();
            return reject(new Error(`Archive too large (max ${this.maxTotalSize} bytes)`));
          }

          if (header.type === 'file' && header.name) {
            const safePath = this.sanitizePath(header.name);
            const outputPath = join(outputDir, safePath);
            
            // Security: Prevent path traversal
            const resolvedOutputPath = resolve(outputPath);
            const resolvedOutputDir = resolve(outputDir);
            if (!resolvedOutputPath.startsWith(resolvedOutputDir)) {
              stream.resume();
              return next();
            }
            
            await mkdir(dirname(outputPath), { recursive: true });
            const writeStream = createWriteStream(outputPath);
            
            await pipeline(stream, writeStream);
            files.push(outputPath);
          } else {
            stream.resume();
          }
          
          next();
        } catch (error) {
          console.warn(`Failed to extract ${header.name || 'unknown'}:`, error);
          stream.resume();
          next();
        }
      });

      extractor.on('finish', () => resolve(files));
      extractor.on('error', reject);

      pipeline(readStream, gunzip, extractor).catch(reject);
    });
  }

  private async extractTar(archivePath: string, outputDir: string): Promise<string[]> {
    const files: string[] = [];
    const readStream = createReadStream(archivePath);
    const extractor = extract();
    
    let totalSize = 0;
    let fileCount = 0;

    return new Promise((resolve, reject) => {
      extractor.on('entry', async (header, stream, next) => {
        try {
          if (++fileCount > this.maxFiles) {
            stream.destroy();
            return reject(new Error(`Too many files in archive (max ${this.maxFiles})`));
          }

          const headerSize = header.size || 0;
          if (headerSize > this.maxFileSize) {
            stream.destroy();
            return reject(new Error(`File too large: ${header.name || 'unknown'} (${headerSize} bytes)`));
          }

          totalSize += headerSize;
          if (totalSize > this.maxTotalSize) {
            stream.destroy();
            return reject(new Error(`Archive too large (max ${this.maxTotalSize} bytes)`));
          }

          if (header.type === 'file' && header.name) {
            const safePath = this.sanitizePath(header.name);
            const outputPath = join(outputDir, safePath);
            
            // Security: Prevent path traversal
            const resolvedOutputPath = resolve(outputPath);
            const resolvedOutputDir = resolve(outputDir);
            if (!resolvedOutputPath.startsWith(resolvedOutputDir)) {
              stream.resume();
              return next();
            }
            
            await mkdir(dirname(outputPath), { recursive: true });
            const writeStream = createWriteStream(outputPath);
            
            await pipeline(stream, writeStream);
            files.push(outputPath);
          } else {
            stream.resume();
          }
          
          next();
        } catch (error) {
          console.warn(`Failed to extract ${header.name || 'unknown'}:`, error);
          stream.resume();
          next();
        }
      });

      extractor.on('finish', () => resolve(files));
      extractor.on('error', reject);

      pipeline(readStream, extractor).catch(reject);
    });
  }

  private async extract7z(archivePath: string, outputDir: string): Promise<string[]> {
    // 7z extraction would require a specialized library like 'node-7z'
    // For now, we'll throw an informative error
    throw new Error('7z format is not supported yet. Please use ZIP, TAR, or TAR.GZ format.');
  }

  private async extractRar(archivePath: string, outputDir: string): Promise<string[]> {
    // RAR extraction would require a specialized library
    throw new Error('RAR format is not supported yet. Please use ZIP, TAR, or TAR.GZ format.');
  }

  private sanitizePath(path: string): string {
    // Remove leading slashes and resolve relative paths
    return path
      .replace(/^\/+/, '')
      .replace(/\.\./g, '')
      .replace(/\/+/g, '/')
      .trim();
  }
}

// Export singleton instance
export const archiveExtractor = new UniversalArchiveExtractor();
