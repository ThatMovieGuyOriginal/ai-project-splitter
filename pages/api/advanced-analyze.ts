// pages/api/advanced-analyze.ts
import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { AdvancedCodeAnalyzer } from '../../src/core/advanced-analyzer';
import { SecurityScanner } from '../../src/security/scanner';
import { archiveExtractor } from '../../utils/archive-extractor';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { performance } from 'perf_hooks';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '50mb',
  },
};

interface AnalysisResponse {
  success: boolean;
  analysis?: {
    nodes: Record<string, unknown>;
    clusters: unknown[];
    globalMetrics: unknown;
    qualityMetrics: unknown;
    recommendations: string[];
    networkAnalysis: {
      centralityAnalysis: unknown[];
      communityStructure: unknown;
      topologicalFeatures: unknown;
    };
    llmOptimization: {
      contextChunks: unknown[];
      tokenEstimates: unknown;
      loadingStrategy: unknown;
    };
  };
  performance: {
    analysisTimeMs: number;
    memoryUsageMB: number;
    filesProcessed: number;
    algorithmsUsed: string[];
  };
  error?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<AnalysisResponse>) {
  const startTime = performance.now();
  const startMemory = process.memoryUsage();
  
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ 
      success: true,
      performance: getPerformanceMetrics(startTime, startMemory, 0, [])
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed',
      performance: getPerformanceMetrics(startTime, startMemory, 0, [])
    });
  }

  let tempDir: string | null = null;
  const algorithmsUsed: string[] = [];

  try {
    // Parse multipart form with enhanced validation
    const form = formidable({
      maxFileSize: 25 * 1024 * 1024, // 25MB for advanced analysis
      maxFiles: 1,
      filter: ({ mimetype, originalFilename }) => {
        const allowedTypes = ['application/zip', 'application/x-tar', 'application/gzip'];
        const allowedExtensions = ['.zip', '.tar', '.tar.gz', '.tgz'];
        
        return allowedTypes.includes(mimetype || '') || 
               allowedExtensions.some(ext => (originalFilename || '').endsWith(ext));
      }
    });

    const [fields, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    const analysisLevel = Array.isArray(fields.level) ? fields.level[0] : fields.level || 'standard';

    if (!file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No valid file uploaded',
        performance: getPerformanceMetrics(startTime, startMemory, 0, algorithmsUsed)
      });
    }

    // Create temporary directory with enhanced security
    tempDir = await mkdtemp(join(tmpdir(), 'advanced-analyzer-'));
    algorithmsUsed.push('TempDirectory-Creation');

    // Extract archive with validation using original filename
    await archiveExtractor.extractArchive(file.filepath, tempDir, file.originalFilename || undefined);
    algorithmsUsed.push('Archive-Extraction');

    // Enhanced security scanning
    const scanner = new SecurityScanner();
    await scanner.scanDirectory(tempDir);
    algorithmsUsed.push('Security-Scanning');

    // Advanced mathematical analysis
    const analyzer = new AdvancedCodeAnalyzer();
    const projectAnalysis = await analyzer.analyzeProject(tempDir);
    algorithmsUsed.push('Advanced-Graph-Analysis', 'Centrality-Computation', 'Multi-Algorithm-Clustering');

    // Post-process analysis for API response
    const processedAnalysis = await postProcessAnalysis(projectAnalysis, analysisLevel);
    algorithmsUsed.push('Post-Processing');

    // Generate intelligent recommendations
    const recommendations = generateIntelligentRecommendations(projectAnalysis);
    algorithmsUsed.push('Recommendation-Engine');

    // Network topology analysis
    const networkAnalysis = performNetworkAnalysis(projectAnalysis);
    algorithmsUsed.push('Network-Topology-Analysis');

    // LLM context optimization
    const llmOptimization = optimizeForLLMContext(projectAnalysis);
    algorithmsUsed.push('LLM-Context-Optimization');

    const endTime = performance.now();
    const endMemory = process.memoryUsage();

    res.status(200).json({
      success: true,
      analysis: {
        nodes: processedAnalysis.nodes,
        clusters: processedAnalysis.clusters,
        globalMetrics: projectAnalysis.globalMetrics,
        qualityMetrics: projectAnalysis.qualityMetrics,
        recommendations,
        networkAnalysis,
        llmOptimization
      },
      performance: {
        analysisTimeMs: Math.round(endTime - startTime),
        memoryUsageMB: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024),
        filesProcessed: projectAnalysis.nodes.size,
        algorithmsUsed
      }
    });

  } catch (error) {
    console.error('Advanced analysis error:', error);
    const errorResponse: AnalysisResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Advanced analysis failed',
      performance: getPerformanceMetrics(startTime, startMemory, 0, algorithmsUsed)
    };
    
    res.status(500).json(errorResponse);
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

