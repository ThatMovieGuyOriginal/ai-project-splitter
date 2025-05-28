import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, Github, FileText, GitBranch, Zap, Shield, Layers, TrendingUp, AlertTriangle, CheckCircle, Eye, Download, Settings, Play } from 'lucide-react';
import * as d3 from 'd3';

// Mock data for demonstration - replace with actual data from your API
const mockAnalysisResult = {
  files: [
    { path: 'src/core/advanced-analyzer.ts', complexity: 52, loc: 1200, dependencies: ['ml-matrix', '@babel/parser'] },
    { path: 'src/lib/database/index.ts', complexity: 18, loc: 450, dependencies: ['sqlite3'] },
    { path: 'pages/watchlists.tsx', complexity: 17, loc: 380, dependencies: ['react', 'next'] },
    { path: 'components/Sidebar.tsx', complexity: 16, loc: 320, dependencies: ['react', 'lucide-react'] },
    { path: 'src/security/scanner.ts', complexity: 15, loc: 290, dependencies: ['fs', 'path'] }
  ],
  clusters: [
    { id: 'core', nodes: ['advanced-analyzer.ts', 'analyzer.ts'], cohesion: 0.85, coupling: 0.23, size: 15, complexity: 'high' },
    { id: 'ui', nodes: ['Sidebar.tsx', 'FileUploader.tsx'], cohesion: 0.72, coupling: 0.31, size: 12, complexity: 'medium' },
    { id: 'api', nodes: ['analyze.ts', 'github.ts'], cohesion: 0.68, coupling: 0.28, size: 8, complexity: 'medium' },
    { id: 'utils', nodes: ['archive-extractor.ts', 'scanner.ts'], cohesion: 0.91, coupling: 0.15, size: 6, complexity: 'low' }
  ],
  globalMetrics: {
    modularityScore: 0.73,
    networkDensity: 0.31,
    clusteringCoefficient: 0.68,
    averagePathLength: 2.4,
    totalComplexity: 892,
    averageComplexity: 7.4
  }
};

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState('upload');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [viewMode, setViewMode] = useState('network');
  const svgRef = useRef(null);

  // File upload simulation
  const handleFileUpload = useCallback(async (file) => {
    setLoading(true);
    setUploadProgress(0);
    
    // Simulate upload progress
    for (let i = 0; i <= 100; i += 10) {
      setUploadProgress(i);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Simulate analysis
    await new Promise(resolve => setTimeout(resolve, 1500));
    setAnalysisResult(mockAnalysisResult);
    setLoading(false);
  }, []);

  // D3 Network Visualization
  useEffect(() => {
    if (!analysisResult || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 800;
    const height = 600;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };

    // Create nodes and links from analysis data
    const nodes = analysisResult.clusters.map((cluster, i) => ({
      id: cluster.id,
      group: i,
      size: cluster.size,
      complexity: cluster.complexity,
      cohesion: cluster.cohesion,
      coupling: cluster.coupling,
      x: width / 2,
      y: height / 2
    }));

    const links = [];
    // Create links based on coupling between clusters
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (Math.random() > 0.5) { // Simulate connections
          links.push({
            source: nodes[i].id,
            target: nodes[j].id,
            value: Math.random() * 0.5 + 0.1
          });
        }
      }
    }

    // Color scales
    const complexityColor = d3.scaleOrdinal()
      .domain(['low', 'medium', 'high'])
      .range(['#10b981', '#f59e0b', '#ef4444']);

    const sizeScale = d3.scaleSqrt()
      .domain([0, d3.max(nodes, d => d.size)])
      .range([20, 80]);

    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(150))
      .force('charge', d3.forceManyBody().strength(-800))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => sizeScale(d.size) + 10));

    // Create links
    const link = svg.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', d => Math.sqrt(d.value) * 4)
      .attr('stroke-opacity', 0.6);

    // Create nodes
    const node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Node circles with gradient
    const defs = svg.append('defs');
    
    nodes.forEach(d => {
      const gradient = defs.append('radialGradient')
        .attr('id', `gradient-${d.id}`)
        .attr('cx', '30%')
        .attr('cy', '30%');
      
      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', d3.color(complexityColor(d.complexity)).brighter(0.5));
      
      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', complexityColor(d.complexity));
    });

    node.append('circle')
      .attr('r', d => sizeScale(d.size))
      .attr('fill', d => `url(#gradient-${d.id})`)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 3)
      .style('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', sizeScale(d.size) * 1.2)
          .style('filter', 'drop-shadow(0 6px 12px rgba(0,0,0,0.2))');
        
        // Show tooltip
        showTooltip(event, d);
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', sizeScale(d.size))
          .style('filter', 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))');
        
        hideTooltip();
      })
      .on('click', (event, d) => {
        setSelectedCluster(d);
      });

    // Node labels
    node.append('text')
      .text(d => d.id)
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', '#1f2937')
      .style('pointer-events', 'none');

    // Cohesion rings
    node.append('circle')
      .attr('r', d => sizeScale(d.size) + 5)
      .attr('fill', 'none')
      .attr('stroke', d => complexityColor(d.complexity))
      .attr('stroke-width', d => d.cohesion * 4)
      .attr('stroke-opacity', 0.6)
      .attr('stroke-dasharray', '5,5');

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    function showTooltip(event, d) {
      const tooltip = d3.select('body').append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0)
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.9)')
        .style('color', 'white')
        .style('padding', '12px')
        .style('border-radius', '8px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('backdrop-filter', 'blur(10px)')
        .style('box-shadow', '0 10px 25px rgba(0,0,0,0.2)');

      tooltip.html(`
        <div style="font-weight: 600; margin-bottom: 8px;">${d.id.charAt(0).toUpperCase() + d.id.slice(1)} Cluster</div>
        <div>Files: ${d.size}</div>
        <div>Complexity: ${d.complexity}</div>
        <div>Cohesion: ${(d.cohesion * 100).toFixed(1)}%</div>
        <div>Coupling: ${(d.coupling * 100).toFixed(1)}%</div>
      `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .transition()
        .duration(200)
        .style('opacity', 1);
    }

    function hideTooltip() {
      d3.selectAll('.tooltip').remove();
    }

  }, [analysisResult, viewMode]);

  const MetricCard = ({ icon: Icon, title, value, subtitle, color, trend }) => (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 hover:scale-105">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        {trend && (
          <div className={`flex items-center text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            <TrendingUp className="h-4 w-4 mr-1" />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-600">{title}</p>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );

  const FileCard = ({ file, rank }) => (
    <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-100 hover:border-blue-200 transition-colors">
      <div className="flex items-center space-x-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
          rank <= 3 ? 'bg-red-100 text-red-700' : rank <= 7 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
        }`}>
          {rank}
        </div>
        <div>
          <p className="font-medium text-gray-900 truncate">{file.path.split('/').pop()}</p>
          <p className="text-sm text-gray-500">{file.path}</p>
        </div>
      </div>
      <div className="flex items-center space-x-4 text-right">
        <div>
          <p className="text-sm font-medium text-gray-900">{file.complexity}</p>
          <p className="text-xs text-gray-500">Complexity</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{file.loc}</p>
          <p className="text-xs text-gray-500">LOC</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  LLM Index Analyzer
                </h1>
                <p className="text-sm text-gray-500">AI-Optimized Code Analysis</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                <Settings className="h-5 w-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                <Eye className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!analysisResult ? (
          /* Upload Section */
          <div className="max-w-4xl mx-auto">
            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-white/60 backdrop-blur-sm p-1 rounded-xl mb-8 border border-gray-200/50">
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === 'upload'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Upload className="h-5 w-5" />
                <span>Upload Project</span>
              </button>
              <button
                onClick={() => setActiveTab('github')}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                  activeTab === 'github'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Github className="h-5 w-5" />
                <span>GitHub Import</span>
              </button>
            </div>

            {activeTab === 'upload' ? (
              /* File Upload */
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden">
                <div className="p-8">
                  <div 
                    className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
                      loading 
                        ? 'border-blue-300 bg-blue-50/50' 
                        : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer'
                    }`}
                    onClick={() => !loading && document.getElementById('file-input').click()}
                  >
                    <input
                      id="file-input"
                      type="file"
                      className="hidden"
                      accept=".zip,.tar,.tar.gz,.tgz"
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    />
                    
                    {loading ? (
                      <div className="space-y-4">
                        <div className="w-16 h-16 mx-auto">
                          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                        </div>
                        <div>
                          <p className="text-lg font-medium text-gray-900">Analyzing your project...</p>
                          <p className="text-sm text-gray-500 mt-1">This may take a few moments</p>
                        </div>
                        {uploadProgress > 0 && (
                          <div className="max-w-xs mx-auto">
                            <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div 
                                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                              ></div>
                            </div>
                            <p className="text-xs text-center mt-2 text-gray-500">{uploadProgress}% Complete</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="w-16 h-16 mx-auto bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                          <Upload className="h-8 w-8 text-white" />
                        </div>
                        <div>
                          <p className="text-lg font-medium text-gray-900">Drop your project archive here</p>
                          <p className="text-sm text-gray-500 mt-1">or click to browse files</p>
                        </div>
                        <div className="flex justify-center space-x-2">
                          {['ZIP', 'TAR', 'TAR.GZ', 'TGZ'].map(format => (
                            <span key={format} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                              {format}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* GitHub Import */
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 p-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Repository URL</label>
                    <input
                      type="url"
                      placeholder="https://github.com/owner/repository"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                    <input
                      type="text"
                      placeholder="main"
                      defaultValue="main"
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center justify-center space-x-2">
                    <Github className="h-5 w-5" />
                    <span>Import & Analyze</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Analysis Results */
          <div className="space-y-8">
            {/* Header with Actions */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Analysis Complete</h2>
                <p className="text-gray-500 mt-1">120 files analyzed • 4 clusters found • 2.04s processing time</p>
              </div>
              <div className="flex items-center space-x-3">
                <button className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors">
                  <Download className="h-4 w-4" />
                  <span>Export</span>
                </button>
                <button 
                  onClick={() => setAnalysisResult(null)}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Play className="h-4 w-4" />
                  <span>New Analysis</span>
                </button>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <MetricCard
                icon={FileText}
                title="Files Analyzed"
                value="120"
                color="bg-gradient-to-r from-blue-500 to-blue-600"
                trend={5.2}
              />
              <MetricCard
                icon={Layers}
                title="Clusters Found"
                value="4"
                subtitle="Optimal modularity"
                color="bg-gradient-to-r from-green-500 to-green-600"
                trend={-2.1}
              />
              <MetricCard
                icon={TrendingUp}
                title="Avg Complexity"
                value="7.4"
                subtitle="Below threshold"
                color="bg-gradient-to-r from-yellow-500 to-yellow-600"
                trend={-8.3}
              />
              <MetricCard
                icon={Shield}
                title="Health Score"
                value="87%"
                subtitle="Excellent"
                color="bg-gradient-to-r from-purple-500 to-purple-600"
                trend={12.4}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Network Visualization */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden">
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-gray-900">Cluster Network</h3>
                      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
                        {['network', 'complexity', 'coupling'].map(mode => (
                          <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                              viewMode === mode
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="relative">
                    <svg
                      ref={svgRef}
                      width={800}
                      height={600}
                      className="w-full h-auto"
                      style={{ maxHeight: '600px' }}
                    />
                  </div>
                </div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Global Metrics */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Global Metrics</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Modularity</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full" style={{width: '73%'}}></div>
                        </div>
                        <span className="text-sm font-medium">0.73</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Density</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div className="bg-yellow-500 h-2 rounded-full" style={{width: '31%'}}></div>
                        </div>
                        <span className="text-sm font-medium">0.31</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Clustering</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{width: '68%'}}></div>
                        </div>
                        <span className="text-sm font-medium">0.68</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selected Cluster Details */}
                {selectedCluster && (
                  <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      {selectedCluster.id.charAt(0).toUpperCase() + selectedCluster.id.slice(1)} Cluster
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Files</span>
                        <span className="text-sm font-medium">{selectedCluster.size}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Complexity</span>
                        <span className={`text-sm font-medium ${
                          selectedCluster.complexity === 'high' ? 'text-red-600' :
                          selectedCluster.complexity === 'medium' ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                          {selectedCluster.complexity}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Cohesion</span>
                        <span className="text-sm font-medium">{(selectedCluster.cohesion * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Coupling</span>
                        <span className="text-sm font-medium">{(selectedCluster.coupling * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Recommendations</h3>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Good modularity</p>
                        <p className="text-xs text-gray-500">Well-organized cluster structure</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Reduce coupling</p>
                        <p className="text-xs text-gray-500">Consider dependency injection</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Split large files</p>
                        <p className="text-xs text-gray-500">Break down complex modules</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Most Complex Files */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Most Complex Files</h3>
                  <span className="text-sm text-gray-500">Top 5 by complexity score</span>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {analysisResult.files.map((file, index) => (
                    <FileCard key={file.path} file={file} rank={index + 1} />
                  ))}
                </div>
              </div>
            </div>

            {/* Cluster Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {analysisResult.clusters.map(cluster => (
                <div 
                  key={cluster.id}
                  className={`bg-white rounded-xl p-6 shadow-sm border transition-all duration-300 hover:shadow-lg cursor-pointer ${
                    selectedCluster?.id === cluster.id 
                      ? 'border-blue-300 ring-2 ring-blue-100' 
                      : 'border-gray-100 hover:border-blue-200'
                  }`}
                  onClick={() => setSelectedCluster(cluster)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-gray-900 capitalize">{cluster.id}</h4>
                    <div className={`w-3 h-3 rounded-full ${
                      cluster.complexity === 'high' ? 'bg-red-400' :
                      cluster.complexity === 'medium' ? 'bg-yellow-400' : 'bg-green-400'
                    }`}></div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Files</span>
                      <span className="font-medium">{cluster.size}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Cohesion</span>
                      <span className="font-medium">{(cluster.cohesion * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Coupling</span>
                      <span className="font-medium">{(cluster.coupling * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          cluster.cohesion > 0.8 ? 'bg-green-500' :
                          cluster.cohesion > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${cluster.cohesion * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 text-center">Quality Score</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Advanced Metrics Dashboard */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Complexity Distribution */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Complexity Distribution</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span className="text-sm text-gray-600">Low (1-10)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{width: '65%'}}></div>
                      </div>
                      <span className="text-sm font-medium w-8">78</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                      <span className="text-sm text-gray-600">Medium (11-25)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div className="bg-yellow-500 h-2 rounded-full" style={{width: '28%'}}></div>
                      </div>
                      <span className="text-sm font-medium w-8">34</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-4 h-4 bg-red-500 rounded"></div>
                      <span className="text-sm text-gray-600">High (26+)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div className="bg-red-500 h-2 rounded-full" style={{width: '7%'}}></div>
                      </div>
                      <span className="text-sm font-medium w-8">8</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Technical Debt */}
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Technical Debt Analysis</h3>
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="relative w-24 h-24 mx-auto mb-4">
                      <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-gray-200"
                          stroke="currentColor"
                          strokeWidth="2"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-green-500"
                          stroke="currentColor"
                          strokeWidth="2"
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
                    <p className="text-sm text-gray-600">Health Score</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Maintainability</span>
                      <span className="font-medium text-green-600">Excellent</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Testability</span>
                      <span className="font-medium text-yellow-600">Good</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Evolutionary Risk</span>
                      <span className="font-medium text-green-600">Low</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
