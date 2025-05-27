// src/core/advanced-analyzer.ts
import { Matrix, SparseMatrix, EigenvalueDecomposition } from 'ml-matrix';
import { readFileSync, statSync } from 'fs';
import { extname, basename, dirname, relative, join } from 'path';
import { glob } from 'glob';

interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  halsteadVolume: number;
  maintainabilityIndex: number;
  nestingDepth: number;
  fanIn: number;
  fanOut: number;
  linesOfCode: number;
  logicalLinesOfCode: number;
  commentDensity: number;
  couplingBetweenObjects: number;
  lackOfCohesionMetrics: number;
}

interface GraphNode {
  id: string;
  path: string;
  type: 'file' | 'module' | 'function' | 'class';
  complexity: ComplexityMetrics;
  dependencies: Set<string>;
  dependents: Set<string>;
  weight: number;
  centrality?: {
    betweenness: number;
    closeness: number;
    eigenvector: number;
    pagerank: number;
  };
}

interface ClusterResult {
  id: string;
  nodes: string[];
  cohesion: number;
  coupling: number;
  modularity: number;
  silhouetteScore: number;
  internalDensity: number;
  externalDensity: number;
  conductance: number;
}

interface ProjectAnalysis {
  nodes: Map<string, GraphNode>;
  adjacencyMatrix: Matrix;
  clusters: ClusterResult[];
  globalMetrics: {
    totalComplexity: number;
    averageComplexity: number;
    complexityVariance: number;
    modularityScore: number;
    smallWorldCoefficient: number;
    scaleFreeBeta: number;
    networkDensity: number;
    averagePathLength: number;
    clusteringCoefficient: number;
  };
  qualityMetrics: {
    structuralHealth: number;
    maintainabilityScore: number;
    evolutionaryRisk: number;
    technicalDebt: number;
  };
}

export class AdvancedCodeAnalyzer {
  private readonly SUPPORTED_EXTENSIONS = new Set([
    '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp',
    '.cs', '.rb', '.php', '.go', '.rs', '.swift', '.kt', '.scala', '.clj'
  ]);

  private readonly MAX_FILES = 10000;
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly COMPLEXITY_WEIGHTS = {
    cyclomatic: 0.25,
    cognitive: 0.30,
    halstead: 0.20,
    maintainability: 0.15,
    coupling: 0.10
  };

  async analyzeProject(rootPath: string): Promise<ProjectAnalysis> {
    // Discover and validate files
    const filePaths = await this.discoverFiles(rootPath);
    await this.validateProject(filePaths);

    // Build dependency graph with advanced metrics
    const nodes = await this.buildAdvancedGraph(filePaths);
    
    // Compute centrality measures
    const adjacencyMatrix = this.buildAdjacencyMatrix(nodes);
    this.computeCentralityMeasures(nodes, adjacencyMatrix);

    // Advanced clustering with multiple algorithms
    const clusters = await this.performAdvancedClustering(nodes, adjacencyMatrix);

    // Compute global network metrics
    const globalMetrics = this.computeGlobalMetrics(nodes, adjacencyMatrix, clusters);

    // Assess project quality
    const qualityMetrics = this.assessProjectQuality(nodes, clusters, globalMetrics);

    return {
      nodes,
      adjacencyMatrix,
      clusters,
      globalMetrics,
      qualityMetrics
    };
  }