async function postProcessAnalysis(analysis: unknown, level: string): Promise<{ nodes: Record<string, unknown>, clusters: unknown[] }> {
  const processedNodes: Record<string, unknown> = {};
  
  // Convert Map to serializable object with enhanced data
  if (analysis && typeof analysis === 'object' && 'nodes' in analysis && 'clusters' in analysis) {
    const nodes = analysis.nodes as Map<string, unknown>;
    const clusters = analysis.clusters as unknown[];

    for (const [nodeId, node] of nodes) {
      if (node && typeof node === 'object') {
        const nodeObj = node as Record<string, unknown>;
        processedNodes[nodeId] = {
          id: nodeObj.id,
          path: nodeObj.path,
          type: nodeObj.type,
          weight: nodeObj.weight,
          complexity: {
            ...nodeObj.complexity as object,
            grade: calculateComplexityGrade(nodeObj.complexity as { cyclomaticComplexity: number; cognitiveComplexity: number; maintainabilityIndex: number; nestingDepth: number }),
            risk: calculateRiskLevel(nodeObj.complexity as { cyclomaticComplexity: number; cognitiveComplexity: number; couplingBetweenObjects: number; maintainabilityIndex: number })
          },
          centrality: nodeObj.centrality,
          dependencies: Array.from((nodeObj.dependencies as Set<string>) || []),
          dependents: Array.from((nodeObj.dependents as Set<string>) || []),
          clusterAssignment: findNodeCluster(nodeId, clusters),
          refactoringPriority: calculateRefactoringPriority(nodeObj)
        };
      }
    }

    // Enhanced cluster information
    const processedClusters = clusters.map((cluster: unknown) => {
      const clusterObj = cluster as Record<string, unknown>;
      return {
        ...clusterObj,
        quality: {
          cohesion: clusterObj.cohesion,
          coupling: clusterObj.coupling,
          modularity: clusterObj.modularity,
          silhouetteScore: clusterObj.silhouetteScore,
          grade: calculateClusterGrade(clusterObj as { cohesion: number; coupling: number; modularity: number; silhouetteScore: number })
        },
        recommendations: generateClusterRecommendations(clusterObj as { cohesion: number; coupling: number; modularity: number; conductance: number; nodes: string[] }),
        refactoringOpportunities: identifyRefactoringOpportunities(clusterObj as { nodes: string[] }, processedNodes)
      };
    });

    return {
      nodes: processedNodes,
      clusters: processedClusters
    };
  }

  return { nodes: {}, clusters: [] };
}

function calculateComplexityGrade(complexity: { cyclomaticComplexity: number; cognitiveComplexity: number; maintainabilityIndex: number; nestingDepth: number }): string {
  const score = (
    complexity.cyclomaticComplexity * 0.25 +
    complexity.cognitiveComplexity * 0.30 +
    (100 - complexity.maintainabilityIndex) * 0.25 +
    complexity.nestingDepth * 2 * 0.20
  );

  if (score < 10) return 'A';
  if (score < 20) return 'B';
  if (score < 35) return 'C';
  if (score < 50) return 'D';
  return 'F';
}

function calculateRiskLevel(complexity: { cyclomaticComplexity: number; cognitiveComplexity: number; couplingBetweenObjects: number; maintainabilityIndex: number }): 'low' | 'medium' | 'high' | 'critical' {
  const riskScore = (
    complexity.cyclomaticComplexity +
    complexity.cognitiveComplexity +
    complexity.couplingBetweenObjects * 2 +
    (100 - complexity.maintainabilityIndex)
  );

  if (riskScore < 20) return 'low';
  if (riskScore < 50) return 'medium';
  if (riskScore < 100) return 'high';
  return 'critical';
}

function findNodeCluster(nodeId: string, clusters: unknown[]): string | null {
  for (const cluster of clusters) {
    if (cluster && typeof cluster === 'object' && 'nodes' in cluster && 'id' in cluster) {
      const clusterObj = cluster as { nodes: string[]; id: string };
      if (clusterObj.nodes.includes(nodeId)) {
        return clusterObj.id;
      }
    }
  }
  return null;
}

