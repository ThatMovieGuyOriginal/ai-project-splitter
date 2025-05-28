import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { ZoomIn, ZoomOut, RotateCcw, Download, Maximize2, Settings } from 'lucide-react';

// Add proper type definitions
interface VisualizationProps {
  nodes?: Record<string, {
    path: string;
    weight: number;
    complexity: { grade: string; risk: string };
    centrality: { betweenness: number; pagerank: number };
    dependencies: string[];
    clusterAssignment: string;
  }>;
  clusters?: Array<{
    id: string;
    nodes: string[];
    cohesion: number;
    coupling: number;
    size: number;
    complexity: string;
    quality: string;
  }>;
  globalMetrics?: {
    modularityScore: number;
    networkDensity: number;
    clusteringCoefficient: number;
    averagePathLength: number;
    totalComplexity: number;
    averageComplexity: number;
  };
  onNodeSelect?: (nodeId: string) => void;
  onClusterSelect?: (clusterId: string) => void;
}

const EnhancedVisualization: React.FC<VisualizationProps> = ({ 
  nodes = {}, 
  clusters = [], 
  globalMetrics = {},
  onNodeSelect,
  onClusterSelect 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'network' | 'complexity' | 'centrality' | 'risk'>('network');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Process data for D3
  const processedData = React.useMemo(() => {
    const nodeArray = Object.entries(nodes).map(([id, data]) => ({
      id,
      path: data.path || id,
      weight: data.weight || Math.random() * 100,
      complexity: data.complexity || { grade: 'B', risk: 'medium' },
      centrality: data.centrality || { betweenness: Math.random(), pagerank: Math.random() },
      clusterId: data.clusterAssignment || `cluster-${Math.floor(Math.random() * 4)}`,
      dependencies: Array.isArray(data.dependencies) ? data.dependencies : [],
      type: 'file' as const
    }));

    const links: Array<{
      source: string;
      target: string;
      weight: number;
      type: string;
    }> = [];
    
    nodeArray.forEach(source => {
      source.dependencies.forEach(targetId => {
        const target = nodeArray.find(n => n.id === targetId || n.path.includes(targetId));
        if (target) {
          links.push({
            source: source.id,
            target: target.id,
            weight: Math.random() * 0.8 + 0.2,
            type: 'dependency'
          });
        }
      });
    });

    return { nodes: nodeArray, links, clusters };
  }, [nodes, clusters]);

  // Color schemes
  const colorSchemes = {
    network: d3.scaleOrdinal<string>()
      .domain(['cluster-0', 'cluster-1', 'cluster-2', 'cluster-3'])
      .range(['#3b82f6', '#10b981', '#f59e0b', '#ef4444']),
    complexity: d3.scaleSequential()
      .domain([0, 100])
      .interpolator(d3.interpolateViridis),
    centrality: d3.scaleSequential()
      .domain([0, 1])
      .interpolator(d3.interpolateBlues),
    risk: d3.scaleOrdinal<string>()
      .domain(['low', 'medium', 'high', 'critical'])
      .range(['#10b981', '#f59e0b', '#ef4444', '#7c2d12'])
  };

  // Update dimensions on resize
  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({
        width: rect.width,
        height: Math.max(400, Math.min(rect.height, 800))
      });
    }
  }, []);

  useEffect(() => {
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [updateDimensions]);

  // Main D3 visualization
  useEffect(() => {
    if (!svgRef.current || !processedData.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create main group with zoom
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        setZoomLevel(event.transform.k);
      });

    svg.call(zoom);

    // Create gradients and filters
    const defs = svg.append('defs');

    // Glow filter
    const glowFilter = defs.append('filter')
      .attr('id', 'glow')
      .attr('width', '300%')
      .attr('height', '300%');

    glowFilter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur');

    const glowMerge = glowFilter.append('feMerge');
    glowMerge.append('feMergeNode').attr('in', 'coloredBlur');
    glowMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Create node gradients
    processedData.nodes.forEach(node => {
      const gradient = defs.append('radialGradient')
        .attr('id', `gradient-${node.id.replace(/[^a-zA-Z0-9]/g, '-')}`)
        .attr('cx', '30%')
        .attr('cy', '30%');

      const baseColor = getNodeColor(node, viewMode);
      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', d3.color(baseColor)!.brighter(1).toString());
      gradient.append('stop')
        .attr('offset', '70%')
        .attr('stop-color', baseColor);
      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', d3.color(baseColor)!.darker(0.5).toString());
    });

    // Size scales
    const nodeSize = d3.scaleSqrt()
      .domain(d3.extent(processedData.nodes, d => d.weight) as [number, number])
      .range([8, 40]);

    const linkWidth = d3.scaleLinear()
      .domain(d3.extent(processedData.links, d => d.weight) as [number, number])
      .range([1, 4]);

    // Force simulation
    const simulation = d3.forceSimulation(processedData.nodes as any)
      .force('link', d3.forceLink(processedData.links as any)
        .id((d: any) => d.id)
        .distance((d: any) => 80 + (1 - d.weight) * 50)
        .strength(0.3))
      .force('charge', d3.forceManyBody()
        .strength((d: any) => -300 - nodeSize(d.weight) * 5))
      .force('center', d3.forceCenter(innerWidth / 2, innerHeight / 2))
      .force('collision', d3.forceCollide()
        .radius((d: any) => nodeSize(d.weight) + 5)
        .strength(0.7))
      .force('x', d3.forceX(innerWidth / 2).strength(0.05))
      .force('y', d3.forceY(innerHeight / 2).strength(0.05));

    // Add cluster forces for better grouping
    const clusterCenters: Record<string, { x: number; y: number }> = {};
    clusters.forEach((cluster, i) => {
      const angle = (i / clusters.length) * 2 * Math.PI;
      const radius = Math.min(innerWidth, innerHeight) * 0.25;
      clusterCenters[cluster.id] = {
        x: innerWidth / 2 + Math.cos(angle) * radius,
        y: innerHeight / 2 + Math.sin(angle) * radius
      };
    });

    processedData.nodes.forEach(node => {
      const center = clusterCenters[node.clusterId];
      if (center) {
        simulation.force(`x-${node.clusterId}`, d3.forceX(center.x).strength(0.1));
        simulation.force(`y-${node.clusterId}`, d3.forceY(center.y).strength(0.1));
      }
    });

    // Create link elements
    const linkContainer = g.append('g').attr('class', 'links');
    const link = linkContainer
      .selectAll('line')
      .data(processedData.links)
      .enter().append('line')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-width', (d: any) => linkWidth(d.weight))
      .attr('stroke-opacity', 0.6)
      .style('filter', 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke', '#3b82f6')
          .attr('stroke-opacity', 0.8);
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .attr('stroke', '#cbd5e1')
          .attr('stroke-opacity', 0.6);
      });

    // Create node elements
    const nodeContainer = g.append('g').attr('class', 'nodes');
    const node = nodeContainer
      .selectAll('g')
      .data(processedData.nodes)
      .enter().append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Outer ring for complexity indication
    node.append('circle')
      .attr('class', 'outer-ring')
      .attr('r', (d: any) => nodeSize(d.weight) + 4)
      .attr('fill', 'none')
      .attr('stroke', (d: any) => colorSchemes.risk(d.complexity.risk))
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)
      .attr('stroke-dasharray', (d: any) => d.complexity.risk === 'critical' ? '3,3' : 'none');

    // Main node circles
    node.append('circle')
      .attr('class', 'main-circle')
      .attr('r', (d: any) => nodeSize(d.weight))
      .attr('fill', (d: any) => `url(#gradient-${d.id.replace(/[^a-zA-Z0-9]/g, '-')})`)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2)
      .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))')
      .on('mouseover', function(event, d: any) {
        // Highlight effect
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', nodeSize(d.weight) * 1.3)
          .style('filter', 'url(#glow)');

        // Highlight connected links
        link
          .attr('stroke-opacity', (l: any) => 
            (l.source.id === d.id || l.target.id === d.id) ? 0.8 : 0.2)
          .attr('stroke', (l: any) => 
            (l.source.id === d.id || l.target.id === d.id) ? '#3b82f6' : '#cbd5e1');

        showTooltip(event, d);
      })
      .on('mouseout', function(event, d: any) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', nodeSize(d.weight))
          .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))');

        // Reset link styles
        link
          .attr('stroke-opacity', 0.6)
          .attr('stroke', '#cbd5e1');

        hideTooltip();
      })
      .on('click', (event, d: any) => {
        setSelectedNode(d.id === selectedNode ? null : d.id);
        onNodeSelect?.(d.id);
      });

    // Node icons based on file type
    node.append('text')
      .attr('class', 'node-icon')
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .attr('font-size', (d: any) => Math.max(8, nodeSize(d.weight) * 0.4))
      .attr('font-weight', '600')
      .attr('fill', '#ffffff')
      .style('pointer-events', 'none')
      .text((d: any) => getFileIcon(d.path));

    // Node labels (show for important nodes)
    const labels = g.append('g').attr('class', 'labels');
    
    const importantNodes = processedData.nodes.filter(d => 
      d.centrality.betweenness > 0.1 || d.weight > 50 || selectedNode === d.id
    );

    labels.selectAll('text')
      .data(importantNodes)
      .enter().append('text')
      .attr('class', 'node-label')
      .attr('text-anchor', 'middle')
      .attr('dy', (d: any) => nodeSize(d.weight) + 15)
      .attr('font-size', '10px')
      .attr('font-weight', '500')
      .attr('fill', '#374151')
      .style('pointer-events', 'none')
      .text((d: any) => d.path.split('/').pop() || d.id);

    // Cluster hulls (convex hull around cluster nodes)
    const hullContainer = g.append('g').attr('class', 'hulls');
    
    function updateHulls() {
      clusters.forEach(cluster => {
        const clusterNodes = processedData.nodes.filter(n => n.clusterId === cluster.id);
        if (clusterNodes.length < 3) return;

        const points = clusterNodes
          .filter(n => (n as any).x !== undefined && (n as any).y !== undefined)
          .map(n => [(n as any).x, (n as any).y] as [number, number]);

        if (points.length < 3) return;

        const hull = d3.polygonHull(points);
        if (!hull) return;

        // Expand hull slightly
        const centroid = d3.polygonCentroid(hull);
        const expandedHull: [number, number][] = hull.map(point => {
          const dx = point[0] - centroid[0];
          const dy = point[1] - centroid[1];
          return [
            centroid[0] + dx * 1.2,
            centroid[1] + dy * 1.2
          ] as [number, number];
        });

        hullContainer.selectAll(`path.hull-${cluster.id}`)
          .data([expandedHull])
          .join('path')
          .attr('class', `hull-${cluster.id}`)
          .attr('d', d3.line().curve(d3.curveCardinalClosed.tension(0.8))(expandedHull))
          .attr('fill', colorSchemes.network(cluster.id))
          .attr('fill-opacity', 0.1)
          .attr('stroke', colorSchemes.network(cluster.id))
          .attr('stroke-width', 2)
          .attr('stroke-opacity', 0.3)
          .attr('stroke-dasharray', '5,5')
          .style('cursor', 'pointer')
          .on('click', () => {
            setSelectedCluster(cluster.id === selectedCluster ? null : cluster.id);
            onClusterSelect?.(cluster.id);
          });
      });
    }

    // Simulation tick function
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);

      labels.selectAll('text')
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y);

      updateHulls();
    });

    // Drag functions
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Helper functions
    function getNodeColor(node: any, mode: string) {
      switch (mode) {
        case 'complexity':
          return colorSchemes.complexity(node.weight);
        case 'centrality':
          return colorSchemes.centrality(node.centrality.betweenness);
        case 'risk':
          return colorSchemes.risk(node.complexity.risk);
        default:
          return colorSchemes.network(node.clusterId);
      }
    }

    function getFileIcon(path: string) {
      const ext = path.split('.').pop()?.toLowerCase();
      const iconMap: Record<string, string> = {
        'ts': '⚡',
        'tsx': '⚛️',
        'js': '📜',
        'jsx': '⚛️',
        'py': '🐍',
        'java': '☕',
        'cpp': '⚙️',
        'css': '🎨',
        'html': '🌐',
        'json': '📋',
        'md': '📝'
      };
      return iconMap[ext || ''] || '📄';
    }

    function showTooltip(event: MouseEvent, d: any) {
      const tooltip = d3.select('body').append('div')
        .attr('class', 'vis-tooltip')
        .style('position', 'absolute')
        .style('background', 'rgba(0, 0, 0, 0.9)')
        .style('color', 'white')
        .style('padding', '12px 16px')
        .style('border-radius', '8px')
        .style('font-size', '12px')
        .style('pointer-events', 'none')
        .style('backdrop-filter', 'blur(10px)')
        .style('box-shadow', '0 10px 25px rgba(0,0,0,0.3)')
        .style('z-index', '1000')
        .style('opacity', '0');

      tooltip.html(`
        <div style="font-weight: 600; margin-bottom: 8px; color: #60a5fa;">
          ${d.path.split('/').pop() || d.id}
        </div>
        <div style="margin-bottom: 4px;">
          <span style="color: #9ca3af;">Path:</span> ${d.path}
        </div>
        <div style="margin-bottom: 4px;">
          <span style="color: #9ca3af;">Complexity:</span> 
          <span style="color: ${d.complexity.risk === 'high' ? '#ef4444' : d.complexity.risk === 'medium' ? '#f59e0b' : '#10b981'};">
            ${d.complexity.grade} (${d.complexity.risk})
          </span>
        </div>
        <div style="margin-bottom: 4px;">
          <span style="color: #9ca3af;">Weight:</span> ${d.weight.toFixed(1)}
        </div>
        <div style="margin-bottom: 4px;">
          <span style="color: #9ca3af;">Centrality:</span> ${(d.centrality.betweenness * 100).toFixed(1)}%
        </div>
        <div>
          <span style="color: #9ca3af;">Cluster:</span> ${d.clusterId}
        </div>
      `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .transition()
        .duration(200)
        .style('opacity', '1');
    }

    function hideTooltip() {
      d3.selectAll('.vis-tooltip').remove();
    }

    // Cleanup function
    return () => {
      simulation.stop();
      d3.selectAll('.vis-tooltip').remove();
    };

  }, [processedData, dimensions, viewMode, selectedNode, selectedCluster, clusters, onNodeSelect, onClusterSelect]);

  // Control functions
  const handleZoomIn = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().transform as any,
      d3.zoomIdentity.scale(Math.min(zoomLevel * 1.5, 4))
    );
  };

  const handleZoomOut = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().transform as any,
      d3.zoomIdentity.scale(Math.max(zoomLevel * 0.75, 0.1))
    );
  };

  const handleReset = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().transform as any,
      d3.zoomIdentity
    );
  };

  const handleDownload = () => {
    const svg = svgRef.current;
    if (!svg) return;
    
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'network-visualization.svg';
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className={`bg-white rounded-2xl shadow-xl border border-gray-200/50 overflow-hidden ${
      isFullscreen ? 'fixed inset-4 z-50' : ''
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Network Analysis</h3>
          <p className="text-sm text-gray-500">
            {processedData.nodes.length} nodes • {processedData.links.length} connections
          </p>
        </div>
        
        {/* View Mode Selector */}
        <div className="flex items-center space-x-4">
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {(['network', 'complexity', 'centrality', 'risk'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded text-sm font-medium transition-all duration-200 ${
                  viewMode === mode
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleZoomIn}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={handleReset}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Reset View"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={handleDownload}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Download SVG"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Toggle Fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Visualization Container */}
      <div 
        ref={containerRef}
        className="relative bg-gradient-to-br from-gray-50 to-white"
        style={{ height: isFullscreen ? 'calc(100vh - 200px)' : '600px' }}
      >
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full h-full"
        />
        
        {/* Zoom Level Indicator */}
        <div className="absolute top-4 left-4 bg-black/75 text-white px-3 py-1 rounded-full text-sm">
          {Math.round(zoomLevel * 100)}%
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-200/50 max-w-xs">
          <h4 className="font-semibold text-gray-900 mb-3">
            Legend - {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} View
          </h4>
          <div className="space-y-2">
            {viewMode === 'network' && clusters.map(cluster => (
              <div key={cluster.id} className="flex items-center space-x-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: colorSchemes.network(cluster.id) }}
                />
                <span className="text-sm text-gray-700 capitalize">
                  {cluster.id} ({cluster.nodes?.length || 0} files)
                </span>
              </div>
            ))}
            {viewMode === 'complexity' && (
              <div className="flex items-center space-x-2">
                <div className="w-16 h-3 rounded" style={{ 
                  background: 'linear-gradient(to right, #440154, #31688e, #35b779, #fde725)' 
                }} />
                <span className="text-sm text-gray-700">Low → High Complexity</span>
              </div>
            )}
            {viewMode === 'risk' && (
              <>
                {(['low', 'medium', 'high', 'critical'] as const).map(risk => (
                  <div key={risk} className="flex items-center space-x-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: colorSchemes.risk(risk) }}
                    />
                    <span className="text-sm text-gray-700 capitalize">{risk} Risk</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedVisualization;
