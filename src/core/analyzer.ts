// src/core/analyzer.ts
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { readFileSync, statSync } from 'fs';
import { extname, basename, dirname } from 'path';

export interface FileAnalysis {
  path: string;
  dependencies: string[];
  complexity: number;
  loc: number;
  exports: string[];
  imports: string[];
  type?: 'component' | 'utility' | 'service' | 'config' | 'test' | 'api' | 'page' | 'hook' | 'type' | 'style' | 'generic';
}

export interface ClusterResult {
  id: string;
  files: string[];
  avgComplexity: number;
  totalLoc: number;
  connections: number;
  purpose?: string;
  dominantType?: string;
}

export interface AnalysisResult {
  files: FileAnalysis[];
  clusters: ClusterResult[];
  depGraph: Record<string, string[]>;
  metadata: {
    totalFiles: number;
    totalClusters: number;
    avgComplexity: number;
    processingTimeMs: number;
  };
}

export class CodeAnalyzer {
  private readonly supportedExts = new Set(['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c']);
  private readonly maxFiles = 1000;
  private readonly maxFileSize = 1024 * 1024; // 1MB per file

  async analyzeProject(rootPath: string): Promise<AnalysisResult> {
    const startTime = Date.now();
    const files = await this.discoverFiles(rootPath);
    
    if (files.length > this.maxFiles) {
      throw new Error(`Project too large: ${files.length} files (max ${this.maxFiles})`);
    }

    const analyses = await Promise.all(
      files.map(file => this.analyzeFile(file))
    );

    // Enhance analyses with file type classification
    analyses.forEach(analysis => {
      analysis.type = this.classifyFileType(analysis);
    });

    const depGraph = this.buildDependencyGraph(analyses);
    const clusters = this.clusterFiles(analyses, depGraph);

    return {
      files: analyses,
      clusters,
      depGraph,
      metadata: {
        totalFiles: analyses.length,
        totalClusters: clusters.length,
        avgComplexity: analyses.reduce((sum, a) => sum + a.complexity, 0) / analyses.length,
        processingTimeMs: Date.now() - startTime
      }
    };
  }

  private classifyFileType(analysis: FileAnalysis): FileAnalysis['type'] {
    const path = analysis.path.toLowerCase();
    const filename = basename(path);
    const dir = dirname(path);

    // Test files
    if (path.includes('test') || path.includes('spec') || path.includes('__test__') || 
        filename.includes('.test.') || filename.includes('.spec.')) {
      return 'test';
    }

    // API/Route files
    if (path.includes('/api/') || path.includes('/routes/') || path.includes('/endpoints/') ||
        filename.includes('route') || filename.includes('endpoint') || filename.includes('controller')) {
      return 'api';
    }

    // React components
    if ((path.endsWith('.tsx') || path.endsWith('.jsx')) && 
        (path.includes('/component') || filename[0] === filename[0].toUpperCase())) {
      return 'component';
    }

    // Pages/Views
    if (path.includes('/page') || path.includes('/view') || path.includes('/screen') ||
        dir.includes('pages') || dir.includes('views') || dir.includes('screens')) {
      return 'page';
    }

    // Hooks
    if (filename.startsWith('use') && (path.endsWith('.ts') || path.endsWith('.tsx') || path.endsWith('.js'))) {
      return 'hook';
    }

    // Utilities/Helpers
    if (path.includes('/util') || path.includes('/helper') || path.includes('/lib') ||
        filename.includes('util') || filename.includes('helper') || filename.includes('common')) {
      return 'utility';
    }

    // Services
    if (path.includes('/service') || path.includes('/client') || path.includes('/adapter') ||
        filename.includes('service') || filename.includes('client') || filename.includes('api')) {
      return 'service';
    }

    // Configuration
    if (path.includes('/config') || filename.includes('config') || filename.includes('setting') ||
        path.includes('.env') || filename.includes('constant')) {
      return 'config';
    }

    // Type definitions
    if (path.endsWith('.d.ts') || filename.includes('type') || filename.includes('interface') ||
        path.includes('/types/') || dir.endsWith('types')) {
      return 'type';
    }

    // Styles
    if (path.endsWith('.css') || path.endsWith('.scss') || path.endsWith('.less') ||
        path.includes('/style') || filename.includes('style') || filename.includes('theme')) {
      return 'style';
    }

    return 'generic';
  }

