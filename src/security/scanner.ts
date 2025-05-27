// src/security/scanner.ts
import { readdir, stat, readFile } from 'fs/promises';
import { join, extname } from 'path';

interface SecurityIssue {
  file: string;
  line: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  pattern: string;
}

export class SecurityScanner {
  private readonly dangerousExts = new Set([
    '.exe', '.dll', '.so', '.bin', '.sh', '.bat', '.msi', '.app', '.deb', '.rpm'
  ]);

  private readonly dangerousPatterns = [
    { pattern: /eval\s*\(/gi, severity: 'critical' as const, message: 'Code injection risk: eval()' },
    { pattern: /exec\s*\(/gi, severity: 'critical' as const, message: 'Command injection risk: exec()' },
    { pattern: /innerHTML\s*=/gi, severity: 'high' as const, message: 'XSS risk: innerHTML assignment' },
    { pattern: /document\.write\s*\(/gi, severity: 'high' as const, message: 'XSS risk: document.write()' },
    { pattern: /\$\{[^}]*\}/g, severity: 'medium' as const, message: 'Template injection risk' },
    { pattern: /password\s*=\s*["'][^"']+["']/gi, severity: 'high' as const, message: 'Hardcoded password' },
    { pattern: /api_key\s*=\s*["'][^"']+["']/gi, severity: 'high' as const, message: 'Hardcoded API key' },
    { pattern: /token\s*=\s*["'][^"']+["']/gi, severity: 'medium' as const, message: 'Hardcoded token' },
    { pattern: /os\.system\s*\(/gi, severity: 'critical' as const, message: 'Command injection risk: os.system()' },
    { pattern: /subprocess\.(call|run|Popen)/gi, severity: 'high' as const, message: 'Command execution risk' },
    { pattern: /rm\s+-rf\s+\//gi, severity: 'critical' as const, message: 'Dangerous file deletion' },
    { pattern: /\bsudo\b/gi, severity: 'medium' as const, message: 'Privilege escalation' }
  ];

  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB
  private readonly maxFiles = 2000;

  async scanDirectory(dirPath: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    const files = await this.discoverFiles(dirPath);

    if (files.length > this.maxFiles) {
      throw new Error(`Too many files: ${files.length} (max ${this.maxFiles})`);
    }

    for (const file of files) {
      try {
        const fileIssues = await this.scanFile(file);
        issues.push(...fileIssues);
      } catch (error) {
        console.warn(`Failed to scan ${file}:`, error);
      }
    }

    const critical = issues.filter(i => i.severity === 'critical');
    if (critical.length > 0) {
      throw new Error(`Critical security issues found: ${critical.map(i => i.message).join(', ')}`);
    }

    return issues;
  }

  private async scanFile(filePath: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    const ext = extname(filePath).toLowerCase();

    // Block dangerous file types
    if (this.dangerousExts.has(ext)) {
      throw new Error(`Dangerous file type blocked: ${ext}`);
    }

    const stats = await stat(filePath);
    if (stats.size > this.maxFileSize) {
      throw new Error(`File too large: ${filePath} (${stats.size} bytes)`);
    }

    // Only scan text files
    if (!this.isTextFile(ext)) {
      return issues;
    }

    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    // Scan for dangerous patterns
    for (const { pattern, severity, message } of this.dangerousPatterns) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const matches = line.match(pattern);
        
        if (matches) {
          for (const match of matches) {
            issues.push({
              file: filePath,
              line: i + 1,
              severity,
              message,
              pattern: match
            });
          }
        }
      }
    }

    return issues;
  }

  private async discoverFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const ignoredDirs = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv']);

    const scan = async (currentPath: string): Promise<void> => {
      const entries = await readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentPath, entry.name);

        if (entry.isDirectory()) {
          if (!ignoredDirs.has(entry.name) && !entry.name.startsWith('.')) {
            await scan(fullPath);
          }
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    };

    await scan(dirPath);
    return files;
  }

  private isTextFile(ext: string): boolean {
    const textExts = new Set([
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
      '.css', '.scss', '.less', '.html', '.xml', '.json', '.yaml', '.yml',
      '.md', '.txt', '.sql', '.php', '.rb', '.go', '.rs', '.swift', '.kt'
    ]);
    
    return textExts.has(ext);
  }
}