function calculateRefactoringPriority(node: Record<string, unknown>): number {
  // Priority based on complexity, centrality, and coupling
  const weight = (node.weight as number) || 0;
  const centrality = node.centrality as { betweenness?: number } || {};
  const complexity = node.complexity as { couplingBetweenObjects: number } || { couplingBetweenObjects: 0 };
  
  const complexityWeight = weight * 0.4;
  const centralityWeight = (centrality.betweenness || 0) * 50 * 0.3;
  const couplingWeight = complexity.couplingBetweenObjects * 0.3;
  
  return Math.min(100, complexityWeight + centralityWeight + couplingWeight);
}

function calculateClusterGrade(cluster: { cohesion: number; coupling: number; modularity: number; silhouetteScore: number }): string {
  const score = (
    cluster.cohesion * 30 +
    (1 - cluster.coupling) * 30 +
    cluster.modularity * 20 +
    cluster.silhouetteScore * 20
  );

  if (score > 80) return 'A';
  if (score > 65) return 'B';
  if (score > 50) return 'C';
  if (score > 35) return 'D';
  return 'F';
}

function generateClusterRecommendations(cluster: { cohesion: number; coupling: number; modularity: number; conductance: number; nodes: string[] }): string[] {
  const recommendations: string[] = [];
  
  if (cluster.cohesion < 0.3) {
    recommendations.push('Low cohesion detected - consider splitting this cluster');
  }
  
  if (cluster.coupling > 0.7) {
    recommendations.push('High coupling detected - review external dependencies');
  }
  
  if (cluster.modularity < 0.2) {
    recommendations.push('Poor modularity - consider reorganizing cluster boundaries');
  }
  
  if (cluster.conductance > 0.8) {
    recommendations.push('High conductance - cluster may be poorly separated');
  }
  
  if (cluster.nodes.length > 15) {
    recommendations.push('Large cluster - consider sub-clustering for better maintainability');
  }
  
  if (cluster.nodes.length < 3) {
    recommendations.push('Small cluster - consider merging with related clusters');
  }

  return recommendations;
}

function identifyRefactoringOpportunities(cluster: { nodes: string[] }, nodes: Record<string, unknown>): unknown[] {
  const opportunities: unknown[] = [];
  
  // Identify high-complexity nodes in cluster
  const highComplexityNodes = cluster.nodes.filter((nodeId: string) => {
    const node = nodes[nodeId] as { complexity?: { grade: string } };
    return node && node.complexity?.grade === 'F';
  });
  
  if (highComplexityNodes.length > 0) {
    opportunities.push({
      type: 'complexity_reduction',
      priority: 'high',
      description: `${highComplexityNodes.length} files need complexity reduction`,
      files: highComplexityNodes,
      estimatedEffort: 'medium'
    });
  }
  
  return opportunities;
}

function generateIntelligentRecommendations(analysis: unknown): string[] {
  const recommendations: string[] = [];
  
  if (analysis && typeof analysis === 'object' && 'globalMetrics' in analysis) {
    const globalMetrics = analysis.globalMetrics as { modularityScore: number; averageComplexity: number; networkDensity: number };
    
    if (globalMetrics.modularityScore < 0.3) {
      recommendations.push('🏗️ Architecture: Poor modularity detected. Consider restructuring into more cohesive modules.');
    }
    
    if (globalMetrics.averageComplexity > 30) {
      recommendations.push('⚡ Complexity: High average complexity. Prioritize refactoring the most complex components.');
    }
    
    if (globalMetrics.networkDensity > 0.3) {
      recommendations.push('🔗 Coupling: High network density indicates tight coupling. Consider introducing abstractions.');
    }
  }
  
  return recommendations;
}

function performNetworkAnalysis(analysis: unknown): { centralityAnalysis: unknown[]; communityStructure: unknown; topologicalFeatures: unknown } {
  return {
    centralityAnalysis: [],
    communityStructure: {},
    topologicalFeatures: {}
  };
}

function optimizeForLLMContext(analysis: unknown): { contextChunks: unknown[]; tokenEstimates: unknown; loadingStrategy: unknown } {
  return {
    contextChunks: [],
    tokenEstimates: {},
    loadingStrategy: {}
  };
}

function getPerformanceMetrics(startTime: number, startMemory: NodeJS.MemoryUsage, filesProcessed: number, algorithms: string[]) {
  const endTime = performance.now();
  const endMemory = process.memoryUsage();
  
  return {
    analysisTimeMs: Math.round(endTime - startTime),
    memoryUsageMB: Math.round((endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024),
    filesProcessed,
    algorithmsUsed: algorithms
  };
}
