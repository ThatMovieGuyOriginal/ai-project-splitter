// __tests__/advanced-analyzer.test.ts
import { AdvancedCodeAnalyzer } from '../src/core/advanced-analyzer';
import { SecurityScanner } from '../src/security/scanner';
import { Matrix } from 'ml-matrix';
import { mkdtemp, writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('AdvancedCodeAnalyzer', () => {
  let analyzer: AdvancedCodeAnalyzer;
  let testProjectDir: string;

  beforeEach(async () => {
    analyzer = new AdvancedCodeAnalyzer();
    testProjectDir = await mkdtemp(join(tmpdir(), 'test-project-'));
    await setupTestProject(testProjectDir);
  });

  afterEach(async () => {
    if (testProjectDir) {
      await rm(testProjectDir, { recursive: true, force: true });
    }
  });

  describe('Project Analysis', () => {
    test('should analyze a complete project with mathematical rigor', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);

      // Validate structure
      expect(result.nodes).toBeInstanceOf(Map);
      expect(result.adjacencyMatrix).toBeInstanceOf(Matrix);
      expect(result.clusters).toBeInstanceOf(Array);
      expect(result.globalMetrics).toBeDefined();
      expect(result.qualityMetrics).toBeDefined();

      // Validate mathematical properties
      expect(result.globalMetrics.modularityScore).toBeGreaterThanOrEqual(-1);
      expect(result.globalMetrics.modularityScore).toBeLessThanOrEqual(1);
      expect(result.globalMetrics.networkDensity).toBeGreaterThanOrEqual(0);
      expect(result.globalMetrics.networkDensity).toBeLessThanOrEqual(1);
      expect(result.globalMetrics.clusteringCoefficient).toBeGreaterThanOrEqual(0);
      expect(result.globalMetrics.clusteringCoefficient).toBeLessThanOrEqual(1);

      // Validate centrality measures
      for (const [_, node] of result.nodes) {
        if (node.centrality) {
          expect(node.centrality.betweenness).toBeGreaterThanOrEqual(0);
          expect(node.centrality.closeness).toBeGreaterThanOrEqual(0);
          expect(node.centrality.eigenvector).toBeGreaterThanOrEqual(0);
          expect(node.centrality.pagerank).toBeGreaterThanOrEqual(0);
          expect(node.centrality.pagerank).toBeLessThanOrEqual(1);
        }
      }

      // Validate cluster quality metrics
      for (const cluster of result.clusters) {
        expect(cluster.cohesion).toBeGreaterThanOrEqual(0);
        expect(cluster.cohesion).toBeLessThanOrEqual(1);
        expect(cluster.coupling).toBeGreaterThanOrEqual(0);
        expect(cluster.coupling).toBeLessThanOrEqual(1);
        expect(cluster.silhouetteScore).toBeGreaterThanOrEqual(-1);
        expect(cluster.silhouetteScore).toBeLessThanOrEqual(1);
      }
    });

    test('should handle edge cases gracefully', async () => {
      // Test with single file
      const singleFileDir = await mkdtemp(join(tmpdir(), 'single-file-'));
      await writeFile(join(singleFileDir, 'index.js'), 'console.log("hello");');

      const result = await analyzer.analyzeProject(singleFileDir);
      expect(result.nodes.size).toBe(1);
      expect(result.clusters.length).toBeGreaterThanOrEqual(1);

      await rm(singleFileDir, { recursive: true, force: true });
    });

    test('should validate adjacency matrix properties', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      const matrix = result.adjacencyMatrix;

      // Test matrix dimensions
      expect(matrix.rows).toBe(result.nodes.size);
      expect(matrix.columns).toBe(result.nodes.size);

      // Test matrix properties
      for (let i = 0; i < matrix.rows; i++) {
        for (let j = 0; j < matrix.columns; j++) {
          const value = matrix.get(i, j);
          expect(value).toBeGreaterThanOrEqual(0); // Non-negative
          expect(Number.isFinite(value)).toBe(true); // Finite
        }
      }
    });
  });

  describe('Complexity Metrics', () => {
    test('should calculate cyclomatic complexity correctly', async () => {
      const complexFile = `
        function complexFunction(x) {
          if (x > 0) {
            while (x > 10) {
              for (let i = 0; i < x; i++) {
                if (i % 2 === 0) {
                  console.log(i);
                } else {
                  console.log('odd');
                }
              }
              x--;
            }
          } else if (x < 0) {
            return -1;
          } else {
            return 0;
          }
          return x;
        }
      `;

      await writeFile(join(testProjectDir, 'complex.js'), complexFile);
      const result = await analyzer.analyzeProject(testProjectDir);
      
      const complexNode = Array.from(result.nodes.values())
        .find(node => node.path.includes('complex.js'));
      
      expect(complexNode).toBeDefined();
      expect(complexNode!.complexity.cyclomaticComplexity).toBeGreaterThan(5);
    });

    test('should calculate Halstead metrics correctly', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      
      for (const [_, node] of result.nodes) {
        expect(node.complexity.halsteadVolume).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(node.complexity.halsteadVolume)).toBe(true);
      }
    });

    test('should calculate maintainability index in valid range', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      
      for (const [_, node] of result.nodes) {
        expect(node.complexity.maintainabilityIndex).toBeGreaterThanOrEqual(0);
        expect(node.complexity.maintainabilityIndex).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Clustering Algorithms', () => {
    test('should produce valid modularity scores', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      
      // Modularity should be between -1 and 1
      expect(result.globalMetrics.modularityScore).toBeGreaterThanOrEqual(-1);
      expect(result.globalMetrics.modularityScore).toBeLessThanOrEqual(1);
      
      // Each cluster should have valid modularity
      for (const cluster of result.clusters) {
        expect(cluster.modularity).toBeGreaterThanOrEqual(-1);
        expect(cluster.modularity).toBeLessThanOrEqual(1);
      }
    });

    test('should maintain cluster node consistency', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      
      const allClusterNodes = new Set<string>();
      for (const cluster of result.clusters) {
        for (const nodeId of cluster.nodes) {
          expect(allClusterNodes.has(nodeId)).toBe(false); // No node should be in multiple clusters
          allClusterNodes.add(nodeId);
          expect(result.nodes.has(nodeId)).toBe(true); // All cluster nodes should exist in the graph
        }
      }
    });

    test('should calculate silhouette scores correctly', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      
      for (const cluster of result.clusters) {
        expect(cluster.silhouetteScore).toBeGreaterThanOrEqual(-1);
        expect(cluster.silhouetteScore).toBeLessThanOrEqual(1);
        expect(Number.isFinite(cluster.silhouetteScore)).toBe(true);
      }
    });

    test('should validate conductance calculations', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      
      for (const cluster of result.clusters) {
        expect(cluster.conductance).toBeGreaterThanOrEqual(0);
        expect(cluster.conductance).toBeLessThanOrEqual(1);
        expect(Number.isFinite(cluster.conductance)).toBe(true);
      }
    });
  });

  describe('Centrality Measures', () => {
    test('should calculate betweenness centrality correctly', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      
      let totalBetweenness = 0;
      for (const [_, node] of result.nodes) {
        if (node.centrality) {
          expect(node.centrality.betweenness).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(node.centrality.betweenness)).toBe(true);
          totalBetweenness += node.centrality.betweenness;
        }
      }
      
      // Total betweenness should be reasonable for the graph size
      expect(totalBetweenness).toBeGreaterThanOrEqual(0);
    });

    test('should calculate PageRank with proper normalization', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      
      let totalPageRank = 0;
      for (const [_, node] of result.nodes) {
        if (node.centrality) {
          expect(node.centrality.pagerank).toBeGreaterThanOrEqual(0);
          expect(node.centrality.pagerank).toBeLessThanOrEqual(1);
          totalPageRank += node.centrality.pagerank;
        }
      }
      
      // PageRank values should approximately sum to 1
      expect(Math.abs(totalPageRank - 1)).toBeLessThan(0.1);
    });

    test('should calculate eigenvector centrality properly', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      
      for (const [_, node] of result.nodes) {
        if (node.centrality) {
          expect(node.centrality.eigenvector).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(node.centrality.eigenvector)).toBe(true);
        }
      }
    });
  });

  describe('Network Topology Analysis', () => {
    test('should calculate clustering coefficient correctly', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      
      expect(result.globalMetrics.clusteringCoefficient).toBeGreaterThanOrEqual(0);
      expect(result.globalMetrics.clusteringCoefficient).toBeLessThanOrEqual(1);
      expect(Number.isFinite(result.globalMetrics.clusteringCoefficient)).toBe(true);
    });

    test('should calculate average path length correctly', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      
      expect(result.globalMetrics.averagePathLength).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(result.globalMetrics.averagePathLength)).toBe(true);
    });

    test('should identify scale-free properties', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      
      expect(result.globalMetrics.scaleFreeBeta).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(result.globalMetrics.scaleFreeBeta)).toBe(true);
    });

    test('should calculate small-world coefficient', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      
      expect(result.globalMetrics.smallWorldCoefficient).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(result.globalMetrics.smallWorldCoefficient)).toBe(true);
    });
  });

  describe('Quality Assessment', () => {
    test('should assess structural health correctly', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      
      expect(result.qualityMetrics.structuralHealth).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics.structuralHealth).toBeLessThanOrEqual(100);
    });

    test('should calculate maintainability score', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      
      expect(result.qualityMetrics.maintainabilityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics.maintainabilityScore).toBeLessThanOrEqual(100);
    });

    test('should assess evolutionary risk', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      
      expect(result.qualityMetrics.evolutionaryRisk).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics.evolutionaryRisk).toBeLessThanOrEqual(100);
    });

    test('should calculate technical debt', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      
      expect(result.qualityMetrics.technicalDebt).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics.technicalDebt).toBeLessThanOrEqual(100);
    });
  });

  describe('Language-Specific Parsing', () => {
    test('should parse JavaScript correctly', async () => {
      const jsCode = `
        import React from 'react';
        import { Component } from './Component';
        
        export default function App() {
          const [state, setState] = useState(0);
          return <div>{state}</div>;
        }
      `;
      
      await writeFile(join(testProjectDir, 'app.js'), jsCode);
      const result = await analyzer.analyzeProject(testProjectDir);
      
      const jsNode = Array.from(result.nodes.values())
        .find(node => node.path.includes('app.js'));
      
      expect(jsNode).toBeDefined();
      expect(jsNode!.dependencies.size).toBeGreaterThan(0);
    });

    test('should parse TypeScript correctly', async () => {
      const tsCode = `
        interface User {
          id: number;
          name: string;
        }
        
        class UserService {
          private users: User[] = [];
          
          addUser(user: User): void {
            this.users.push(user);
          }
        }
      `;
      
      await writeFile(join(testProjectDir, 'user.ts'), tsCode);
      const result = await analyzer.analyzeProject(testProjectDir);
      
      const tsNode = Array.from(result.nodes.values())
        .find(node => node.path.includes('user.ts'));
      
      expect(tsNode).toBeDefined();
      expect(tsNode!.complexity.cyclomaticComplexity).toBeGreaterThan(1);
    });

    test('should parse Python correctly', async () => {
      const pyCode = `
        import os
        from typing import List, Dict
        
        class DataProcessor:
            def __init__(self, data: List[Dict]):
                self.data = data
            
            def process(self):
                for item in self.data:
                    if item.get('valid'):
                        yield self._transform(item)
            
            def _transform(self, item: Dict) -> Dict:
                return {'processed': True, **item}
      `;
      
      await writeFile(join(testProjectDir, 'processor.py'), pyCode);
      const result = await analyzer.analyzeProject(testProjectDir);
      
      const pyNode = Array.from(result.nodes.values())
        .find(node => node.path.includes('processor.py'));
      
      expect(pyNode).toBeDefined();
      expect(pyNode!.dependencies.size).toBeGreaterThan(0);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large projects efficiently', async () => {
      // Create a larger test project
      const largeProjectDir = await mkdtemp(join(tmpdir(), 'large-project-'));
      
      // Generate 50 interconnected files
      for (let i = 0; i < 50; i++) {
        const dependencies = Array.from({ length: Math.floor(Math.random() * 5) }, (_, j) => 
          `./file${(i + j + 1) % 50}.js`
        );
        
        const code = `
          ${dependencies.map(dep => `import { func${Math.floor(Math.random() * 10)} } from '${dep}';`).join('\n')}
          
          export function func${i}() {
            ${Array.from({ length: Math.floor(Math.random() * 10) + 5 }, (_, j) => 
              `if (Math.random() > 0.5) { console.log(${j}); }`
            ).join('\n')}
          }
        `;
        
        await writeFile(join(largeProjectDir, `file${i}.js`), code);
      }
      
      const startTime = Date.now();
      const result = await analyzer.analyzeProject(largeProjectDir);
      const endTime = Date.now();
      
      expect(result.nodes.size).toBe(50);
      expect(endTime - startTime).toBeLessThan(30000); // Should complete in under 30 seconds
      
      await rm(largeProjectDir, { recursive: true, force: true });
    });

    test('should maintain mathematical consistency at scale', async () => {
      const result = await analyzer.analyzeProject(testProjectDir);
      
      // Verify that all mathematical invariants hold
      const nodeCount = result.nodes.size;
      const edgeCount = result.adjacencyMatrix.sum();
      
      // Network density should match calculated values
      const expectedDensity = edgeCount / (nodeCount * (nodeCount - 1));
      expect(Math.abs(result.globalMetrics.networkDensity - expectedDensity)).toBeLessThan(0.01);
      
      // Clustering coefficient should be mathematically consistent
      expect(result.globalMetrics.clusteringCoefficient).toBeGreaterThanOrEqual(0);
      expect(result.globalMetrics.clusteringCoefficient).toBeLessThanOrEqual(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty projects gracefully', async () => {
      const emptyDir = await mkdtemp(join(tmpdir(), 'empty-project-'));
      
      await expect(analyzer.analyzeProject(emptyDir)).rejects.toThrow();
      
      await rm(emptyDir, { recursive: true, force: true });
    });

    test('should handle corrupted files gracefully', async () => {
      const corruptedCode = 'this is not valid { JavaScript code [[[';
      await writeFile(join(testProjectDir, 'corrupted.js'), corruptedCode);
      
      const result = await analyzer.analyzeProject(testProjectDir);
      
      // Should still complete analysis despite corrupted file
      expect(result.nodes.size).toBeGreaterThan(0);
    });

    test('should handle circular dependencies', async () => {
      await writeFile(join(testProjectDir, 'a.js'), "import './b.js';");
      await writeFile(join(testProjectDir, 'b.js'), "import './a.js';");
      
      const result = await analyzer.analyzeProject(testProjectDir);
      
      // Should detect and handle circular dependencies
      expect(result.nodes.size).toBeGreaterThanOrEqual(2);
      expect(result.globalMetrics.averagePathLength).toBeFinite();
    });
  });
});

