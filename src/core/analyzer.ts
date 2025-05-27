// src/core/analyzer.ts
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as ts from 'typescript';
import { readFileSync } from 'fs';
import { join, extname, basename } from 'path';

export interface FileAnalysis {
  path: string;
  dependencies: string[];
  complexity: number;
  loc: number;
  exports: string[];
  imports: string[];
}

export interface ClusterResult {
  id: string;
  files: string[];
  avgComplexity: number;
  totalLoc: number;
  connections: number;
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

  private async discoverFiles(rootPath: string): Promise<string[]> {
    const { glob } = await import('glob');
    const pattern = `${rootPath}/**/*.{js,ts,jsx,tsx,py,java,cpp,c}`;
    const files = await glob(pattern, {
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**']
    });
    
    return files.filter(file => {
      try {
        const stats = require('fs').statSync(file);
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
    const dependencies: string[] = [];
    const imports: string[] = [];
    const exports: string[] = [];
    let complexity = 1;

    try {
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      const visit = (node: ts.Node) => {
        if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          const source = node.moduleSpecifier.text;
          dependencies.push(source);
          imports.push(source);
        }

        if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
          node.exportClause.elements.forEach(element => {
            exports.push(element.name.text);
          });
        }

        // Complexity
        if (ts.isIfStatement(node) || ts.isWhileStatement(node) || 
            ts.isForStatement(node) || ts.isSwitchStatement(node)) {
          complexity++;
        }

        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
    } catch (error) {
      console.warn(`TypeScript parsing failed for ${filePath}:`, error);
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
      const module = match[1] || match[2].split(',')[0].trim();
      dependencies.push(module);
      imports.push(module);
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

  private resolveDependency(dep: string, currentFile: string, fileMap: Map<string, string>): string | null {
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
    const maxClusterSize = 8;

    analyses.forEach(analysis => {
      if (visited.has(analysis.path)) return;

      const cluster = this.growCluster(analysis.path, depGraph, visited, maxClusterSize);
      if (cluster.length > 0) {
        const clusterAnalyses = cluster.map(path => analyses.find(a => a.path === path)!);
        const avgComplexity = clusterAnalyses.reduce((sum, a) => sum + a.complexity, 0) / cluster.length;
        const totalLoc = clusterAnalyses.reduce((sum, a) => sum + a.loc, 0);
        const connections = this.countClusterConnections(cluster, depGraph);

        clusters.push({
          id: `cluster_${clusters.length}`,
          files: cluster,
          avgComplexity,
          totalLoc,
          connections
        });
      }
    });

    return clusters;
  }

  private growCluster(startFile: string, depGraph: Record<string, string[]>, visited: Set<string>, maxSize: number): string[] {
    const cluster: string[] = [];
    const queue: string[] = [startFile];
    const inCluster = new Set<string>();

    while (queue.length > 0 && cluster.length < maxSize) {
      const current = queue.shift()!;
      
      if (visited.has(current) || inCluster.has(current)) continue;
      
      cluster.push(current);
      visited.add(current);
      inCluster.add(current);

      // Add connected files
      const deps = depGraph[current] || [];
      deps.forEach(dep => {
        if (!visited.has(dep) && !inCluster.has(dep) && cluster.length < maxSize) {
          queue.push(dep);
        }
      });

      // Add reverse dependencies
      Object.entries(depGraph).forEach(([file, fileDeps]) => {
        if (fileDeps.includes(current) && !visited.has(file) && !inCluster.has(file) && cluster.length < maxSize) {
          queue.push(file);
        }
      });
    }

    return cluster;
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
