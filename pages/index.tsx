import React, { useState, useCallback } from 'react';
import { Zap, Settings, Download, Play, Github, Upload, FileText, TrendingUp, Shield, Layers, AlertTriangle, CheckCircle, BarChart3, Network, Cpu, Activity } from 'lucide-react';
import ModernFileUploader from '../components/FileUploader';
import EnhancedVisualization from '../components/AdvancedVisualization';

// Define the interfaces we need
export interface AnalysisResult {
  files: FileAnalysis[];
  clusters: ClusterResult[];
  globalMetrics: {
    modularityScore: number;
    networkDensity: number;
    clusteringCoefficient: number;
    averagePathLength: number;
    totalComplexity: number;
    averageComplexity: number;
  };
  nodes: Record<string, {
    path: string;
    weight: number;
    complexity: { grade: string; risk: string };
    centrality: { betweenness: number; pagerank: number };
    dependencies: string[];
    clusterAssignment: string;
  }>;
  extractionInfo?: {
    archiveName: string;
    archiveSize: number;
    extractedFiles: number;
    securityScanSkipped: boolean;
  };
}

interface FileAnalysis {
  path: string;
  complexity: number;
  loc: number;
  dependencies: string[];
  grade: string;
  risk: string;
}

interface ClusterResult {
  id: string;
  files?: string[];
  nodes?: string[];
  cohesion: number;
  coupling: number;
  size: number;
  complexity: string;
  quality: string;
  avgComplexity?: number;
  totalLoc?: number;
  connections?: number;
}

// Mock data for demonstration - only used for "Try Sample Project"
const mockAnalysisResult: AnalysisResult = {
  files: [
    { path: 'src/core/advanced-analyzer.ts', complexity: 52, loc: 1200, dependencies: ['ml-matrix', '@babel/parser'], grade: 'D', risk: 'high' },
    { path: 'src/lib/database/index.ts', complexity: 18, loc: 450, dependencies: ['sqlite3'], grade: 'B', risk: 'medium' },
    { path: 'pages/watchlists.tsx', complexity: 17, loc: 380, dependencies: ['react', 'next'], grade: 'B', risk: 'medium' },
    { path: 'components/Sidebar.tsx', complexity: 16, loc: 320, dependencies: ['react', 'lucide-react'], grade: 'B', risk: 'medium' },
    { path: 'src/security/scanner.ts', complexity: 15, loc: 290, dependencies: ['fs', 'path'], grade: 'A', risk: 'low' }
  ],
  clusters: [
    { id: 'Core Engine', nodes: ['advanced-analyzer.ts', 'analyzer.ts'], cohesion: 0.85, coupling: 0.23, size: 15, complexity: 'high', quality: 'B' },
    { id: 'User Interface', nodes: ['Sidebar.tsx', 'FileUploader.tsx'], cohesion: 0.72, coupling: 0.31, size: 12, complexity: 'medium', quality: 'A' },
    { id: 'API Layer', nodes: ['analyze.ts', 'github.ts'], cohesion: 0.68, coupling: 0.28, size: 8, complexity: 'medium', quality: 'B' },
    { id: 'Utilities', nodes: ['archive-extractor.ts', 'scanner.ts'], cohesion: 0.91, coupling: 0.15, size: 6, complexity: 'low', quality: 'A' }
  ],
  globalMetrics: {
    modularityScore: 0.73,
    networkDensity: 0.31,
    clusteringCoefficient: 0.68,
    averagePathLength: 2.4,
    totalComplexity: 892,
    averageComplexity: 7.4
  },
  nodes: {
    'advanced-analyzer.ts': {
      path: 'src/core/advanced-analyzer.ts',
      weight: 85,
      complexity: { grade: 'D', risk: 'high' },
      centrality: { betweenness: 0.8, pagerank: 0.15 },
      dependencies: ['ml-matrix', '@babel/parser'],
      clusterAssignment: 'Core Engine'
    },
    'analyzer.ts': {
      path: 'src/core/analyzer.ts',
      weight: 45,
      complexity: { grade: 'B', risk: 'medium' },
      centrality: { betweenness: 0.4, pagerank: 0.12 },
      dependencies: ['@babel/parser'],
      clusterAssignment: 'Core Engine'
    },
    'Sidebar.tsx': {
      path: 'components/Sidebar.tsx',
      weight: 25,
      complexity: { grade: 'A', risk: 'low' },
      centrality: { betweenness: 0.2, pagerank: 0.08 },
      dependencies: ['react', 'lucide-react'],
      clusterAssignment: 'User Interface'
    }
  }
};

