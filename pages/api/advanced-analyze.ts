// pages/api/advanced-analyze.ts
import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import { AdvancedCodeAnalyzer } from '../../src/core/advanced-analyzer';
import { SecurityScanner } from '../../src/security/scanner';
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
    nodes: Record<string, any>;
    clusters: any[];
    globalMetrics: any;
    qualityMetrics: any;
    recommendations: string[];
    networkAnalysis: {
      centralityAnalysis: any[];
      communityStructure: any;
      topologicalFeatures: any;
    };
    llmOptimization: {
      contextChunks: any[];
      tokenEstimates: any;
      loadingStrategy: any;
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
    return res.status(200).json({ success: true });
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

    // Extract archive with validation
    await extractArchiveAdvanced(file.filepath, tempDir);
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

async function extractArchiveAdvanced(archivePath: string, outputDir: string): Promise<void> {
  const { createReadStream } = await import('fs');
  const { pipeline } = await import('stream/promises');
  const { createGunzip } = await import('zlib');
  const { extract } = await import('tar-stream');
  const { join, resolve, relative } = await import('path');
  const { createWriteStream, mkdir } = await import('fs/promises');

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
    throw new Error('Advanced analyzer supports .tar.gz archives for maximum compatibility');
  }
}

async function postProcessAnalysis(analysis: any, level: string): Promise<any> {
  const processedNodes: Record<string, any> = {};
  
  // Convert Map to serializable object with enhanced data
  for (const [nodeId, node] of analysis.nodes) {
    processedNodes[nodeId] = {
      id: node.id,
      path: node.path,
      type: node.type,
      weight: node.weight,
      complexity: {
        ...node.complexity,
        grade: calculateComplexityGrade(node.complexity),
        risk: calculateRiskLevel(node.complexity)
      },
      centrality: node.centrality,
      dependencies: Array.from(node.dependencies),
      dependents: Array.from(node.dependents),
      clusterAssignment: findNodeCluster(nodeId, analysis.clusters),
      refactoringPriority: calculateRefactoringPriority(node)
    };
  }

  // Enhanced cluster information
  const processedClusters = analysis.clusters.map((cluster: any, index: number) => ({
    ...cluster,
    quality: {
      cohesion: cluster.cohesion,
      coupling: cluster.coupling,
      modularity: cluster.modularity,
      silhouetteScore: cluster.silhouetteScore,
      grade: calculateClusterGrade(cluster)
    },
    recommendations: generateClusterRecommendations(cluster),
    refactoringOpportunities: identifyRefactoringOpportunities(cluster, processedNodes)
  }));

  return {
    nodes: processedNodes,
    clusters: processedClusters
  };
}