  private async discoverFiles(rootPath: string): Promise<string[]> {
    const pattern = `${rootPath}/**/*{${Array.from(this.SUPPORTED_EXTENSIONS).join(',')}}`;
    const files = await glob(pattern, {
      ignore: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/__pycache__/**',
        '**/venv/**',
        '**/target/**'
      ]
    });

    return files.filter(file => {
      try {
        const stats = statSync(file);
        return stats.isFile() && stats.size <= this.MAX_FILE_SIZE;
      } catch {
        return false;
      }
    });
  }

  private async validateProject(files: string[]): Promise<void> {
    if (files.length === 0) {
      throw new Error('No analyzable files found in project');
    }
    
    if (files.length > this.MAX_FILES) {
      throw new Error(`Project too large: ${files.length} files (max ${this.MAX_FILES})`);
    }

    // Check for minimum viable project structure
    const hasEntryPoint = files.some(f => 
      ['index', 'main', 'app', '__init__'].some(entry => 
        basename(f, extname(f)).toLowerCase().includes(entry)
      )
    );

    if (!hasEntryPoint) {
      console.warn('No clear entry point detected - analysis may be less accurate');
    }
  }

  private async buildAdvancedGraph(filePaths: string[]): Promise<Map<string, GraphNode>> {
    const nodes = new Map<string, GraphNode>();

    // Parse all files concurrently
    const parsePromises = filePaths.map(path => this.parseFile(path));
    const parseResults = await Promise.allSettled(parsePromises);

    // Build initial nodes
    parseResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const filePath = filePaths[index];
        nodes.set(filePath, result.value);
      }
    });

    // Resolve dependencies with sophisticated matching
    this.resolveDependencies(nodes);

    // Compute advanced metrics
    this.computeAdvancedMetrics(nodes);

    return nodes;
  }

  private async parseFile(filePath: string): Promise<GraphNode> {
    const content = readFileSync(filePath, 'utf-8');
    const ext = extname(filePath);
    
    let complexity: ComplexityMetrics;
    let dependencies: Set<string>;

    switch (ext) {
      case '.js':
      case '.jsx':
        ({ complexity, dependencies } = this.parseJavaScript(content, filePath));
        break;
      case '.ts':
      case '.tsx':
        ({ complexity, dependencies } = this.parseTypeScript(content, filePath));
        break;
      case '.py':
        ({ complexity, dependencies } = this.parsePython(content, filePath));
        break;
      case '.java':
        ({ complexity, dependencies } = this.parseJava(content, filePath));
        break;
      case '.cpp':
      case '.c':
      case '.h':
      case '.hpp':
        ({ complexity, dependencies } = this.parseCpp(content, filePath));
        break;
      default:
        ({ complexity, dependencies } = this.parseGeneric(content, filePath));
    }

    return {
      id: filePath,
      path: filePath,
      type: 'file',
      complexity,
      dependencies,
      dependents: new Set(),
      weight: this.calculateNodeWeight(complexity)
    };
  }

  private parseJavaScript(content: string, filePath: string): { complexity: ComplexityMetrics, dependencies: Set<string> } {
    const dependencies = new Set<string>();
    
    // ES6 imports
    const importRegex = /import\s+(?:(?:\*\s+as\s+\w+)|(?:\{[^}]*\})|(?:\w+))\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      dependencies.add(match[1]);
    }

    // CommonJS requires
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      dependencies.add(match[1]);
    }

    // Dynamic imports
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      dependencies.add(match[1]);
    }

    const complexity = this.calculateComplexityMetrics(content, 'javascript');
    
    return { complexity, dependencies };
  }

  private parseTypeScript(content: string, filePath: string): { complexity: ComplexityMetrics, dependencies: Set<string> } {
    // Remove TypeScript-specific syntax for analysis
    const jsContent = content
      .replace(/:\s*\w+(\[\])?/g, '') // Remove type annotations
      .replace(/interface\s+\w+\s*\{[^}]*\}/gs, '') // Remove interfaces
      .replace(/type\s+\w+\s*=[^;]+;/g, '') // Remove type aliases
      .replace(/as\s+\w+/g, ''); // Remove type assertions

    return this.parseJavaScript(jsContent, filePath);
  }

  private parsePython(content: string, filePath: string): { complexity: ComplexityMetrics, dependencies: Set<string> } {
    const dependencies = new Set<string>();
    
    // Import statements
    const importRegex = /^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      if (match[1]) {
        dependencies.add(match[1]);
      } else {
        const imports = match[2].split(',').map(s => s.trim().split(' as ')[0]);
        imports.forEach(imp => dependencies.add(imp));
      }
    }

    const complexity = this.calculateComplexityMetrics(content, 'python');
    
    return { complexity, dependencies };
  }

  private parseJava(content: string, filePath: string): { complexity: ComplexityMetrics, dependencies: Set<string> } {
    const dependencies = new Set<string>();
    
    // Import statements
    const importRegex = /import\s+(?:static\s+)?([a-zA-Z0-9_.]+)(?:\.\*)?;/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      dependencies.add(match[1]);
    }

    const complexity = this.calculateComplexityMetrics(content, 'java');
    
    return { complexity, dependencies };
  }

  private parseCpp(content: string, filePath: string): { complexity: ComplexityMetrics, dependencies: Set<string> } {
    const dependencies = new Set<string>();
    
    // Include statements
    const includeRegex = /#include\s*[<"]([^>"]+)[>"]/g;
    let match;
    while ((match = includeRegex.exec(content)) !== null) {
      dependencies.add(match[1]);
    }

    const complexity = this.calculateComplexityMetrics(content, 'cpp');
    
    return { complexity, dependencies };
  }

  private parseGeneric(content: string, filePath: string): { complexity: ComplexityMetrics, dependencies: Set<string> } {
    const complexity = this.calculateComplexityMetrics(content, 'generic');
    return { complexity, dependencies: new Set() };
  }

  private calculateComplexityMetrics(content: string, language: string): ComplexityMetrics {
    const lines = content.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    const commentLines = this.countCommentLines(lines, language);
    
    // Cyclomatic Complexity
    const cyclomaticComplexity = this.calculateCyclomaticComplexity(content, language);
    
    // Cognitive Complexity (more sophisticated than cyclomatic)
    const cognitiveComplexity = this.calculateCognitiveComplexity(content, language);
    
    // Halstead Metrics
    const halsteadVolume = this.calculateHalsteadVolume(content, language);
    
    // Maintainability Index
    const maintainabilityIndex = this.calculateMaintainabilityIndex(
      halsteadVolume, cyclomaticComplexity, nonEmptyLines.length
    );
    
    // Nesting Depth
    const nestingDepth = this.calculateMaxNestingDepth(content);
    
    return {
      cyclomaticComplexity,
      cognitiveComplexity,
      halsteadVolume,
      maintainabilityIndex,
      nestingDepth,
      fanIn: 0, // Will be computed later
      fanOut: 0, // Will be computed later
      linesOfCode: lines.length,
      logicalLinesOfCode: nonEmptyLines.length,
      commentDensity: commentLines / Math.max(1, nonEmptyLines.length),
      couplingBetweenObjects: 0, // Will be computed later
      lackOfCohesionMetrics: 0 // Will be computed later
    };
  }

  private calculateCyclomaticComplexity(content: string, language: string): number {
    const keywords = this.getComplexityKeywords(language);
    let complexity = 1; // Base complexity
    
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = content.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    // Logical operators
    const logicalOps = ['&&', '||', '??', 'and', 'or'];
    for (const op of logicalOps) {
      const regex = new RegExp(`\\${op}`, 'g');
      const matches = content.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }

  private calculateCognitiveComplexity(content: string, language: string): number {
    let complexity = 0;
    let nestingLevel = 0;
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Increment nesting
      if (this.isNestingIncrement(trimmed, language)) {
        nestingLevel++;
      }
      
      // Decrement nesting
      if (this.isNestingDecrement(trimmed, language)) {
        nestingLevel = Math.max(0, nestingLevel - 1);
      }
      
      // Add complexity with nesting multiplier
      if (this.isComplexityIncrement(trimmed, language)) {
        complexity += 1 + nestingLevel;
      }
    }
    
    return complexity;
  }

  private calculateHalsteadVolume(content: string, language: string): number {
    const { operators, operands } = this.extractHalsteadElements(content, language);
    
    const n1 = operators.size; // Number of distinct operators
    const n2 = operands.size;  // Number of distinct operands
    const N1 = Array.from(operators.values()).reduce((sum, count) => sum + count, 0);
    const N2 = Array.from(operands.values()).reduce((sum, count) => sum + count, 0);
    
    const vocabulary = n1 + n2;
    const length = N1 + N2;
    
    return vocabulary > 0 ? length * Math.log2(vocabulary) : 0;
  }

  private calculateMaintainabilityIndex(halsteadVolume: number, cyclomaticComplexity: number, loc: number): number {
    // Microsoft's maintainability index formula
    const mi = 171 - 5.2 * Math.log(halsteadVolume) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(loc);
    return Math.max(0, Math.min(100, mi));
  }

  private calculateMaxNestingDepth(content: string): number {
    let maxDepth = 0;
    let currentDepth = 0;
    
    for (const char of content) {
      if (char === '{' || char === '(') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '}' || char === ')') {
        currentDepth = Math.max(0, currentDepth - 1);
      }
    }
    
    return maxDepth;
  }

  private resolveDependencies(nodes: Map<string, GraphNode>): void {
    const fileMap = this.buildFileMap(nodes);
    
    for (const [filePath, node] of nodes) {
      const resolvedDeps = new Set<string>();
      
      for (const dep of node.dependencies) {
        const resolved = this.resolveDependencyPath(dep, filePath, fileMap);
        if (resolved && nodes.has(resolved)) {
          resolvedDeps.add(resolved);
          nodes.get(resolved)!.dependents.add(filePath);
        }
      }
      
      node.dependencies = resolvedDeps;
    }
  }

  private buildFileMap(nodes: Map<string, GraphNode>): Map<string, string> {
    const fileMap = new Map<string, string>();
    
    for (const [filePath] of nodes) {
      const fileName = basename(filePath, extname(filePath));
      const dirName = basename(dirname(filePath));
      
      fileMap.set(fileName, filePath);
      fileMap.set(`${dirName}/${fileName}`, filePath);
      fileMap.set(filePath, filePath);
    }
    
    return fileMap;
  }

  private resolveDependencyPath(dep: string, currentFile: string, fileMap: Map<string, string>): string | null {
    // Skip external dependencies
    if (!dep.startsWith('.') && !dep.startsWith('/') && !fileMap.has(dep)) {
      return null;
    }
    
    // Direct resolution
    if (fileMap.has(dep)) {
      return fileMap.get(dep)!;
    }
    
    // Relative path resolution
    if (dep.startsWith('.')) {
      const currentDir = dirname(currentFile);
      const resolvedPath = join(currentDir, dep);
      
      // Try with common extensions
      const extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp'];
      for (const ext of extensions) {
        const withExt = resolvedPath + ext;
        if (fileMap.has(withExt)) {
          return withExt;
        }
      }
    }
    
    return null;
  }

  private computeAdvancedMetrics(nodes: Map<string, GraphNode>): void {
    // Compute fan-in and fan-out
    for (const [filePath, node] of nodes) {
      node.complexity.fanOut = node.dependencies.size;
      node.complexity.fanIn = node.dependents.size;
      
      // Coupling Between Objects (simplified)
      node.complexity.couplingBetweenObjects = node.dependencies.size + node.dependents.size;
    }
  }

  private calculateNodeWeight(complexity: ComplexityMetrics): number {
    return (
      complexity.cyclomaticComplexity * this.COMPLEXITY_WEIGHTS.cyclomatic +
      complexity.cognitiveComplexity * this.COMPLEXITY_WEIGHTS.cognitive +
      (complexity.halsteadVolume / 100) * this.COMPLEXITY_WEIGHTS.halstead +
      (100 - complexity.maintainabilityIndex) * this.COMPLEXITY_WEIGHTS.maintainability +
      complexity.couplingBetweenObjects * this.COMPLEXITY_WEIGHTS.coupling
    );
  }

  private buildAdjacencyMatrix(nodes: Map<string, GraphNode>): Matrix {
    const nodeArray = Array.from(nodes.keys());
    const size = nodeArray.length;
    const matrix = Matrix.zeros(size, size);
    
    nodeArray.forEach((source, i) => {
      const sourceNode = nodes.get(source)!;
      sourceNode.dependencies.forEach(target => {
        const j = nodeArray.indexOf(target);
        if (j !== -1) {
          matrix.set(i, j, 1);
        }
      });
    });
    
    return matrix;
  }

  private computeCentralityMeasures(nodes: Map<string, GraphNode>, adjacencyMatrix: Matrix): void {
    const nodeArray = Array.from(nodes.keys());
    
    // Eigenvector centrality
    const eigenCentrality = this.computeEigenvectorCentrality(adjacencyMatrix);
    
    // Betweenness centrality
    const betweennessCentrality = this.computeBetweennessCentrality(adjacencyMatrix);
    
    // Closeness centrality
    const closenessCentrality = this.computeClosenessCentrality(adjacencyMatrix);
    
    // PageRank
    const pagerank = this.computePageRank(adjacencyMatrix);
    
    nodeArray.forEach((nodeId, index) => {
      const node = nodes.get(nodeId)!;
      node.centrality = {
        eigenvector: eigenCentrality[index] || 0,
        betweenness: betweennessCentrality[index] || 0,
        closeness: closenessCentrality[index] || 0,
        pagerank: pagerank[index] || 0
      };
    });
  }

  private computeEigenvectorCentrality(adjacencyMatrix: Matrix): number[] {
    try {
      const eigenDecomp = new EigenvalueDecomposition(adjacencyMatrix);
      const eigenValues = eigenDecomp.realEigenvalues;
      const eigenVectors = eigenDecomp.eigenvectorMatrix;
      
      // Find the largest eigenvalue
      const maxIndex = eigenValues.indexOf(Math.max(...eigenValues));
      const principalEigenvector = eigenVectors.getColumn(maxIndex);
      
      // Normalize to positive values
      const minVal = Math.min(...principalEigenvector);
      return principalEigenvector.map(val => Math.abs(val - minVal));
    } catch {
      return new Array(adjacencyMatrix.rows).fill(0);
    }
  }

  private computeBetweennessCentrality(adjacencyMatrix: Matrix): number[] {
    const n = adjacencyMatrix.rows;
    const betweenness = new Array(n).fill(0);
    
    // Floyd-Warshall for all pairs shortest paths
    const dist = Matrix.zeros(n, n);
    const next = Matrix.zeros(n, n);
    
    // Initialize
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          dist.set(i, j, 0);
        } else if (adjacencyMatrix.get(i, j) > 0) {
          dist.set(i, j, 1);
          next.set(i, j, j);
        } else {
          dist.set(i, j, Infinity);
        }
      }
    }
    
    // Floyd-Warshall
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (dist.get(i, k) + dist.get(k, j) < dist.get(i, j)) {
            dist.set(i, j, dist.get(i, k) + dist.get(k, j));
            next.set(i, j, next.get(i, k));
          }
        }
      }
    }
    
    // Count paths through each node
    for (let s = 0; s < n; s++) {
      for (let t = 0; t < n; t++) {
        if (s !== t && dist.get(s, t) !== Infinity) {
          const path = this.reconstructPath(next, s, t);
          for (let i = 1; i < path.length - 1; i++) {
            betweenness[path[i]]++;
          }
        }
      }
    }
    
    // Normalize
    const normalizationFactor = (n - 1) * (n - 2) / 2;
    return betweenness.map(val => val / normalizationFactor);
  }

  private computeClosenessCentrality(adjacencyMatrix: Matrix): number[] {
    const n = adjacencyMatrix.rows;
    const closeness = new Array(n).fill(0);
    
    // Use Floyd-Warshall distances from betweenness calculation
    const dist = this.computeAllPairsShortestPaths(adjacencyMatrix);
    
    for (let i = 0; i < n; i++) {
      let totalDistance = 0;
      let reachableNodes = 0;
      
      for (let j = 0; j < n; j++) {
        if (i !== j && dist.get(i, j) < Infinity) {
          totalDistance += dist.get(i, j);
          reachableNodes++;
        }
      }
      
      closeness[i] = reachableNodes > 0 ? reachableNodes / totalDistance : 0;
    }
    
    return closeness;
  }

  private computePageRank(adjacencyMatrix: Matrix, dampingFactor: number = 0.85, tolerance: number = 1e-6): number[] {
    const n = adjacencyMatrix.rows;
    let pagerank = new Array(n).fill(1 / n);
    let newPagerank = new Array(n);
    
    // Compute out-degrees
    const outDegrees = new Array(n);
    for (let i = 0; i < n; i++) {
      outDegrees[i] = adjacencyMatrix.getRow(i).reduce((sum, val) => sum + val, 0);
    }
    
    let iteration = 0;
    const maxIterations = 100;
    
    while (iteration < maxIterations) {
      for (let i = 0; i < n; i++) {
        newPagerank[i] = (1 - dampingFactor) / n;
        
        for (let j = 0; j < n; j++) {
          if (adjacencyMatrix.get(j, i) > 0 && outDegrees[j] > 0) {
            newPagerank[i] += dampingFactor * pagerank[j] / outDegrees[j];
          }
        }
      }
      
      // Check convergence
      const diff = newPagerank.reduce((sum, val, i) => sum + Math.abs(val - pagerank[i]), 0);
      if (diff < tolerance) break;
      
      pagerank = [...newPagerank];
      iteration++;
    }
    
    return pagerank;
  }

  private async performAdvancedClustering(nodes: Map<string, GraphNode>, adjacencyMatrix: Matrix): Promise<ClusterResult[]> {
    // Try multiple clustering algorithms and select the best result
    const algorithms = [
      () => this.louvainClustering(nodes, adjacencyMatrix),
      () => this.spectralClustering(nodes, adjacencyMatrix),
      () => this.modularityClustering(nodes, adjacencyMatrix)
    ];
    
    const results = await Promise.all(algorithms.map(algo => 
      algo().catch(() => this.fallbackClustering(nodes))
    ));
    
    // Select best clustering based on modularity and silhouette score
    return results.reduce((best, current) => {
      const bestScore = this.evaluateClusteringQuality(best, nodes, adjacencyMatrix);
      const currentScore = this.evaluateClusteringQuality(current, nodes, adjacencyMatrix);
      return currentScore > bestScore ? current : best;
    });
  }

  private louvainClustering(nodes: Map<string, GraphNode>, adjacencyMatrix: Matrix): ClusterResult[] {
    // Simplified Louvain algorithm implementation
    const nodeArray = Array.from(nodes.keys());
    const n = nodeArray.length;
    let communities = nodeArray.map((_, i) => i); // Each node in its own community initially
    
    let improved = true;
    let iteration = 0;
    const maxIterations = 50;
    
    while (improved && iteration < maxIterations) {
      improved = false;
      
      for (let i = 0; i < n; i++) {
        const currentCommunity = communities[i];
        let bestCommunity = currentCommunity;
        let bestGain = 0;
        
        // Try moving to neighboring communities
        const neighbors = this.getNeighbors(i, adjacencyMatrix);
        const neighborCommunities = new Set(neighbors.map(j => communities[j]));
        
        for (const community of neighborCommunities) {
          if (community !== currentCommunity) {
            const gain = this.modularityGain(i, community, communities, adjacencyMatrix);
            if (gain > bestGain) {
              bestGain = gain;
              bestCommunity = community;
            }
          }
        }
        
        if (bestCommunity !== currentCommunity) {
          communities[i] = bestCommunity;
          improved = true;
        }
      }
      
      iteration++;
    }
    
    return this.buildClustersFromCommunities(communities, nodeArray, nodes, adjacencyMatrix);
  }

  private spectralClustering(nodes: Map<string, GraphNode>, adjacencyMatrix: Matrix): ClusterResult[] {
    const n = adjacencyMatrix.rows;
    
    // Compute the Laplacian matrix
    const degree = Matrix.zeros(n, n);
    for (let i = 0; i < n; i++) {
      const d = adjacencyMatrix.getRow(i).reduce((sum, val) => sum + val, 0);
      degree.set(i, i, d);
    }
    
    const laplacian = Matrix.sub(degree, adjacencyMatrix);
    
    try {
      // Eigendecomposition
      const eigenDecomp = new EigenvalueDecomposition(laplacian);
      const eigenValues = eigenDecomp.realEigenvalues;
      const eigenVectors = eigenDecomp.eigenvectorMatrix;
      
      // Use the second smallest eigenvalue's eigenvector (Fiedler vector)
      const sortedIndices = eigenValues
        .map((val, idx) => ({ val, idx }))
        .sort((a, b) => a.val - b.val)
        .map(item => item.idx);
      
      const fiedlerVector = eigenVectors.getColumn(sortedIndices[1]);
      
      // Partition based on the sign of the Fiedler vector
      const nodeArray = Array.from(nodes.keys());
      const communities = fiedlerVector.map(val => val >= 0 ? 0 : 1);
      
      return this.buildClustersFromCommunities(communities, nodeArray, nodes, adjacencyMatrix);
    } catch {
      return this.fallbackClustering(nodes);
    }
  }

  private modularityClustering(nodes: Map<string, GraphNode>, adjacencyMatrix: Matrix): ClusterResult[] {
    // Greedy modularity optimization
    const nodeArray = Array.from(nodes.keys());
    const n = nodeArray.length;
    let communities = nodeArray.map((_, i) => i);
    
    let bestModularity = this.calculateModularity(communities, adjacencyMatrix);
    let improved = true;
    
    while (improved) {
      improved = false;
      let bestMove = null;
      let bestNewModularity = bestModularity;
      
      for (let i = 0; i < n; i++) {
        const currentCommunity = communities[i];
        const neighbors = this.getNeighbors(i, adjacencyMatrix);
        const neighborCommunities = new Set(neighbors.map(j => communities[j]));
        
        for (const newCommunity of neighborCommunities) {
          if (newCommunity !== currentCommunity) {
            const testCommunities = [...communities];
            testCommunities[i] = newCommunity;
            
            const newModularity = this.calculateModularity(testCommunities, adjacencyMatrix);
            if (newModularity > bestNewModularity) {
              bestNewModularity = newModularity;
              bestMove = { node: i, community: newCommunity };
            }
          }
        }
      }
      
      if (bestMove) {
        communities[bestMove.node] = bestMove.community;
        bestModularity = bestNewModularity;
        improved = true;
      }
    }
    
    return this.buildClustersFromCommunities(communities, nodeArray, nodes, adjacencyMatrix);
  }

  private fallbackClustering(nodes: Map<string, GraphNode>): ClusterResult[] {
    // Hierarchical clustering based on complexity similarity
    const nodeArray = Array.from(nodes.keys());
    const clusters: string[][] = nodeArray.map(node => [node]);
    
    while (clusters.length > Math.ceil(Math.sqrt(nodeArray.length))) {
      let bestMerge = null;
      let bestSimilarity = -Infinity;
      
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const similarity = this.calculateClusterSimilarity(clusters[i], clusters[j], nodes);
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestMerge = { i, j };
          }
        }
      }
      
      if (bestMerge) {
        const merged = [...clusters[bestMerge.i], ...clusters[bestMerge.j]];
        clusters.splice(Math.max(bestMerge.i, bestMerge.j), 1);
        clusters.splice(Math.min(bestMerge.i, bestMerge.j), 1);
        clusters.push(merged);
      } else {
        break;
      }
    }
    
    return clusters.map((cluster, index) => this.buildClusterResult(cluster, index.toString(), nodes));
  }

  private getNeighbors(nodeIndex: number, adjacencyMatrix: Matrix): number[] {
    const neighbors: number[] = [];
    const row = adjacencyMatrix.getRow(nodeIndex);
    const col = adjacencyMatrix.getColumn(nodeIndex);
    
    for (let i = 0; i < row.length; i++) {
      if (row[i] > 0 || col[i] > 0) {
        neighbors.push(i);
      }
    }
    
    return neighbors;
  }

  private modularityGain(node: number, newCommunity: number, communities: number[], adjacencyMatrix: Matrix): number {
    const m = adjacencyMatrix.sum() / 2; // Total number of edges
    if (m === 0) return 0;
    
    const ki = adjacencyMatrix.getRow(node).reduce((sum, val) => sum + val, 0);
    const kiIn = this.getInternalDegree(node, newCommunity, communities, adjacencyMatrix);
    const sigmaTot = this.getCommunityDegree(newCommunity, communities, adjacencyMatrix);
    
    return (kiIn / m) - Math.pow((sigmaTot + ki) / (2 * m), 2) + Math.pow(sigmaTot / (2 * m), 2) + Math.pow(ki / (2 * m), 2);
  }

  private getInternalDegree(node: number, community: number, communities: number[], adjacencyMatrix: Matrix): number {
    let degree = 0;
    for (let i = 0; i < communities.length; i++) {
      if (communities[i] === community && i !== node) {
        degree += adjacencyMatrix.get(node, i);
      }
    }
    return degree;
  }

  private getCommunityDegree(community: number, communities: number[], adjacencyMatrix: Matrix): number {
    let degree = 0;
    for (let i = 0; i < communities.length; i++) {
      if (communities[i] === community) {
        degree += adjacencyMatrix.getRow(i).reduce((sum, val) => sum + val, 0);
      }
    }
    return degree;
  }

  private calculateModularity(communities: number[], adjacencyMatrix: Matrix): number {
    const m = adjacencyMatrix.sum() / 2;
    if (m === 0) return 0;
    
    let modularity = 0;
    const n = adjacencyMatrix.rows;
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (communities[i] === communities[j]) {
          const aij = adjacencyMatrix.get(i, j);
          const ki = adjacencyMatrix.getRow(i).reduce((sum, val) => sum + val, 0);
          const kj = adjacencyMatrix.getRow(j).reduce((sum, val) => sum + val, 0);
          
          modularity += aij - (ki * kj) / (2 * m);
        }
      }
    }
    
    return modularity / (2 * m);
  }

  private buildClustersFromCommunities(communities: number[], nodeArray: string[], nodes: Map<string, GraphNode>, adjacencyMatrix: Matrix): ClusterResult[] {
    const communityMap = new Map<number, string[]>();
    
    communities.forEach((community, index) => {
      if (!communityMap.has(community)) {
        communityMap.set(community, []);
      }
      communityMap.get(community)!.push(nodeArray[index]);
    });
    
    return Array.from(communityMap.entries()).map(([communityId, nodeIds]) => 
      this.buildClusterResult(nodeIds, communityId.toString(), nodes)
    );
  }

  private buildClusterResult(nodeIds: string[], clusterId: string, nodes: Map<string, GraphNode>): ClusterResult {
    const clusterNodes = nodeIds.map(id => nodes.get(id)!);
    
    // Calculate cluster metrics
    const cohesion = this.calculateCohesion(nodeIds, nodes);
    const coupling = this.calculateCoupling(nodeIds, nodes);
    const modularity = this.calculateClusterModularity(nodeIds, nodes);
    const silhouetteScore = this.calculateSilhouetteScore(nodeIds, nodes);
    const internalDensity = this.calculateInternalDensity(nodeIds, nodes);
    const externalDensity = this.calculateExternalDensity(nodeIds, nodes);
    const conductance = this.calculateConductance(nodeIds, nodes);
    
    return {
      id: clusterId,
      nodes: nodeIds,
      cohesion,
      coupling,
      modularity,
      silhouetteScore,
      internalDensity,
      externalDensity,
      conductance
    };
  }

  private calculateCohesion(nodeIds: string[], nodes: Map<string, GraphNode>): number {
    let internalConnections = 0;
    let totalPossibleConnections = 0;
    
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const node1 = nodes.get(nodeIds[i])!;
        const node2 = nodes.get(nodeIds[j])!;
        
        if (node1.dependencies.has(nodeIds[j]) || node2.dependencies.has(nodeIds[i])) {
          internalConnections++;
        }
        totalPossibleConnections++;
      }
    }
    
    return totalPossibleConnections > 0 ? internalConnections / totalPossibleConnections : 0;
  }

  private calculateCoupling(nodeIds: string[], nodes: Map<string, GraphNode>): number {
    const nodeSet = new Set(nodeIds);
    let externalConnections = 0;
    let totalConnections = 0;
    
    for (const nodeId of nodeIds) {
      const node = nodes.get(nodeId)!;
      totalConnections += node.dependencies.size + node.dependents.size;
      
      for (const dep of node.dependencies) {
        if (!nodeSet.has(dep)) {
          externalConnections++;
        }
      }
      
      for (const dependent of node.dependents) {
        if (!nodeSet.has(dependent)) {
          externalConnections++;
        }
      }
    }
    
    return totalConnections > 0 ? externalConnections / totalConnections : 0;
  }

  private calculateClusterModularity(nodeIds: string[], nodes: Map<string, GraphNode>): number {
    // Simplified modularity calculation for a single cluster
    const nodeSet = new Set(nodeIds);
    let internalEdges = 0;
    let totalDegree = 0;
    let totalEdges = 0;
    
    // Count all edges in the graph
    for (const [_, node] of nodes) {
      totalEdges += node.dependencies.size;
    }
    
    // Count internal edges and degrees for this cluster
    for (const nodeId of nodeIds) {
      const node = nodes.get(nodeId)!;
      totalDegree += node.dependencies.size + node.dependents.size;
      
      for (const dep of node.dependencies) {
        if (nodeSet.has(dep)) {
          internalEdges++;
        }
      }
    }
    
    if (totalEdges === 0) return 0;
    
    const expectedInternal = Math.pow(totalDegree / (2 * totalEdges), 2) * totalEdges;
    return (internalEdges - expectedInternal) / totalEdges;
  }

  private calculateSilhouetteScore(nodeIds: string[], nodes: Map<string, GraphNode>): number {
    // Simplified silhouette calculation based on complexity similarity
    let totalScore = 0;
    
    for (const nodeId of nodeIds) {
      const node = nodes.get(nodeId)!;
      
      // Average distance within cluster
      let intraClusterDistance = 0;
      let intraCount = 0;
      
      for (const otherId of nodeIds) {
        if (otherId !== nodeId) {
          const otherNode = nodes.get(otherId)!;
          intraClusterDistance += this.calculateComplexityDistance(node, otherNode);
          intraCount++;
        }
      }
      
      const avgIntraDistance = intraCount > 0 ? intraClusterDistance / intraCount : 0;
      
      // Average distance to nearest cluster (simplified)
      let minInterClusterDistance = Infinity;
      for (const [otherNodeId, otherNode] of nodes) {
        if (!nodeIds.includes(otherNodeId)) {
          const distance = this.calculateComplexityDistance(node, otherNode);
          minInterClusterDistance = Math.min(minInterClusterDistance, distance);
        }
      }
      
      if (minInterClusterDistance === Infinity) minInterClusterDistance = 0;
      
      const silhouette = minInterClusterDistance > avgIntraDistance ? 
        (minInterClusterDistance - avgIntraDistance) / Math.max(minInterClusterDistance, avgIntraDistance) : 0;
      
      totalScore += silhouette;
    }
    
    return nodeIds.length > 0 ? totalScore / nodeIds.length : 0;
  }

  private calculateInternalDensity(nodeIds: string[], nodes: Map<string, GraphNode>): number {
    const nodeSet = new Set(nodeIds);
    let internalEdges = 0;
    let possibleEdges = nodeIds.length * (nodeIds.length - 1);
    
    for (const nodeId of nodeIds) {
      const node = nodes.get(nodeId)!;
      for (const dep of node.dependencies) {
        if (nodeSet.has(dep)) {
          internalEdges++;
        }
      }
    }
    
    return possibleEdges > 0 ? internalEdges / possibleEdges : 0;
  }

  private calculateExternalDensity(nodeIds: string[], nodes: Map<string, GraphNode>): number {
    const nodeSet = new Set(nodeIds);
    const externalNodes = Array.from(nodes.keys()).filter(id => !nodeSet.has(id));
    
    let externalEdges = 0;
    let possibleExternalEdges = nodeIds.length * externalNodes.length;
    
    for (const nodeId of nodeIds) {
      const node = nodes.get(nodeId)!;
      for (const dep of node.dependencies) {
        if (!nodeSet.has(dep)) {
          externalEdges++;
        }
      }
      for (const dependent of node.dependents) {
        if (!nodeSet.has(dependent)) {
          externalEdges++;
        }
      }
    }
    
    return possibleExternalEdges > 0 ? externalEdges / possibleExternalEdges : 0;
  }

  private calculateConductance(nodeIds: string[], nodes: Map<string, GraphNode>): number {
    const nodeSet = new Set(nodeIds);
    let cutEdges = 0;
    let volumeCluster = 0;
    
    for (const nodeId of nodeIds) {
      const node = nodes.get(nodeId)!;
      const degree = node.dependencies.size + node.dependents.size;
      volumeCluster += degree;
      
      // Count edges leaving the cluster
      for (const dep of node.dependencies) {
        if (!nodeSet.has(dep)) {
          cutEdges++;
        }
      }
      for (const dependent of node.dependents) {
        if (!nodeSet.has(dependent)) {
          cutEdges++;
        }
      }
    }
    
    return volumeCluster > 0 ? cutEdges / volumeCluster : 0;
  }

  private calculateComplexityDistance(node1: GraphNode, node2: GraphNode): number {
    const c1 = node1.complexity;
    const c2 = node2.complexity;
    
    // Euclidean distance in normalized complexity space
    const features = [
      (c1.cyclomaticComplexity - c2.cyclomaticComplexity) / 50,
      (c1.cognitiveComplexity - c2.cognitiveComplexity) / 50,
      (c1.halsteadVolume - c2.halsteadVolume) / 1000,
      (c1.maintainabilityIndex - c2.maintainabilityIndex) / 100,
      (c1.nestingDepth - c2.nestingDepth) / 10
    ];
    
    return Math.sqrt(features.reduce((sum, diff) => sum + diff * diff, 0));
  }

  private calculateClusterSimilarity(cluster1: string[], cluster2: string[], nodes: Map<string, GraphNode>): number {
    let totalSimilarity = 0;
    let count = 0;
    
    for (const node1Id of cluster1) {
      for (const node2Id of cluster2) {
        const node1 = nodes.get(node1Id)!;
        const node2 = nodes.get(node2Id)!;
        
        const distance = this.calculateComplexityDistance(node1, node2);
        totalSimilarity += 1 / (1 + distance); // Convert distance to similarity
        count++;
      }
    }
    
    return count > 0 ? totalSimilarity / count : 0;
  }

  private evaluateClusteringQuality(clusters: ClusterResult[], nodes: Map<string, GraphNode>, adjacencyMatrix: Matrix): number {
    const avgModularity = clusters.reduce((sum, cluster) => sum + cluster.modularity, 0) / clusters.length;
    const avgSilhouette = clusters.reduce((sum, cluster) => sum + cluster.silhouetteScore, 0) / clusters.length;
    const avgCohesion = clusters.reduce((sum, cluster) => sum + cluster.cohesion, 0) / clusters.length;
    const avgCoupling = clusters.reduce((sum, cluster) => sum + (1 - cluster.coupling), 0) / clusters.length;
    
    return (avgModularity * 0.3 + avgSilhouette * 0.3 + avgCohesion * 0.2 + avgCoupling * 0.2);
  }

  private computeGlobalMetrics(nodes: Map<string, GraphNode>, adjacencyMatrix: Matrix, clusters: ClusterResult[]): ProjectAnalysis['globalMetrics'] {
    const complexities = Array.from(nodes.values()).map(node => node.weight);
    const totalComplexity = complexities.reduce((sum, c) => sum + c, 0);
    const averageComplexity = totalComplexity / complexities.length;
    const complexityVariance = complexities.reduce((sum, c) => sum + Math.pow(c - averageComplexity, 2), 0) / complexities.length;
    
    const modularityScore = this.calculateModularity(
      this.getCommunityAssignment(clusters, nodes), 
      adjacencyMatrix
    );
    
    const networkDensity = this.calculateNetworkDensity(adjacencyMatrix);
    const averagePathLength = this.calculateAveragePathLength(adjacencyMatrix);
    const clusteringCoefficient = this.calculateClusteringCoefficient(adjacencyMatrix);
    const smallWorldCoefficient = this.calculateSmallWorldCoefficient(clusteringCoefficient, averagePathLength);
    const scaleFreeBeta = this.calculateScaleFreeExponent(nodes);
    
    return {
      totalComplexity,
      averageComplexity,
      complexityVariance,
      modularityScore,
      smallWorldCoefficient,
      scaleFreeBeta,
      networkDensity,
      averagePathLength,
      clusteringCoefficient
    };
  }

  private getCommunityAssignment(clusters: ClusterResult[], nodes: Map<string, GraphNode>): number[] {
    const nodeArray = Array.from(nodes.keys());
    const communities = new Array(nodeArray.length).fill(-1);
    
    clusters.forEach((cluster, clusterIndex) => {
      cluster.nodes.forEach(nodeId => {
        const nodeIndex = nodeArray.indexOf(nodeId);
        if (nodeIndex !== -1) {
          communities[nodeIndex] = clusterIndex;
        }
      });
    });
    
    return communities;
  }

  private calculateNetworkDensity(adjacencyMatrix: Matrix): number {
    const n = adjacencyMatrix.rows;
    const totalEdges = adjacencyMatrix.sum();
    const possibleEdges = n * (n - 1);
    
    return possibleEdges > 0 ? totalEdges / possibleEdges : 0;
  }

  private calculateAveragePathLength(adjacencyMatrix: Matrix): number {
    const distances = this.computeAllPairsShortestPaths(adjacencyMatrix);
    let totalDistance = 0;
    let pathCount = 0;
    
    for (let i = 0; i < distances.rows; i++) {
      for (let j = 0; j < distances.columns; j++) {
        if (i !== j && distances.get(i, j) < Infinity) {
          totalDistance += distances.get(i, j);
          pathCount++;
        }
      }
    }
    
    return pathCount > 0 ? totalDistance / pathCount : 0;
  }

  private calculateClusteringCoefficient(adjacencyMatrix: Matrix): number {
    const n = adjacencyMatrix.rows;
    let totalCoefficient = 0;
    
    for (let i = 0; i < n; i++) {
      const neighbors = this.getNeighbors(i, adjacencyMatrix);
      if (neighbors.length < 2) continue;
      
      let triangles = 0;
      for (let j = 0; j < neighbors.length; j++) {
        for (let k = j + 1; k < neighbors.length; k++) {
          if (adjacencyMatrix.get(neighbors[j], neighbors[k]) > 0) {
            triangles++;
          }
        }
      }
      
      const possibleTriangles = neighbors.length * (neighbors.length - 1) / 2;
      totalCoefficient += possibleTriangles > 0 ? triangles / possibleTriangles : 0;
    }
    
    return n > 0 ? totalCoefficient / n : 0;
  }

  private calculateSmallWorldCoefficient(clusteringCoeff: number, avgPathLength: number): number {
    // Simplified small-world coefficient
    // In a true small-world network: high clustering, low path length
    return avgPathLength > 0 ? clusteringCoeff / avgPathLength : 0;
  }

  private calculateScaleFreeExponent(nodes: Map<string, GraphNode>): number {
    // Analyze degree distribution to estimate scale-free parameter
    const degrees = Array.from(nodes.values()).map(node => 
      node.dependencies.size + node.dependents.size
    );
    
    const degreeCount = new Map<number, number>();
    degrees.forEach(degree => {
      degreeCount.set(degree, (degreeCount.get(degree) || 0) + 1);
    });
    
    // Simple power-law fitting (would need more sophisticated methods in practice)
    const validDegrees = Array.from(degreeCount.entries()).filter(([degree, count]) => degree > 0 && count > 0);
    if (validDegrees.length < 3) return 0;
    
    // Linear regression on log-log scale
    const logData = validDegrees.map(([degree, count]) => [Math.log(degree), Math.log(count)]);
    const n = logData.length;
    const sumX = logData.reduce((sum, [x, _]) => sum + x, 0);
    const sumY = logData.reduce((sum, [_, y]) => sum + y, 0);
    const sumXY = logData.reduce((sum, [x, y]) => sum + x * y, 0);
    const sumX2 = logData.reduce((sum, [x, _]) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return Math.abs(slope); // Return absolute value of the slope (beta exponent)
  }

  private computeAllPairsShortestPaths(adjacencyMatrix: Matrix): Matrix {
    const n = adjacencyMatrix.rows;
    const dist = Matrix.zeros(n, n);
    
    // Initialize distances
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          dist.set(i, j, 0);
        } else if (adjacencyMatrix.get(i, j) > 0) {
          dist.set(i, j, 1);
        } else {
          dist.set(i, j, Infinity);
        }
      }
    }
    
    // Floyd-Warshall algorithm
    for (let k = 0; k < n; k++) {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const newDist = dist.get(i, k) + dist.get(k, j);
          if (newDist < dist.get(i, j)) {
            dist.set(i, j, newDist);
          }
        }
      }
    }
    
    return dist;
  }

  private reconstructPath(next: Matrix, start: number, end: number): number[] {
    if (next.get(start, end) === 0) return [];
    
    const path = [start];
    let current = start;
    
    while (current !== end) {
      current = next.get(current, end);
      path.push(current);
    }
    
    return path;
  }

  private assessProjectQuality(nodes: Map<string, GraphNode>, clusters: ClusterResult[], globalMetrics: ProjectAnalysis['globalMetrics']): ProjectAnalysis['qualityMetrics'] {
    // Structural Health: Based on modularity and clustering quality
    const structuralHealth = Math.min(100, Math.max(0, 
      (globalMetrics.modularityScore * 50 + 
       globalMetrics.clusteringCoefficient * 30 + 
       (1 - globalMetrics.networkDensity) * 20) * 100
    ));
    
    // Maintainability Score: Based on complexity distribution and coupling
    const avgCoupling = clusters.reduce((sum, cluster) => sum + cluster.coupling, 0) / clusters.length;
    const maintainabilityScore = Math.min(100, Math.max(0,
      (100 - globalMetrics.averageComplexity * 2 - avgCoupling * 50)
    ));
    
    // Evolutionary Risk: Based on complexity variance and high-risk nodes
    const highComplexityNodes = Array.from(nodes.values()).filter(node => node.weight > globalMetrics.averageComplexity * 2).length;
    const evolutionaryRisk = Math.min(100, Math.max(0,
      (Math.sqrt(globalMetrics.complexityVariance) * 10 + 
       (highComplexityNodes / nodes.size) * 100)
    ));
    
    // Technical Debt: Combined metric of various debt indicators
    const technicalDebt = Math.min(100, Math.max(0,
      (evolutionaryRisk * 0.4 + 
       (100 - maintainabilityScore) * 0.4 + 
       (100 - structuralHealth) * 0.2)
    ));
    
    return {
      structuralHealth,
      maintainabilityScore,
      evolutionaryRisk,
      technicalDebt
    };
  }

  // Helper methods for parsing different languages
  private getComplexityKeywords(language: string): string[] {
    const keywordMap: Record<string, string[]> = {
      javascript: ['if', 'else', 'while', 'for', 'switch', 'case', 'catch', 'finally'],
      typescript: ['if', 'else', 'while', 'for', 'switch', 'case', 'catch', 'finally'],
      python: ['if', 'elif', 'else', 'while', 'for', 'except', 'finally', 'with'],
      java: ['if', 'else', 'while', 'for', 'switch', 'case', 'catch', 'finally'],
      cpp: ['if', 'else', 'while', 'for', 'switch', 'case', 'catch'],
      generic: ['if', 'else', 'while', 'for', 'switch', 'case']
    };
    
    return keywordMap[language] || keywordMap.generic;
  }

  private countCommentLines(lines: string[], language: string): number {
    const commentPatterns: Record<string, RegExp[]> = {
      javascript: [/^\s*\/\//, /^\s*\/\*/, /^\s*\*/],
      typescript: [/^\s*\/\//, /^\s*\/\*/, /^\s*\*/],
      python: [/^\s*#/, /^\s*"""/, /^\s*'''/],
      java: [/^\s*\/\//, /^\s*\/\*/, /^\s*\*/],
      cpp: [/^\s*\/\//, /^\s*\/\*/, /^\s*\*/],
      generic: [/^\s*\/\//, /^\s*#/]
    };
    
    const patterns = commentPatterns[language] || commentPatterns.generic;
    return lines.filter(line => patterns.some(pattern => pattern.test(line))).length;
  }

  private isNestingIncrement(line: string, language: string): boolean {
    const patterns: Record<string, RegExp[]> = {
      javascript: [/\{\s*$/, /if\s*\(/, /while\s*\(/, /for\s*\(/, /function\s*\w*\s*\(/],
      typescript: [/\{\s*$/, /if\s*\(/, /while\s*\(/, /for\s*\(/, /function\s*\w*\s*\(/],
      python: [/:\s*$/, /if\s+/, /while\s+/, /for\s+/, /def\s+/, /class\s+/],
      java: [/\{\s*$/, /if\s*\(/, /while\s*\(/, /for\s*\(/],
      cpp: [/\{\s*$/, /if\s*\(/, /while\s*\(/, /for\s*\(/],
      generic: [/\{\s*$/, /if\s*\(/]
    };
    
    const langPatterns = patterns[language] || patterns.generic;
    return langPatterns.some(pattern => pattern.test(line));
  }

  private isNestingDecrement(line: string, language: string): boolean {
    if (language === 'python') {
      return false; // Python uses indentation, not braces
    }
    return /^\s*\}/.test(line);
  }

  private isComplexityIncrement(line: string, language: string): boolean {
    const keywords = this.getComplexityKeywords(language);
    return keywords.some(keyword => new RegExp(`\\b${keyword}\\b`).test(line));
  }

  private extractHalsteadElements(content: string, language: string): { operators: Map<string, number>, operands: Map<string, number> } {
    const operators = new Map<string, number>();
    const operands = new Map<string, number>();
    
    // Language-specific operator patterns
    const operatorPatterns: Record<string, string[]> = {
      javascript: ['+', '-', '*', '/', '%', '=', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '&&', '||', '!', '?', ':', ';', ',', '.', '[', ']', '(', ')', '{', '}'],
      typescript: ['+', '-', '*', '/', '%', '=', '==', '===', '!=', '!==', '<', '>', '<=', '>=', '&&', '||', '!', '?', ':', ';', ',', '.', '[', ']', '(', ')', '{', '}'],
      python: ['+', '-', '*', '/', '//', '%', '**', '=', '==', '!=', '<', '>', '<=', '>=', 'and', 'or', 'not', 'is', 'in', ':', ',', '.', '[', ']', '(', ')'],
      java: ['+', '-', '*', '/', '%', '=', '==', '!=', '<', '>', '<=', '>=', '&&', '||', '!', '?', ':', ';', ',', '.', '[', ']', '(', ')', '{', '}'],
      cpp: ['+', '-', '*', '/', '%', '=', '==', '!=', '<', '>', '<=', '>=', '&&', '||', '!', '?', ':', ';', ',', '.', '[', ']', '(', ')', '{', '}', '->', '::'],
      generic: ['+', '-', '*', '/', '=', '==', '!=', '<', '>', '(', ')', '{', '}']
    };
    
    const langOperators = operatorPatterns[language] || operatorPatterns.generic;
    
    // Count operators
    for (const op of langOperators) {
      const regex = new RegExp(`\\${op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
    const operatorPatterns: Record<string, string[]> = {
      javascript: ['+', '-', '*', '/', '%',')}`, 'g');
      const matches = content.match(regex);
      if (matches) {
        operators.set(op, (operators.get(op) || 0) + matches.length);
      }
    }
    
    // Extract operands (identifiers, literals)
    const operandRegex = /\b[a-zA-Z_$][a-zA-Z0-9_$]*\b|\b\d+(\.\d+)?\b|"[^"]*"|'[^']*'/g;
    let match;
    while ((match = operandRegex.exec(content)) !== null) {
      const operand = match[0];
      operands.set(operand, (operands.get(operand) || 0) + 1);
    }
    
    return { operators, operands };
  }
}

// Export additional interfaces for use in other modules
export type { ComplexityMetrics, GraphNode, ClusterResult, ProjectAnalysis };