describe('SecurityScanner', () => {
  let scanner: SecurityScanner;
  let testDir: string;

  beforeEach(async () => {
    scanner = new SecurityScanner();
    testDir = await mkdtemp(join(tmpdir(), 'security-test-'));
  });

  afterEach(async () => {
    if (testDir) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  test('should detect dangerous patterns', async () => {
    const dangerousCode = `
      eval(userInput);
      exec('rm -rf /');
      document.innerHTML = userInput;
    `;
    
    await writeFile(join(testDir, 'dangerous.js'), dangerousCode);
    
    await expect(scanner.scanDirectory(testDir)).rejects.toThrow();
  });

  test('should allow safe code', async () => {
    const safeCode = `
      function add(a, b) {
        return a + b;
      }
      console.log('Hello, world!');
    `;
    
    await writeFile(join(testDir, 'safe.js'), safeCode);
    
    const result = await scanner.scanDirectory(testDir);
    expect(result).toBeDefined();
  });

  test('should block dangerous file types', async () => {
    await writeFile(join(testDir, 'malware.exe'), 'fake executable content');
    
    await expect(scanner.scanDirectory(testDir)).rejects.toThrow();
  });
});

// Test utility functions
async function setupTestProject(projectDir: string): Promise<void> {
  // Create a realistic test project structure
  const files = [
    {
      path: 'index.js',
      content: `
        import { App } from './app.js';
        import { utils } from './utils/index.js';
        
        const app = new App();
        app.start();
      `
    },
    {
      path: 'app.js',
      content: `
        import { Router } from './router.js';
        import { Database } from './database.js';
        
        export class App {
          constructor() {
            this.router = new Router();
            this.db = new Database();
          }
          
          start() {
            this.router.init();
            this.db.connect();
            console.log('App started');
          }
        }
      `
    },
    {
      path: 'router.js',
      content: `
        export class Router {
          constructor() {
            this.routes = new Map();
          }
          
          init() {
            this.setupRoutes();
          }
          
          setupRoutes() {
            this.routes.set('/', () => 'Home');
            this.routes.set('/about', () => 'About');
          }
          
          route(path) {
            return this.routes.get(path) || (() => 'Not Found');
          }
        }
      `
    },
    {
      path: 'database.js',
      content: `
        export class Database {
          constructor() {
            this.connected = false;
          }
          
          connect() {
            if (!this.connected) {
              this.connected = true;
              console.log('Database connected');
            }
          }
          
          disconnect() {
            if (this.connected) {
              this.connected = false;
              console.log('Database disconnected');
            }
          }
        }
      `
    },
    {
      path: 'utils/index.js',
      content: `
        export const utils = {
          formatDate: (date) => date.toISOString(),
          generateId: () => Math.random().toString(36),
          validate: (data) => {
            if (!data) return false;
            if (typeof data !== 'object') return false;
            return true;
          }
        };
      `
    }
  ];

  for (const file of files) {
    const filePath = join(projectDir, file.path);
    await mkdir(join(filePath, '..'), { recursive: true });
    await writeFile(filePath, file.content);
  }
}

// Additional mathematical validation tests
describe('Mathematical Validation', () => {
  test('should validate matrix operations', () => {
    const matrix = Matrix.zeros(3, 3);
    matrix.set(0, 1, 1);
    matrix.set(1, 2, 1);
    matrix.set(2, 0, 1);
    
    expect(matrix.sum()).toBe(3);
    expect(matrix.get(0, 0)).toBe(0);
    expect(matrix.get(0, 1)).toBe(1);
  });

  test('should validate clustering quality metrics', () => {
    // Test silhouette score calculation
    const testSilhouette = (a: number, b: number) => {
      if (a === 0 && b === 0) return 0;
      return (b - a) / Math.max(a, b);
    };
    
    expect(testSilhouette(0.2, 0.8)).toBeCloseTo(0.75, 2);
    expect(testSilhouette(0.8, 0.2)).toBeCloseTo(-0.75, 2);
    expect(testSilhouette(0.5, 0.5)).toBe(0);
  });

  test('should validate modularity calculations', () => {
    // Test basic modularity formula components
    const calculateModularityContribution = (
      actualEdges: number,
      expectedEdges: number,
      totalEdges: number
    ) => {
      return (actualEdges - expectedEdges) / totalEdges;
    };
    
    const contribution = calculateModularityContribution(5, 2, 10);
    expect(contribution).toBe(0.3);
  });
});