function calculateComplexityGrade(complexity: any): string {
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

function calculateRiskLevel(complexity: any): 'low' | 'medium' | 'high' | 'critical' {
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

function findNodeCluster(nodeId: string, clusters: any[]): string | null {
  for (const cluster of clusters) {
    if (cluster.nodes.includes(nodeId)) {
      return cluster.id;
    }
  }
  return null;
}

function calculateRefactoringPriority(node: any): number {
  // Priority based on complexity, centrality, and coupling
  const complexityWeight = node.weight * 0.4;
  const centralityWeight = (node.centrality?.betweenness || 0) * 50 * 0.3;
  const couplingWeight = node.complexity.couplingBetweenObjects * 0.3;
  
  return Math.min(100, complexityWeight + centralityWeight + couplingWeight);
}

function calculateClusterGrade(cluster: any): string {
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

function generateClusterRecommendations(cluster: any): string[] {
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

function identifyRefactoringOpportunities(cluster: any, nodes: Record<string, any>): any[] {
  const opportunities: any[] = [];
  
  // Identify high-complexity nodes in cluster
  const highComplexityNodes = cluster.nodes.filter((nodeId: string) => {
    const node = nodes[nodeId];
    return node && node.complexity.grade === 'F';
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
  
  // Identify extraction opportunities
  if (cluster.nodes.length > 10 && cluster.cohesion < 0.4) {
    opportunities.push({
      type: 'extract_module',
      priority: 'medium',
      description: 'Consider extracting cohesive sub-modules',
      estimatedEffort: 'high'
    });
  }
  
  return opportunities;
}

function generateIntelligentRecommendations(analysis: any): string[] {
  const recommendations: string[] = [];
  const { globalMetrics, qualityMetrics, clusters } = analysis;
  
  // Architecture-level recommendations
  if (globalMetrics.modularityScore < 0.3) {
    recommendations.push('🏗️ Architecture: Poor modularity detected. Consider restructuring into more cohesive modules.');
  }
  
  if (globalMetrics.averageComplexity > 30) {
    recommendations.push('⚡ Complexity: High average complexity. Prioritize refactoring the most complex components.');
  }
  
  if (globalMetrics.networkDensity > 0.3) {
    recommendations.push('🔗 Coupling: High network density indicates tight coupling. Consider introducing abstractions.');
  }
  
  // Quality-based recommendations
  if (qualityMetrics.technicalDebt > 70) {
    recommendations.push('⚠️ Technical Debt: Significant technical debt detected. Create a debt reduction plan.');
  }
  
  if (qualityMetrics.evolutionaryRisk > 60) {
    recommendations.push('🚨 Evolution Risk: High evolutionary risk. Focus on stabilizing core components.');
  }
  
  // Scale-specific recommendations
  if (globalMetrics.scaleFreeBeta > 3) {
    recommendations.push('📈 Scale-Free: Highly scale-free network detected. Monitor hub nodes carefully.');
  }
  
  if (globalMetrics.smallWorldCoefficient > 2) {
    recommendations.push('🌐 Small World: Small-world topology detected. Leverage for efficient information flow.');
  }
  
  // Cluster-specific recommendations
  const poorClusters = clusters.filter((c: any) => c.modularity < 0.1).length;
  if (poorClusters > clusters.length * 0.3) {
    recommendations.push('📦 Clustering: Many poorly defined clusters. Consider re-clustering with different parameters.');
  }
  
  return recommendations;
}

function performNetworkAnalysis(analysis: any): any {
  const { nodes, adjacencyMatrix, globalMetrics } = analysis;
  const nodeArray = Array.from(nodes.keys());
  
  // Centrality analysis
  const centralityAnalysis = nodeArray.map(nodeId => {
    const node = nodes.get(nodeId);
    return {
      nodeId,
      path: node.path,
      centralities: node.centrality,
      role: determinateNodeRole(node.centrality),
      importance: calculateNodeImportance(node)
    };
  }).sort((a, b) => b.importance - a.importance);
  
  // Community structure analysis
  const communityStructure = {
    modularityScore: globalMetrics.modularityScore,
    communityCount: analysis.clusters.length,
    averageCommunitySize: analysis.clusters.reduce((sum: number, c: any) => sum + c.nodes.length, 0) / analysis.clusters.length,
    communityQuality: analysis.clusters.map((cluster: any) => ({
      id: cluster.id,
      size: cluster.nodes.length,
      quality: cluster.modularity,
      cohesion: cluster.cohesion,
      separation: 1 - cluster.coupling
    }))
  };
  
  // Topological features
  const topologicalFeatures = {
    networkType: classifyNetworkType(globalMetrics),
    robustness: calculateNetworkRobustness(centralityAnalysis),
    efficiency: globalMetrics.averagePathLength > 0 ? 1 / globalMetrics.averagePathLength : 0,
    vulnerability: identifyVulnerabilities(centralityAnalysis)
  };
  
  return {
    centralityAnalysis: centralityAnalysis.slice(0, 20), // Top 20 most important nodes
    communityStructure,
    topologicalFeatures
  };
}

function determinateNodeRole(centrality: any): string {
  const { betweenness, closeness, eigenvector, pagerank } = centrality;
  
  if (betweenness > 0.1 && eigenvector > 0.1) return 'hub';
  if (betweenness > 0.1) return 'broker';
  if (eigenvector > 0.1) return 'authority';
  if (closeness > 0.1) return 'connector';
  if (pagerank > 0.05) return 'influencer';
  return 'peripheral';
}

function calculateNodeImportance(node: any): number {
  const { centrality, complexity, weight } = node;
  return (
    (centrality?.betweenness || 0) * 0.3 +
    (centrality?.eigenvector || 0) * 0.3 +
    (centrality?.pagerank || 0) * 0.2 +
    Math.min(weight / 100, 1) * 0.2
  );
}

function classifyNetworkType(metrics: any): string {
  const { smallWorldCoefficient, scaleFreeBeta, clusteringCoefficient } = metrics;
  
  if (scaleFreeBeta > 2 && scaleFreeBeta < 4) return 'scale-free';
  if (smallWorldCoefficient > 1.5) return 'small-world';
  if (clusteringCoefficient > 0.6) return 'clustered';
  if (metrics.networkDensity > 0.5) return 'dense';
  return 'sparse';
}

function calculateNetworkRobustness(centralityAnalysis: any[]): number {
  // Measure how dependent the network is on high-centrality nodes
  const top10Percent = Math.ceil(centralityAnalysis.length * 0.1);
  const topNodesCentrality = centralityAnalysis.slice(0, top10Percent)
    .reduce((sum, node) => sum + node.importance, 0);
  
  const totalCentrality = centralityAnalysis.reduce((sum, node) => sum + node.importance, 0);
  
  return totalCentrality > 0 ? 1 - (topNodesCentrality / totalCentrality) : 1;
}

function identifyVulnerabilities(centralityAnalysis: any[]): any[] {
  return centralityAnalysis
    .filter(node => node.role === 'hub' || node.role === 'broker')
    .slice(0, 5)
    .map(node => ({
      nodeId: node.nodeId,
      path: node.path,
      role: node.role,
      riskLevel: node.importance > 0.2 ? 'high' : 'medium',
      mitigation: node.role === 'hub' ? 
        'Consider distributing responsibilities' : 
        'Ensure alternative paths exist'
    }));
}

function optimizeForLLMContext(analysis: any): any {
  const { nodes, clusters, globalMetrics } = analysis;
  
  // Estimate token counts for different content types
  const tokenEstimates = {
    totalEstimatedTokens: 0,
    byCluster: new Map(),
    byComplexity: { low: 0, medium: 0, high: 0 }
  };
  
  // Generate optimal context chunks
  const contextChunks = clusters.map((cluster: any, index: number) => {
    const clusterNodes = cluster.nodes.map((nodeId: string) => nodes.get(nodeId));
    const avgComplexity = clusterNodes.reduce((sum: number, node: any) => sum + node.weight, 0) / clusterNodes.length;
    const estimatedTokens = clusterNodes.reduce((sum: number, node: any) => sum + estimateNodeTokens(node), 0);
    
    tokenEstimates.totalEstimatedTokens += estimatedTokens;
    tokenEstimates.byCluster.set(cluster.id, estimatedTokens);
    
    const complexityCategory = avgComplexity < 20 ? 'low' : avgComplexity < 50 ? 'medium' : 'high';
    tokenEstimates.byComplexity[complexityCategory] += estimatedTokens;
    
    return {
      clusterId: cluster.id,
      priority: calculateContextPriority(cluster, clusterNodes),
      estimatedTokens,
      contentType: inferContentType(clusterNodes),
      loadingOrder: index,
      dependencies: findClusterDependencies(cluster, clusters)
    };
  }).sort((a, b) => b.priority - a.priority);
  
  // Generate loading strategy
  const loadingStrategy = generateLoadingStrategy(contextChunks, tokenEstimates);
  
  return {
    contextChunks,
    tokenEstimates: {
      ...tokenEstimates,
      byCluster: Object.fromEntries(tokenEstimates.byCluster)
    },
    loadingStrategy
  };
}

function estimateNodeTokens(node: any): number {
  // Rough token estimation based on lines of code and complexity
  const baseTokens = node.complexity.linesOfCode * 1.3; // ~1.3 tokens per line average
  const complexityMultiplier = 1 + (node.weight / 100); // More complex = more tokens
  return Math.round(baseTokens * complexityMultiplier);
}

function calculateContextPriority(cluster: any, nodes: any[]): number {
  // Priority based on centrality, complexity, and cluster quality
  const avgCentrality = nodes.reduce((sum: number, node: any) => 
    sum + (node.centrality?.betweenness || 0), 0) / nodes.length;
  const avgComplexity = nodes.reduce((sum: number, node: any) => sum + node.weight, 0) / nodes.length;
  
  return (
    avgCentrality * 40 +
    Math.min(avgComplexity / 2, 30) +
    cluster.modularity * 20 +
    cluster.cohesion * 10
  );
}

function inferContentType(nodes: any[]): string {
  const paths = nodes.map((node: any) => node.path.toLowerCase());
  
  if (paths.some(p => p.includes('test') || p.includes('spec'))) return 'tests';
  if (paths.some(p => p.includes('api') || p.includes('route'))) return 'api';
  if (paths.some(p => p.includes('component') || p.includes('view'))) return 'ui';
  if (paths.some(p => p.includes('util') || p.includes('helper'))) return 'utilities';
  if (paths.some(p => p.includes('model') || p.includes('entity'))) return 'models';
  if (paths.some(p => p.includes('service') || p.includes('client'))) return 'services';
  if (paths.some(p => p.includes('config') || p.includes('setting'))) return 'configuration';
  if (paths.some(p => p.includes('main') || p.includes('index'))) return 'core';
  
  return 'general';
}

function findClusterDependencies(cluster: any, allClusters: any[]): string[] {
  const clusterNodeSet = new Set(cluster.nodes);
  const dependencies = new Set<string>();
  
  // Find which other clusters this cluster depends on
  for (const otherCluster of allClusters) {
    if (otherCluster.id === cluster.id) continue;
    
    const hasConnection = cluster.nodes.some((nodeId: string) => 
      // This would need access to the actual node dependency data
      false // Simplified for this example
    );
    
    if (hasConnection) {
      dependencies.add(otherCluster.id);
    }
  }
  
  return Array.from(dependencies);
}

function generateLoadingStrategy(chunks: any[], tokenEstimates: any): any {
  const maxContextSize = 128000; // Claude's context window
  const optimalChunkSize = 8000;
  
  // Organize into loading phases
  const phases: any[] = [];
  let currentPhase: any[] = [];
  let currentPhaseTokens = 0;
  
  for (const chunk of chunks) {
    if (currentPhaseTokens + chunk.estimatedTokens > optimalChunkSize && currentPhase.length > 0) {
      phases.push({
        phase: phases.length + 1,
        chunks: currentPhase,
        totalTokens: currentPhaseTokens,
        loadingPriority: currentPhase.reduce((sum, c) => sum + c.priority, 0) / currentPhase.length
      });
      
      currentPhase = [chunk];
      currentPhaseTokens = chunk.estimatedTokens;
    } else {
      currentPhase.push(chunk);
      currentPhaseTokens += chunk.estimatedTokens;
    }
  }
  
  if (currentPhase.length > 0) {
    phases.push({
      phase: phases.length + 1,
      chunks: currentPhase,
      totalTokens: currentPhaseTokens,
      loadingPriority: currentPhase.reduce((sum, c) => sum + c.priority, 0) / currentPhase.length
    });
  }
  
  return {
    phases: phases.sort((a, b) => b.loadingPriority - a.loadingPriority),
    totalPhases: phases.length,
    recommendedApproach: tokenEstimates.totalEstimatedTokens > maxContextSize ? 
      'progressive_loading' : 'full_context',
    contextUtilization: Math.min(1, tokenEstimates.totalEstimatedTokens / maxContextSize)
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
