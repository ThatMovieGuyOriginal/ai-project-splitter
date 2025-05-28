import React, { useState, useCallback } from 'react';
import { Zap, Settings, Eye, Download, Play, Github, Upload, FileText, TrendingUp, Shield, Layers, AlertTriangle, CheckCircle, BarChart3, Network, Cpu, Activity } from 'lucide-react';
import ModernFileUploader from './ModernFileUploader';
import EnhancedVisualization from './EnhancedVisualization';

// Mock data for demonstration
const mockAnalysisResult = {
  files: [
    { path: 'src/core/advanced-analyzer.ts', complexity: 52, loc: 1200, dependencies: ['ml-matrix', '@babel/parser'], grade: 'D', risk: 'high' },
    { path: 'src/lib/database/index.ts', complexity: 18, loc: 450, dependencies: ['sqlite3'], grade: 'B', risk: 'medium' },
    { path: 'pages/watchlists.tsx', complexity: 17, loc: 380, dependencies: ['react', 'next'], grade: 'B', risk: 'medium' },
    { path: 'components/Sidebar.tsx', complexity: 16, loc: 320, dependencies: ['react', 'lucide-react'], grade: 'B', risk: 'medium' },
    { path: 'src/security/scanner.ts', complexity: 15, loc: 290, dependencies: ['fs', 'path'], grade: 'A', risk: 'low' }
  ],
  clusters: [
    { id: 'core', nodes: ['advanced-analyzer.ts', 'analyzer.ts'], cohesion: 0.85, coupling: 0.23, size: 15, complexity: 'high', quality: 'B' },
    { id: 'ui', nodes: ['Sidebar.tsx', 'FileUploader.tsx'], cohesion: 0.72, coupling: 0.31, size: 12, complexity: 'medium', quality: 'A' },
    { id: 'api', nodes: ['analyze.ts', 'github.ts'], cohesion: 0.68, coupling: 0.28, size: 8, complexity: 'medium', quality: 'B' },
    { id: 'utils', nodes: ['archive-extractor.ts', 'scanner.ts'], cohesion: 0.91, coupling: 0.15, size: 6, complexity: 'low', quality: 'A' }
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
      clusterAssignment: 'core'
    },
    'analyzer.ts': {
      path: 'src/core/analyzer.ts',
      weight: 45,
      complexity: { grade: 'B', risk: 'medium' },
      centrality: { betweenness: 0.4, pagerank: 0.12 },
      dependencies: ['@babel/parser'],
      clusterAssignment: 'core'
    },
    'Sidebar.tsx': {
      path: 'components/Sidebar.tsx',
      weight: 25,
      complexity: { grade: 'A', risk: 'low' },
      centrality: { betweenness: 0.2, pagerank: 0.08 },
      dependencies: ['react', 'lucide-react'],
      clusterAssignment: 'ui'
    }
  }
};