  private async discoverFiles(rootPath: string): Promise<string[]> {
    const { glob } = await import('glob');
    const pattern = `${rootPath}/**/*.{js,ts,jsx,tsx,py,java,cpp,c}`;
    const files = await glob(pattern, {
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**']
    });
    
    return files.filter(file => {
      try {
        const stats = statSync(file);
        return stats.size <= this.maxFileSize;
      } catch {
        return false;
      }
    });
  }

  private async analyzeFile(filePath: string): Promise<FileAnalysis> {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const ext = extname(filePath);

      switch (ext) {
        case '.js':
        case '.jsx':
          return this.analyzeJavaScript(filePath, content);
        case '.ts':
        case '.tsx':
          return this.analyzeTypeScript(filePath, content);
        case '.py':
          return this.analyzePython(filePath, content);
        default:
          return this.analyzeGeneric(filePath, content);
      }
    } catch (error) {
      console.warn(`Failed to analyze ${filePath}:`, error);
      return {
        path: filePath,
        dependencies: [],
        complexity: 1,
        loc: 0,
        exports: [],
        imports: []
      };
    }
  }

  private analyzeJavaScript(filePath: string, content: string): FileAnalysis {
    const dependencies: string[] = [];
    const imports: string[] = [];
    const exports: string[] = [];
    let complexity = 1;

    try {
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy']
      });

      traverse(ast, {
        ImportDeclaration(path) {
          const source = path.node.source.value;
          if (typeof source === 'string') {
            dependencies.push(source);
            imports.push(source);
          }
        },
        CallExpression(path) {
          if (path.node.callee.type === 'Identifier' && path.node.callee.name === 'require') {
            const arg = path.node.arguments[0];
            if (arg && arg.type === 'StringLiteral') {
              dependencies.push(arg.value);
              imports.push(arg.value);
            }
          }
        },
        ExportNamedDeclaration(path) {
          if (path.node.declaration?.type === 'VariableDeclaration') {
            path.node.declaration.declarations.forEach(decl => {
              if (decl.id.type === 'Identifier') {
                exports.push(decl.id.name);
              }
            });
          }
        },
        // Complexity calculation
        IfStatement: () => complexity++,
        WhileStatement: () => complexity++,
        ForStatement: () => complexity++,
        SwitchCase: () => complexity++,
        ConditionalExpression: () => complexity++,
        LogicalExpression: () => complexity++
      });
    } catch (error) {
      console.warn(`AST parsing failed for ${filePath}:`, error);
    }

    return {
      path: filePath,
      dependencies: [...new Set(dependencies)],
      complexity,
      loc: content.split('\n').length,
      exports,
      imports
    };
  }

  private analyzeTypeScript(filePath: string, content: string): FileAnalysis {
    // Simplified TypeScript analysis - just remove type annotations and treat as JavaScript
    const jsContent = content
      .replace(/:\s*\w+(\[\])?/g, '') // Remove type annotations
      .replace(/interface\s+\w+\s*\{[^}]*\}/gs, '') // Remove interfaces
      .replace(/type\s+\w+\s*=[^;]+;/g, '') // Remove type aliases
      .replace(/as\s+\w+/g, ''); // Remove type assertions

    return this.analyzeJavaScript(filePath, jsContent);
  }

  private analyzePython(filePath: string, content: string): FileAnalysis {
    const dependencies: string[] = [];
    const imports: string[] = [];
    const exports: string[] = [];
    let complexity = 1;

    // Simple regex-based analysis for Python
    const importRegex = /^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm;
    const lines = content.split('\n');

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const moduleValue = match[1] || match[2].split(',')[0].trim();
      dependencies.push(moduleValue);
      imports.push(moduleValue);
    }

    // Count complexity keywords
    const complexityKeywords = ['if', 'elif', 'while', 'for', 'except', 'and', 'or'];
    complexityKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = content.match(regex);
      if (matches) complexity += matches.length;
    });

    // Extract function/class definitions as exports
    const defRegex = /^(?:def|class)\s+(\w+)/gm;
    while ((match = defRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }

    return {
      path: filePath,
      dependencies: [...new Set(dependencies)],
      complexity,
      loc: lines.length,
      exports,
      imports
    };
  }

  private analyzeGeneric(filePath: string, content: string): FileAnalysis {
    const lines = content.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    
    return {
      path: filePath,
      dependencies: [],
      complexity: Math.max(1, Math.floor(nonEmptyLines.length / 10)),
      loc: lines.length,
      exports: [],
      imports: []
    };
  }

  private buildDependencyGraph(analyses: FileAnalysis[]): Record<string, string[]> {
    const graph: Record<string, string[]> = {};
    const fileMap = new Map<string, string>();

    // Create file name to path mapping
    analyses.forEach(analysis => {
      const fileName = basename(analysis.path, extname(analysis.path));
      fileMap.set(fileName, analysis.path);
    });

    analyses.forEach(analysis => {
      graph[analysis.path] = [];
      
      analysis.dependencies.forEach(dep => {
        // Try to resolve dependency to actual file
        const resolvedPath = this.resolveDependency(dep, analysis.path, fileMap);
        if (resolvedPath && resolvedPath !== analysis.path) {
          graph[analysis.path].push(resolvedPath);
        }
      });
    });

    return graph;
  }

  private resolveDependency(dep: string, _currentFile: string, fileMap: Map<string, string>): string | null {
    // Skip external packages (node_modules, built-ins)
    if (!dep.startsWith('.') && !dep.startsWith('/')) {
      return null;
    }

    // Try direct resolution
    if (fileMap.has(dep)) {
      return fileMap.get(dep)!;
    }

    // Try with common extensions
    const extensions = ['.js', '.ts', '.jsx', '.tsx', '.py'];
    for (const ext of extensions) {
      if (fileMap.has(dep + ext)) {
        return fileMap.get(dep + ext)!;
      }
    }

    return null;
  }

  private clusterFiles(analyses: FileAnalysis[], depGraph: Record<string, string[]>): ClusterResult[] {
    const clusters: ClusterResult[] = [];
    const visited = new Set<string>();
    const maxClusterSize = 12;

    // First, group by file type
    const typeGroups = new Map<string, FileAnalysis[]>();
    analyses.forEach(analysis => {
      const type = analysis.type || 'generic';
      if (!typeGroups.has(type)) {
        typeGroups.set(type, []);
      }
      typeGroups.get(type)!.push(analysis);
    });

    // Create clusters based on type and relationships
    for (const [type, files] of typeGroups) {
      if (files.length === 0) continue;

      // For small groups, create a single cluster
      if (files.length <= maxClusterSize) {
        const cluster = this.createCluster(files, type, depGraph);
        if (cluster) {
          clusters.push(cluster);
          files.forEach(f => visited.add(f.path));
        }
      } else {
        // For larger groups, split by relationships
        const subClusters = this.splitByRelationships(files, depGraph, maxClusterSize);
        subClusters.forEach((subFiles, index) => {
          const cluster = this.createCluster(subFiles, type, depGraph, index);
          if (cluster) {
            clusters.push(cluster);
            subFiles.forEach(f => visited.add(f.path));
          }
        });
      }
    }

    // Handle remaining unvisited files
    const remaining = analyses.filter(a => !visited.has(a.path));
    if (remaining.length > 0) {
      const miscClusters = this.groupRemainingFiles(remaining, depGraph, maxClusterSize);
      clusters.push(...miscClusters);
    }

    return clusters;
  }

  private createCluster(files: FileAnalysis[], type: string, depGraph: Record<string, string[]>, index?: number): ClusterResult | null {
    if (files.length === 0) return null;

    const clusterName = this.generateClusterName(type, files, index);
    const filePaths = files.map(f => f.path);
    const avgComplexity = files.reduce((sum, f) => sum + f.complexity, 0) / files.length;
    const totalLoc = files.reduce((sum, f) => sum + f.loc, 0);
    const connections = this.countClusterConnections(filePaths, depGraph);
    const purpose = this.inferClusterPurpose(files, type);

    return {
      id: clusterName,
      files: filePaths,
      avgComplexity,
      totalLoc,
      connections,
      purpose,
      dominantType: type
    };
  }

  private generateClusterName(type: string, files: FileAnalysis[], index?: number): string {
    const typeNames: Record<string, string> = {
      'component': 'UI Components',
      'page': 'Pages & Views',
      'api': 'API Layer',
      'service': 'Services',
      'utility': 'Utilities',
      'hook': 'React Hooks',
      'test': 'Test Suite',
      'config': 'Configuration',
      'type': 'Type Definitions',
      'style': 'Styling',
      'generic': 'Core Modules'
    };

    let baseName = typeNames[type] || 'Modules';

    // Add complexity indicator
    const avgComplexity = files.reduce((sum, f) => sum + f.complexity, 0) / files.length;
    if (avgComplexity > 25) {
      baseName = `Complex ${baseName}`;
    } else if (avgComplexity < 5) {
      baseName = `Simple ${baseName}`;
    }

    // Add index if there are multiple clusters of the same type
    if (index !== undefined && index > 0) {
      baseName += ` ${index + 1}`;
    }

    // Add specific context based on file patterns
    const context = this.getClusterContext(files);
    if (context) {
      baseName = `${context} ${baseName.replace('Complex ', '').replace('Simple ', '')}`;
      if (avgComplexity > 25) baseName = `Complex ${baseName}`;
      else if (avgComplexity < 5) baseName = `Simple ${baseName}`;
    }

    return baseName;
  }

  private getClusterContext(files: FileAnalysis[]): string | null {
    const paths = files.map(f => f.path.toLowerCase());
    
    // Look for common directory patterns
    const contexts = [
      { keywords: ['admin', 'dashboard'], name: 'Admin' },
      { keywords: ['auth', 'login', 'signin'], name: 'Authentication' },
      { keywords: ['user', 'profile', 'account'], name: 'User Management' },
      { keywords: ['payment', 'billing', 'checkout'], name: 'Payment' },
      { keywords: ['chat', 'message', 'notification'], name: 'Communication' },
      { keywords: ['search', 'filter', 'sort'], name: 'Search & Filter' },
      { keywords: ['upload', 'file', 'media'], name: 'File Management' },
      { keywords: ['report', 'analytics', 'stats'], name: 'Analytics' },
      { keywords: ['security', 'encrypt', 'hash'], name: 'Security' },
      { keywords: ['database', 'model', 'schema'], name: 'Data Layer' }
    ];

    for (const context of contexts) {
      const matches = paths.filter(path => 
        context.keywords.some(keyword => path.includes(keyword))
      );
      
      if (matches.length >= Math.ceil(files.length * 0.6)) { // 60% of files match
        return context.name;
      }
    }

    return null;
  }

  private inferClusterPurpose(files: FileAnalysis[], type: string): string {
    const purposes: Record<string, string> = {
      'component': 'User interface components and layouts',
      'page': 'Application pages and route handlers',
      'api': 'API endpoints and request handlers',
      'service': 'Business logic and external integrations',
      'utility': 'Helper functions and common utilities',
      'hook': 'React hooks for state and side effects',
      'test': 'Test cases and testing utilities',
      'config': 'Application configuration and constants',
      'type': 'TypeScript type definitions and interfaces',
      'style': 'CSS styles and theme definitions',
      'generic': 'Core application logic and modules'
    };

    return purposes[type] || 'General functionality';
  }

  private splitByRelationships(files: FileAnalysis[], depGraph: Record<string, string[]>, maxSize: number): FileAnalysis[][] {
    const clusters: FileAnalysis[][] = [];
    const visited = new Set<string>();
    
    for (const file of files) {
      if (visited.has(file.path)) continue;
      
      const cluster = this.growClusterByType(file, files, depGraph, visited, maxSize);
      if (cluster.length > 0) {
        clusters.push(cluster);
      }
    }
    
    return clusters;
  }

  private growClusterByType(startFile: FileAnalysis, allFiles: FileAnalysis[], depGraph: Record<string, string[]>, visited: Set<string>, maxSize: number): FileAnalysis[] {
    const cluster: FileAnalysis[] = [];
    const queue: FileAnalysis[] = [startFile];
    const inCluster = new Set<string>();
    const fileMap = new Map(allFiles.map(f => [f.path, f]));

    while (queue.length > 0 && cluster.length < maxSize) {
      const current = queue.shift()!;
      
      if (visited.has(current.path) || inCluster.has(current.path)) continue;
      
      cluster.push(current);
      visited.add(current.path);
      inCluster.add(current.path);

      // Add connected files of the same type
      const deps = depGraph[current.path] || [];
      deps.forEach(dep => {
        const depFile = fileMap.get(dep);
        if (depFile && depFile.type === startFile.type && 
            !visited.has(dep) && !inCluster.has(dep) && cluster.length < maxSize) {
          queue.push(depFile);
        }
      });

      // Add reverse dependencies of the same type
      Object.entries(depGraph).forEach(([filePath, fileDeps]) => {
        const file = fileMap.get(filePath);
        if (file && file.type === startFile.type && 
            fileDeps.includes(current.path) && 
            !visited.has(filePath) && !inCluster.has(filePath) && cluster.length < maxSize) {
          queue.push(file);
        }
      });
    }

    return cluster;
  }

  private groupRemainingFiles(files: FileAnalysis[], depGraph: Record<string, string[]>, maxSize: number): ClusterResult[] {
    const clusters: ClusterResult[] = [];
    const visited = new Set<string>();

    // Group by directory proximity
    const dirGroups = new Map<string, FileAnalysis[]>();
    
    files.forEach(file => {
      if (visited.has(file.path)) return;
      
      const dir = dirname(file.path);
      const parentDir = dirname(dir);
      const groupKey = parentDir === '.' ? dir : parentDir;
      
      if (!dirGroups.has(groupKey)) {
        dirGroups.set(groupKey, []);
      }
      dirGroups.get(groupKey)!.push(file);
    });

    // Create clusters from directory groups
    for (const [dir, groupFiles] of dirGroups) {
      if (groupFiles.length <= maxSize) {
        const cluster = this.createCluster(groupFiles, 'generic', depGraph);
        if (cluster) {
          cluster.id = `${basename(dir)} Modules`;
          clusters.push(cluster);
          groupFiles.forEach(f => visited.add(f.path));
        }
      } else {
        // Split large directory groups
        const chunks = this.chunkArray(groupFiles, maxSize);
        chunks.forEach((chunk, index) => {
          const cluster = this.createCluster(chunk, 'generic', depGraph, index);
          if (cluster) {
            cluster.id = `${basename(dir)} Modules ${index + 1}`;
            clusters.push(cluster);
            chunk.forEach(f => visited.add(f.path));
          }
        });
      }
    }

    return clusters;
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private countClusterConnections(cluster: string[], depGraph: Record<string, string[]>): number {
    let connections = 0;
    const clusterSet = new Set(cluster);

    cluster.forEach(file => {
      const deps = depGraph[file] || [];
      connections += deps.filter(dep => !clusterSet.has(dep)).length;
    });

    return connections;
  }
}