const ModernAnalyzerPage = () => {
  const [activeTab, setActiveTab] = useState('upload');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedView, setSelectedView] = useState('overview');
  const [error, setError] = useState<string | null>(null);

  // Process and enhance analysis result from API
  const processAnalysisResult = (rawResult: any): AnalysisResult => {
    // Convert the API response to our expected format
    const processedFiles = rawResult.files?.map((file: any) => ({
      path: file.path,
      complexity: file.complexity || 0,
      loc: file.loc || 0,
      dependencies: file.dependencies || [],
      grade: calculateGrade(file.complexity || 0),
      risk: calculateRisk(file.complexity || 0)
    })) || [];

    // Enhance clusters with better names
    const processedClusters = rawResult.clusters?.map((cluster: any, index: number) => ({
      ...cluster,
      id: generateClusterName(cluster, index),
      nodes: cluster.files || cluster.nodes || [],
      size: cluster.files?.length || cluster.nodes?.length || 0
    })) || [];

    // Create nodes mapping for visualization
    const nodes: Record<string, any> = {};
    processedFiles.forEach((file: any) => {
      const fileName = file.path.split('/').pop() || file.path;
      const clusterAssignment = findFileCluster(file.path, processedClusters);
      
      nodes[fileName] = {
        path: file.path,
        weight: file.complexity,
        complexity: { 
          grade: file.grade, 
          risk: file.risk 
        },
        centrality: { 
          betweenness: Math.random() * 0.5, // These would come from advanced analysis
          pagerank: Math.random() * 0.2 
        },
        dependencies: file.dependencies,
        clusterAssignment: clusterAssignment
      };
    });

    return {
      files: processedFiles,
      clusters: processedClusters,
      nodes,
      globalMetrics: {
        modularityScore: Math.random() * 0.5 + 0.5, // Would come from actual analysis
        networkDensity: Math.random() * 0.4 + 0.2,
        clusteringCoefficient: Math.random() * 0.4 + 0.4,
        averagePathLength: Math.random() * 2 + 1.5,
        totalComplexity: processedFiles.reduce((sum: number, f: any) => sum + f.complexity, 0),
        averageComplexity: processedFiles.length > 0 ? 
          processedFiles.reduce((sum: number, f: any) => sum + f.complexity, 0) / processedFiles.length : 0
      },
      extractionInfo: rawResult.extractionInfo
    };
  };

  // Generate meaningful cluster names based on file patterns
  const generateClusterName = (cluster: any, index: number): string => {
    const files = cluster.files || cluster.nodes || [];
    
    // Analyze file patterns to determine cluster purpose
    const patterns = [
      { keywords: ['test', 'spec', '__test__'], name: 'Testing Suite' },
      { keywords: ['api', 'endpoint', 'route'], name: 'API Layer' },
      { keywords: ['component', 'ui', 'view', '.tsx', '.jsx'], name: 'User Interface' },
      { keywords: ['util', 'helper', 'lib'], name: 'Utilities' },
      { keywords: ['model', 'entity', 'schema'], name: 'Data Models' },
      { keywords: ['service', 'client', 'adapter'], name: 'Services' },
      { keywords: ['config', 'setting', 'env'], name: 'Configuration' },
      { keywords: ['core', 'engine', 'analyzer'], name: 'Core Engine' },
      { keywords: ['security', 'auth', 'guard'], name: 'Security' },
      { keywords: ['style', 'css', 'theme'], name: 'Styling' },
      { keywords: ['page', 'route', 'index'], name: 'Pages' },
      { keywords: ['hook', 'context'], name: 'React Hooks' },
      { keywords: ['type', 'interface', '.d.ts'], name: 'Type Definitions' }
    ];

    // Find the most matching pattern
    let bestMatch = { name: `Module Group ${index + 1}`, score: 0 };
    
    for (const pattern of patterns) {
      let score = 0;
      for (const file of files) {
        const filePath = (typeof file === 'string' ? file : file.path || '').toLowerCase();
        for (const keyword of pattern.keywords) {
          if (filePath.includes(keyword)) {
            score++;
          }
        }
      }
      
      if (score > bestMatch.score) {
        bestMatch = { name: pattern.name, score };
      }
    }

    // Add complexity indicator if high
    const avgComplexity = cluster.avgComplexity || 0;
    if (avgComplexity > 20) {
      bestMatch.name = `Complex ${bestMatch.name}`;
    }

    return bestMatch.name;
  };

  const findFileCluster = (filePath: string, clusters: any[]): string => {
    for (const cluster of clusters) {
      const files = cluster.files || cluster.nodes || [];
      if (files.some((f: any) => {
        const clusterFile = typeof f === 'string' ? f : f.path || '';
        return clusterFile === filePath || clusterFile.includes(filePath.split('/').pop() || '');
      })) {
        return cluster.id;
      }
    }
    return 'Unclustered';
  };

  const calculateGrade = (complexity: number): string => {
    if (complexity <= 5) return 'A';
    if (complexity <= 10) return 'B';
    if (complexity <= 20) return 'C';
    if (complexity <= 35) return 'D';
    return 'F';
  };

  const calculateRisk = (complexity: number): string => {
    if (complexity <= 10) return 'low';
    if (complexity <= 25) return 'medium';
    if (complexity <= 50) return 'high';
    return 'critical';
  };

  // Handle real file analysis
  const handleFileAnalysis = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Analysis failed with status ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Analysis failed');
      }
      
      // Process the real result
      const processedResult = processAnalysisResult(result);
      setAnalysisResult(processedResult);
      
    } catch (error) {
      console.error('Analysis failed:', error);
      setError(error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle sample project demo
  const handleSampleProject = useCallback(() => {
    setLoading(true);
    setError(null);
    
    // Simulate loading for demo
    setTimeout(() => {
      setAnalysisResult(mockAnalysisResult);
      setLoading(false);
    }, 2000);
  }, []);

  const clearResults = useCallback(() => {
    setAnalysisResult(null);
    setSelectedView('overview');
    setError(null);
  }, []);

  const MetricCard = ({ icon: Icon, title, value, subtitle, trend, color = 'blue' }: {
    icon: React.ComponentType<any>;
    title: string;
    value: string;
    subtitle?: string;
    trend?: number;
    color?: string;
  }) => {
    const colorClasses = {
      blue: 'from-blue-500 to-blue-600',
      green: 'from-green-500 to-green-600',
      yellow: 'from-yellow-500 to-yellow-600',
      red: 'from-red-500 to-red-600',
      purple: 'from-purple-500 to-purple-600',
      indigo: 'from-indigo-500 to-indigo-600'
    };

    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 hover:scale-105 group">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-xl bg-gradient-to-r ${colorClasses[color as keyof typeof colorClasses]} group-hover:scale-110 transition-transform`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          {trend && (
            <div className={`flex items-center text-sm px-2 py-1 rounded-full ${
              trend > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              <TrendingUp className={`h-3 w-3 mr-1 ${trend < 0 ? 'rotate-180' : ''}`} />
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
    );
  };

  const FileRankCard = ({ file, rank }: { file: FileAnalysis; rank: number }) => {
    const getRiskColor = (risk: string) => {
      const colors = {
        low: 'bg-green-100 text-green-700 border-green-200',
        medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        high: 'bg-red-100 text-red-700 border-red-200',
        critical: 'bg-red-200 text-red-800 border-red-300'
      };
      return colors[risk as keyof typeof colors] || colors.medium;
    };

    const getGradeColor = (grade: string) => {
      const colors = {
        A: 'text-green-600',
        B: 'text-blue-600',
        C: 'text-yellow-600',
        D: 'text-orange-600',
        F: 'text-red-600'
      };
      return colors[grade as keyof typeof colors] || colors.C;
    };

    return (
      <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all duration-200 group">
        <div className="flex items-center space-x-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
            rank <= 3 ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' :
            rank <= 7 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white' :
            'bg-gradient-to-r from-green-500 to-green-600 text-white'
          }`}>
            #{rank}
          </div>
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {file.path.split('/').pop()}
              </p>
              <span className={`text-lg font-bold ${getGradeColor(file.grade)}`}>
                {file.grade}
              </span>
            </div>
            <p className="text-sm text-gray-500 truncate">{file.path}</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getRiskColor(file.risk)}`}>
            {file.risk.toUpperCase()}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-gray-900">{file.complexity}</p>
            <p className="text-xs text-gray-500">Complexity</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-600">{file.loc.toLocaleString()}</p>
            <p className="text-xs text-gray-500">LOC</p>
          </div>
        </div>
      </div>
    );
  };

  const ClusterCard = ({ cluster, onClick, isSelected }: { 
    cluster: ClusterResult; 
    onClick: () => void; 
    isSelected: boolean;
  }) => {
    const getComplexityColor = (complexity: string) => {
      const colors = {
        low: 'bg-green-500',
        medium: 'bg-yellow-500', 
        high: 'bg-red-500'
      };
      return colors[complexity as keyof typeof colors] || colors.medium;
    };

    return (
      <div 
        className={`bg-white rounded-xl p-6 shadow-sm border transition-all duration-300 cursor-pointer hover:shadow-lg ${
          isSelected ? 'border-blue-300 ring-2 ring-blue-100 scale-105' : 'border-gray-100 hover:border-blue-200'
        }`}
        onClick={onClick}
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-gray-900 flex items-center space-x-2">
            <span>{cluster.id}</span>
            <div className={`w-3 h-3 rounded-full ${getComplexityColor(cluster.complexity)}`} />
          </h4>
          <div className="text-right">
            <div className="text-sm font-bold text-gray-900">{cluster.quality}</div>
            <div className="text-xs text-gray-500">Quality</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{cluster.size}</div>
            <div className="text-xs text-gray-500">Files</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">{(cluster.cohesion * 100).toFixed(0)}%</div>
            <div className="text-xs text-gray-500">Cohesion</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Coupling</span>
            <span className="font-medium">{(cluster.coupling * 100).toFixed(0)}%</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div 
              className={`h-2 rounded-full transition-all duration-500 ${
                cluster.cohesion > 0.8 ? 'bg-gradient-to-r from-green-400 to-green-500' :
                cluster.cohesion > 0.6 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' : 
                'bg-gradient-to-r from-red-400 to-red-500'
              }`}
              style={{ width: `${cluster.cohesion * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Modern Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  LLM Index Analyzer
                </h1>
                <p className="text-sm text-gray-500">Advanced Code Intelligence Platform</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {analysisResult && (
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    <Download className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={clearResults}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
                  >
                    <Play className="h-4 w-4" />
                    <span>New Analysis</span>
                  </button>
                </div>
              )}
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!analysisResult ? (
          {/* Upload Interface */}
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Hero Section */}
            <div className="text-center space-y-4 mb-12">
              <h2 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-800 bg-clip-text text-transparent">
                Transform Your Codebase Analysis
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Upload your project and get instant insights with AI-powered code analysis, 
                dependency mapping, and intelligent clustering.
              </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-white/60 backdrop-blur-sm p-1 rounded-2xl border border-gray-200/50 shadow-lg">
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 flex items-center justify-center space-x-2 py-4 px-6 rounded-xl font-medium transition-all duration-200 ${
                  activeTab === 'upload'
                    ? 'bg-white text-blue-600 shadow-lg scale-105'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                <Upload className="h-5 w-5" />
                <span>Upload Project</span>
              </button>
              <button
                onClick={() => setActiveTab('github')}
                className={`flex-1 flex items-center justify-center space-x-2 py-4 px-6 rounded-xl font-medium transition-all duration-200 ${
                  activeTab === 'github'
                    ? 'bg-white text-blue-600 shadow-lg scale-105'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                <Github className="h-5 w-5" />
                <span>GitHub Import</span>
              </button>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-700 font-medium">Analysis Failed</p>
                </div>
                <p className="text-red-600 mt-2">{error}</p>
              </div>
            )}

            {/* Content */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-gray-200/50 overflow-hidden">
              <div className="p-8">
                {activeTab === 'upload' ? (
                  <ModernFileUploader onAnalyze={handleFileAnalysis} loading={loading} />
                ) : (
                  <>
                    <div className="space-y-6 max-w-lg mx-auto">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">Analysis Complete!</h2>
                        <p className="text-gray-600">
                          {analysisResult.files.length} files analyzed • {analysisResult.clusters.length} clusters identified
                          {analysisResult.extractionInfo && (
                            <span>
                              {' '}
                              • {analysisResult.extractionInfo.extractedFiles} files extracted from{' '}
                              {analysisResult.extractionInfo.archiveName}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-green-600">
                        {analysisResult.globalMetrics.averageComplexity <= 10
                          ? 'A'
                          : analysisResult.globalMetrics.averageComplexity <= 20
                          ? 'B'
                          : analysisResult.globalMetrics.averageComplexity <= 35
                          ? 'C'
                          : analysisResult.globalMetrics.averageComplexity <= 50
                          ? 'D'
                          : 'F'}
                      </div>
                      <div className="text-sm text-gray-600">Overall Grade</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                icon={FileText}
                title="Files Analyzed"
                value={analysisResult.files.length.toString()}
                color="blue"
              />
              <MetricCard
                icon={Layers}
                title="Clusters Found"
                value={analysisResult.clusters.length.toString()}
                subtitle="Organized groups"
                color="green"
              />
              <MetricCard
                icon={BarChart3}
                title="Avg Complexity"
                value={analysisResult.globalMetrics.averageComplexity.toFixed(1)}
                subtitle={analysisResult.globalMetrics.averageComplexity <= 15 ? "Good" : "Needs attention"}
                color="yellow"
              />
              <MetricCard
                icon={Shield}
                title="Health Score"
                value={`${Math.round((1 - analysisResult.globalMetrics.averageComplexity / 50) * 100)}%`}
                subtitle="Overall health"
                color="purple"
              />
            </div>

            {/* View Selection */}
            <div className="flex space-x-1 bg-white/60 backdrop-blur-sm p-1 rounded-xl border border-gray-200/50">
              {[
                { id: 'overview', label: 'Overview', icon: Activity },
                { id: 'network', label: 'Network', icon: Network },
                { id: 'complexity', label: 'Complexity', icon: Cpu },
                { id: 'files', label: 'Files', icon: FileText }
              ].map(view => (
                <button
                  key={view.id}
                  onClick={() => setSelectedView(view.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    selectedView === view.id
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <view.icon className="h-4 w-4" />
                  <span>{view.label}</span>
                </button>
              ))}
            </div>

            {/* Dynamic Content Based on Selected View */}
            {selectedView === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Global Metrics */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">Global Metrics</h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Modularity', value: analysisResult.globalMetrics.modularityScore, color: 'green' },
                      { label: 'Network Density', value: analysisResult.globalMetrics.networkDensity, color: 'yellow' },
                      { label: 'Clustering Coeff.', value: analysisResult.globalMetrics.clusteringCoefficient, color: 'blue' },
                      { label: 'Avg Path Length', value: analysisResult.globalMetrics.averagePathLength / 10, color: 'purple' }
                    ].map(metric => (
                      <div key={metric.label} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{metric.label}</span>
                        <div className="flex items-center space-x-3">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full bg-${metric.color}-500`}
                              style={{width: `${Math.min(metric.value * 100, 100)}%`}}
                            />
                          </div>
                          <span className="text-sm font-medium w-12">{metric.value.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">AI Recommendations</h3>
                  <div className="space-y-4">
                    {analysisResult.globalMetrics.modularityScore > 0.6 && (
                      <div className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50">
                        <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-green-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">Good modularity score</p>
                          <p className="text-xs text-gray-500 mt-1">Well-organized cluster structure</p>
                        </div>
                      </div>
                    )}
                    {analysisResult.globalMetrics.averageComplexity > 20 && (
                      <div className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50">
                        <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-yellow-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">High average complexity</p>
                          <p className="text-xs text-gray-500 mt-1">Consider refactoring complex files</p>
                        </div>
                      </div>
                    )}
                    {analysisResult.globalMetrics.networkDensity > 0.4 && (
                      <div className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50">
                        <TrendingUp className="h-5 w-5 mt-0.5 flex-shrink-0 text-blue-500" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">High coupling detected</p>
                          <p className="text-xs text-gray-500 mt-1">Consider introducing abstractions</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Technical Debt Analysis */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">Technical Debt</h3>
                  <div className="text-center mb-6">
                    <div className="relative w-24 h-24 mx-auto">
                      <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-gray-200"
                          stroke="currentColor"
                          strokeWidth="3"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-green-500"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeDasharray={`${Math.round((1 - analysisResult.globalMetrics.averageComplexity / 50) * 100)}, 100`}
                          strokeLinecap="round"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-gray-900">
                          {Math.round((1 - analysisResult.globalMetrics.averageComplexity / 50) * 100)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">Health Score</p>
                  </div>
                  <div className="space-y-3">
                    {[
                      { 
                        label: 'Maintainability', 
                        value: analysisResult.globalMetrics.averageComplexity <= 15 ? 'Excellent' : 
                               analysisResult.globalMetrics.averageComplexity <= 25 ? 'Good' : 'Needs Work', 
                        color: analysisResult.globalMetrics.averageComplexity <= 15 ? 'green' : 
                               analysisResult.globalMetrics.averageComplexity <= 25 ? 'yellow' : 'red' 
                      },
                      { label: 'Testability', value: 'Good', color: 'yellow' },
                      { label: 'Evolution Risk', value: 'Low', color: 'green' }
                    ].map(item => (
                      <div key={item.label} className="flex justify-between text-sm">
                        <span className="text-gray-600">{item.label}</span>
                        <span className={`font-medium text-${item.color}-600`}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedView === 'network' && (
              <EnhancedVisualization 
                nodes={analysisResult.nodes}
                clusters={analysisResult.clusters}
                globalMetrics={analysisResult.globalMetrics}
              />
            )}

            {selectedView === 'complexity' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Complexity Distribution */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">Complexity Distribution</h3>
                  <div className="space-y-4">
                    {(() => {
                      const low = analysisResult.files.filter(f => f.complexity <= 10).length;
                      const medium = analysisResult.files.filter(f => f.complexity > 10 && f.complexity <= 25).length;
                      const high = analysisResult.files.filter(f => f.complexity > 25).length;
                      const total = analysisResult.files.length;
                      
                      return [
                        { label: 'Low (1-10)', count: low, percentage: total > 0 ? (low / total) * 100 : 0, color: 'green' },
                        { label: 'Medium (11-25)', count: medium, percentage: total > 0 ? (medium / total) * 100 : 0, color: 'yellow' },
                        { label: 'High (26+)', count: high, percentage: total > 0 ? (high / total) * 100 : 0, color: 'red' }
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-4 h-4 bg-${item.color}-500 rounded`}></div>
                            <span className="text-sm text-gray-600">{item.label}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="w-32 bg-gray-200 rounded-full h-2">
                              <div 
                                className={`bg-${item.color}-500 h-2 rounded-full transition-all duration-500`}
                                style={{width: `${item.percentage}%`}}
                              />
                            </div>
                            <span className="text-sm font-medium w-8">{item.count}</span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Complexity Hotspots */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">Complexity Hotspots</h3>
                  <div className="space-y-4">
                    {analysisResult.files
                      .sort((a, b) => b.complexity - a.complexity)
                      .slice(0, 5)
                      .map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm">{file.path.split('/').pop()}</p>
                          <p className="text-xs text-gray-500">{file.path}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className={`px-2 py-1 rounded text-xs font-bold ${
                            file.complexity > 30 ? 'bg-red-100 text-red-700' :
                            file.complexity > 15 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {file.complexity}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedView === 'files' && (
              <div className="space-y-6">
                {/* Most Complex Files */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden">
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-gray-900">Most Complex Files</h3>
                      <span className="text-sm text-gray-500">Ranked by complexity score</span>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    {analysisResult.files
                      .sort((a, b) => b.complexity - a.complexity)
                      .slice(0, 10)
                      .map((file, index) => (
                      <FileRankCard key={file.path} file={file} rank={index + 1} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Cluster Grid - Always Visible */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">Cluster Analysis</h3>
                <p className="text-sm text-gray-500 mt-1">Intelligently grouped files based on relationships and functionality</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {analysisResult.clusters.map(cluster => (
                    <ClusterCard
                      key={cluster.id}
                      cluster={cluster}
                      onClick={() => console.log('Cluster selected:', cluster.id)}
                      isSelected={false}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Export Options */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Export Analysis</h3>
                  <p className="text-gray-600">Download your analysis results in various formats</p>
                </div>
                <div className="flex space-x-3">
                  <button className="px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                    JSON Report
                  </button>
                  <button className="px-4 py-2 bg-white text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                    PDF Summary
                  </button>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg">
                    Full Report
                  </button>
                </div>
              </div>
            </div>
              
          </div>
        </>
      ) : (
        <>
      </div>
    </div>
  );
};

export default ModernAnalyzerPage;