const ModernAnalyzerPage = () => {
  const [activeTab, setActiveTab] = useState('upload');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedView, setSelectedView] = useState('overview');

  // Simulate file analysis
  const handleFileAnalysis = useCallback(async (file) => {
    setLoading(true);
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    setAnalysisResult(mockAnalysisResult);
    setLoading(false);
  }, []);

  const clearResults = useCallback(() => {
    setAnalysisResult(null);
    setSelectedView('overview');
  }, []);

  const MetricCard = ({ icon: Icon, title, value, subtitle, trend, color = 'blue' }) => {
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
          <div className={`p-3 rounded-xl bg-gradient-to-r ${colorClasses[color]} group-hover:scale-110 transition-transform`}>
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

  const FileRankCard = ({ file, rank }) => {
    const getRiskColor = (risk) => {
      const colors = {
        low: 'bg-green-100 text-green-700 border-green-200',
        medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        high: 'bg-red-100 text-red-700 border-red-200',
        critical: 'bg-red-200 text-red-800 border-red-300'
      };
      return colors[risk] || colors.medium;
    };

    const getGradeColor = (grade) => {
      const colors = {
        A: 'text-green-600',
        B: 'text-blue-600',
        C: 'text-yellow-600',
        D: 'text-orange-600',
        F: 'text-red-600'
      };
      return colors[grade] || colors.C;
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

  const ClusterCard = ({ cluster, onClick, isSelected }) => {
    const getComplexityColor = (complexity) => {
      const colors = {
        low: 'bg-green-500',
        medium: 'bg-yellow-500', 
        high: 'bg-red-500'
      };
      return colors[complexity] || colors.medium;
    };

    return (
      <div 
        className={`bg-white rounded-xl p-6 shadow-sm border transition-all duration-300 cursor-pointer hover:shadow-lg ${
          isSelected ? 'border-blue-300 ring-2 ring-blue-100 scale-105' : 'border-gray-100 hover:border-blue-200'
        }`}
        onClick={onClick}
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-gray-900 capitalize flex items-center space-x-2">
            <span>{cluster.id} Cluster</span>
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
          /* Upload Interface */
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

            {/* Content */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-gray-200/50 overflow-hidden">
              <div className="p-8">
                {activeTab === 'upload' ? (
                  <ModernFileUploader onAnalyze={handleFileAnalysis} loading={loading} />
                ) : (
                  <div className="space-y-6 max-w-lg mx-auto">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Repository URL</label>
                      <input
                        type="url"
                        placeholder="https://github.com/owner/repository"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Branch</label>
                      <input
                        type="text"
                        placeholder="main"
                        defaultValue="main"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm"
                      />
                    </div>
                    <button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                      <div className="flex items-center justify-center space-x-2">
                        <Github className="h-5 w-5" />
                        <span>Import & Analyze</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Analysis Results */
          <div className="space-y-8 animate-fade-in">
            {/* Results Header */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-6 border border-green-200/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Analysis Complete!</h2>
                    <p className="text-gray-600">120 files analyzed • 4 clusters identified • 2.04s processing time</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-green-600">A-</div>
                  <div className="text-sm text-gray-600">Overall Grade</div>
                </div>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                icon={FileText}
                title="Files Analyzed"
                value="120"
                trend={5.2}
                color="blue"
              />
              <MetricCard
                icon={Layers}
                title="Clusters Found"
                value="4"
                subtitle="Optimal structure"
                trend={-2.1}
                color="green"
              />
              <MetricCard
                icon={BarChart3}
                title="Avg Complexity"
                value="7.4"
                subtitle="Below threshold"
                trend={-8.3}
                color="yellow"
              />
              <MetricCard
                icon={Shield}
                title="Health Score"
                value="87%"
                subtitle="Excellent"
                trend={12.4}
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
                      { label: 'Modularity', value: 0.73, color: 'green' },
                      { label: 'Network Density', value: 0.31, color: 'yellow' },
                      { label: 'Clustering Coeff.', value: 0.68, color: 'blue' },
                      { label: 'Avg Path Length', value: 0.48, color: 'purple' }
                    ].map(metric => (
                      <div key={metric.label} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{metric.label}</span>
                        <div className="flex items-center space-x-3">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full bg-${metric.color}-500`}
                              style={{width: `${metric.value * 100}%`}}
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
                    {[
                      { icon: CheckCircle, text: 'Excellent modularity score', type: 'success', detail: 'Well-organized cluster structure' },
                      { icon: AlertTriangle, text: 'Consider reducing coupling', type: 'warning', detail: 'Use dependency injection patterns' },
                      { icon: TrendingUp, text: 'Split complex modules', type: 'info', detail: 'Break down files with complexity > 50' }
                    ].map((rec, idx) => (
                      <div key={idx} className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50">
                        <rec.icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                          rec.type === 'success' ? 'text-green-500' :
                          rec.type === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                        }`} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{rec.text}</p>
                          <p className="text-xs text-gray-500 mt-1">{rec.detail}</p>
                        </div>
                      </div>
                    ))}
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
                          strokeDasharray="87, 100"
                          strokeLinecap="round"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-gray-900">87</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">Health Score</p>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: 'Maintainability', value: 'Excellent', color: 'green' },
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
                    {[
                      { label: 'Low (1-10)', count: 78, percentage: 65, color: 'green' },
                      { label: 'Medium (11-25)', count: 34, percentage: 28, color: 'yellow' },
                      { label: 'High (26+)', count: 8, percentage: 7, color: 'red' }
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
                    ))}
                  </div>
                </div>

                {/* Complexity Trends */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">Complexity Hotspots</h3>
                  <div className="space-y-4">
                    {analysisResult.files.slice(0, 5).map((file, idx) => (
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
                    {analysisResult.files.map((file, index) => (
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
                <p className="text-sm text-gray-500 mt-1">Click on clusters to explore their structure</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
        )}
      </div>
    </div>
  );
};

export default ModernAnalyzerPage;
