// src/refactor/engine.ts
import { mkdir, copyFile, writeFile } from 'fs/promises';
import { join, dirname, basename, relative } from 'path';
import { AnalysisResult, ClusterResult } from '../core/analyzer';

export interface RefactorPlan {
  clusters: ClusterStructure[];
  moves: FileMove[];
  summary: {
    totalMoves: number;
    directoriesCreated: string[];
    estimatedImprovement: number;
  };
}

export interface ClusterStructure {
  id: string;
  name: string;
  directory: string;
  files: string[];
  purpose: string;
  complexity: 'low' | 'medium' | 'high';
}

export interface FileMove {
  from: string;
  to: string;
  reason: string;
  clusterId: string;
}

export class RefactorEngine {
  async generatePlan(analysis: AnalysisResult): Promise<RefactorPlan> {
    const clusters = this.designClusterStructure(analysis.clusters);
    const moves = this.planFileMoves(analysis, clusters);
    
    return {
      clusters,
      moves,
      summary: {
        totalMoves: moves.length,
        directoriesCreated: [...new Set(clusters.map(c => c.directory))],
        estimatedImprovement: this.calculateImprovement(analysis, clusters)
      }
    };
  }

  async performRefactor(analysis: AnalysisResult, projectPath: string): Promise<void> {
    const plan = await this.generatePlan(analysis);
    
    // Create directory structure
    for (const cluster of plan.clusters) {
      const dirPath = join(projectPath, cluster.directory);
      await mkdir(dirPath, { recursive: true });
      
      // Create cluster README
      await this.createClusterReadme(dirPath, cluster);
    }

    // Move files
    for (const move of plan.moves) {
      const sourcePath = move.from;
      const targetPath = join(projectPath, move.to);
      
      await mkdir(dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
    }

    // Create project overview
    await this.createProjectOverview(projectPath, plan);
  }

  private designClusterStructure(clusters: ClusterResult[]): ClusterStructure[] {
    return clusters.map((cluster, index) => {
      const complexity = this.determineComplexity(cluster.avgComplexity);
      const purpose = this.inferPurpose(cluster.files);
      const name = this.generateClusterName(purpose, complexity, index);
      
      return {
        id: cluster.id,
        name,
        directory: this.sanitizeDirectoryName(name),
        files: cluster.files,
        purpose,
        complexity
      };
    });
  }

  private planFileMoves(analysis: AnalysisResult, clusters: ClusterStructure[]): FileMove[] {
    const moves: FileMove[] = [];
    
    clusters.forEach(cluster => {
      cluster.files.forEach(filePath => {
        const fileName = basename(filePath);
        const newPath = join(cluster.directory, fileName);
        
        moves.push({
          from: filePath,
          to: newPath,
          reason: `Organized into ${cluster.name} based on ${cluster.purpose}`,
          clusterId: cluster.id
        });
      });
    });

    return moves;
  }

  private determineComplexity(avgComplexity: number): 'low' | 'medium' | 'high' {
    if (avgComplexity <= 5) return 'low';
    if (avgComplexity <= 15) return 'medium';
    return 'high';
  }

  private inferPurpose(files: string[]): string {
    const patterns = [
      { keywords: ['test', 'spec', '__test__'], purpose: 'testing' },
      { keywords: ['api', 'endpoint', 'route'], purpose: 'api' },
      { keywords: ['component', 'ui', 'view'], purpose: 'ui components' },
      { keywords: ['util', 'helper', 'lib'], purpose: 'utilities' },
      { keywords: ['model', 'entity', 'schema'], purpose: 'data models' },
      { keywords: ['service', 'client', 'adapter'], purpose: 'services' },
      { keywords: ['config', 'setting', 'env'], purpose: 'configuration' },
      { keywords: ['main', 'index', 'app'], purpose: 'core application' }
    ];

    for (const pattern of patterns) {
      const matches = files.some(file => 
        pattern.keywords.some(keyword => 
          file.toLowerCase().includes(keyword)
        )
      );
      if (matches) return pattern.purpose;
    }

    return 'general functionality';
  }

  private generateClusterName(purpose: string, complexity: 'low' | 'medium' | 'high', index: number): string {
    const complexityPrefix = {
      low: 'simple',
      medium: 'standard',
      high: 'complex'
    };

    const purposeMap: Record<string, string> = {
      'testing': 'tests',
      'api': 'api',
      'ui components': 'components',
      'utilities': 'utils',
      'data models': 'models',
      'services': 'services',
      'configuration': 'config',
      'core application': 'core',
      'general functionality': 'modules'
    };

    const baseName = purposeMap[purpose] || 'modules';
    return `${complexityPrefix[complexity]}-${baseName}`;
  }

  private sanitizeDirectoryName(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private calculateImprovement(analysis: AnalysisResult, clusters: ClusterStructure[]): number {
    // Calculate improvement score based on:
    // 1. Separation of concerns
    // 2. Complexity distribution
    // 3. Dependency organization

    const purposeVariety = new Set(clusters.map(c => c.purpose)).size;
    const complexityBalance = this.calculateComplexityBalance(clusters);
    const sizeBalance = this.calculateSizeBalance(clusters);

    return Math.round((purposeVariety * 0.4 + complexityBalance * 0.3 + sizeBalance * 0.3) * 10);
  }

  private calculateComplexityBalance(clusters: ClusterStructure[]): number {
    const complexityCounts = { low: 0, medium: 0, high: 0 };
    clusters.forEach(c => complexityCounts[c.complexity]++);
    
    const total = clusters.length;
    const ideal = total / 3;
    const variance = Object.values(complexityCounts)
      .reduce((sum, count) => sum + Math.pow(count - ideal, 2), 0) / 3;
    
    return Math.max(0, 1 - variance / (ideal * ideal));
  }

  private calculateSizeBalance(clusters: ClusterStructure[]): number {
    const sizes = clusters.map(c => c.files.length);
    const avgSize = sizes.reduce((sum, size) => sum + size, 0) / sizes.length;
    const variance = sizes.reduce((sum, size) => sum + Math.pow(size - avgSize, 2), 0) / sizes.length;
    
    return Math.max(0, 1 - Math.sqrt(variance) / avgSize);
  }

  private async createClusterReadme(clusterPath: string, cluster: ClusterStructure): Promise<void> {
    const content = `# ${cluster.name.charAt(0).toUpperCase() + cluster.name.slice(1)}

**Purpose:** ${cluster.purpose}
**Complexity:** ${cluster.complexity}
**Files:** ${cluster.files.length}

## Files in this cluster:

${cluster.files.map(file => `- ${basename(file)}`).join('\n')}

## Description

This cluster contains ${cluster.purpose} with ${cluster.complexity} complexity.
The files are organized together because they share similar functionality and dependencies.

---
*Generated by LLM Index Analyzer*
`;

    await writeFile(join(clusterPath, 'README.md'), content);
  }

  private async createProjectOverview(projectPath: string, plan: RefactorPlan): Promise<void> {
    const content = `# Project Structure Overview

This project has been reorganized for better maintainability and LLM context optimization.

## Directory Structure

${plan.clusters.map(cluster => 
  `### ${cluster.directory}/
- **Purpose:** ${cluster.purpose}
- **Complexity:** ${cluster.complexity}
- **Files:** ${cluster.files.length}
`).join('\n')}

## Refactoring Summary

- **Total files moved:** ${plan.summary.totalMoves}
- **Directories created:** ${plan.summary.directoriesCreated.length}
- **Estimated improvement:** ${plan.summary.estimatedImprovement}/10

## Next Steps

1. Update import paths in your code
2. Review the cluster organization
3. Consider further splitting large clusters if needed
4. Update your build configuration if necessary

---
*Generated by LLM Index Analyzer*
`;

    await writeFile(join(projectPath, 'REFACTOR_OVERVIEW.md'), content);
  }
}
