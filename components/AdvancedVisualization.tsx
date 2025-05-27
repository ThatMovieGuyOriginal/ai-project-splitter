// components/AdvancedVisualization.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';

interface Node {
  id: string;
  path: string;
  weight: number;
  complexity: any;
  centrality: any;
  clusterId: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Link {
  source: string | Node;
  target: string | Node;
  weight: number;
}

interface Cluster {
  id: string;
  nodes: string[];
  quality: any;
  centroid?: { x: number; y: number };
  hull?: Array<[number, number]>;
}

interface AdvancedVisualizationProps {
  nodes: Record<string, any>;
  clusters: any[];
  globalMetrics: any;
  networkAnalysis: any;
  onNodeSelect?: (nodeId: string) => void;
  onClusterSelect?: (clusterId: string) => void;
}

export const AdvancedVisualization: React.FC<AdvancedVisualizationProps> = ({
  nodes,
  clusters,
  globalMetrics,
  networkAnalysis,
  onNodeSelect,
  onClusterSelect
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'network' | 'clusters' | 'complexity' | 'centrality'>('network');
  
  // Process data for D3
  const processedData = React.useMemo(() => {
    const nodeArray: Node[] = Object.entries(nodes).map(([id, data]) => ({
      id,
      path: data.path,
      weight: data.weight,
      complexity: data.complexity,
      centrality: data.centrality,
      clusterId: data.clusterAssignment || 'unknown'
    }));

    const links: Link[] = [];
    Object.entries(nodes).forEach(([sourceId, sourceData]) => {
      sourceData.dependencies.forEach((targetId: string) => {
        if (nodes[targetId]) {
          links.push({
            source: sourceId,
            target: targetId,
            weight: 1
          });
        }
      });
    });

    return { nodes: nodeArray, links, clusters };
  }, [nodes, clusters]);

  // Color scales
  const colorScales = React.useMemo(() => ({
    cluster: d3.scaleOrdinal(d3.schemeCategory10),
    complexity: d3.scaleSequential(d3.interpolateYlOrRd)
      .domain([0, Math.max(...Object.values(nodes).map((n: any) => n.weight))]),
    centrality: d3.scaleSequential(d3.interpolateBlues)
      .domain([0, Math.max(...Object.values(nodes).map((n: any) => n.centrality?.betweenness || 0))]),
    quality: d3.scaleSequential(d3.interpolateGreens)
      .domain([0, 1])
  }), [nodes]);

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current?.parentElement) {
        const rect = svgRef.current.parentElement.getBoundingClientRect();
        setDimensions({ width: rect.width, height: Math.min(rect.height, 800) });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Main visualization effect
  useEffect(() => {
    if (!svgRef.current || !processedData.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create main group
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create force simulation
    const simulation = d3.forceSimulation(processedData.nodes)
      .force('link', d3.forceLink(processedData.links)
        .id((d: any) => d.id)
        .distance(d => Math.max(30, 100 - (d as any).weight * 2))
        .strength(0.3))
      .force('charge', d3.forceManyBody()
        .strength(d => -Math.max(100, (d as any).weight * 10)))
      .force('center', d3.forceCenter(innerWidth / 2, innerHeight / 2))
      .force('collision', d3.forceCollide()
        .radius(d => Math.max(8, Math.sqrt((d as any).weight) * 2)))
      .force('x', d3.forceX(innerWidth / 2).strength(0.1))
      .force('y', d3.forceY(innerHeight / 2).strength(0.1));

    // Add cluster-based forces
    if (viewMode === 'clusters') {
      clusters.forEach((cluster, i) => {
        const angle = (i / clusters.length) * 2 * Math.PI;
        const radius = Math.min(innerWidth, innerHeight) * 0.3;
        const clusterX = innerWidth / 2 + Math.cos(angle) * radius;
        const clusterY = innerHeight / 2 + Math.sin(angle) * radius;

        simulation.force(`cluster-${cluster.id}`, d3.forceX(clusterX)
          .strength(0.3)
          .x(() => clusterX));
        simulation.force(`cluster-y-${cluster.id}`, d3.forceY(clusterY)
          .strength(0.3)
          .y(() => clusterY));
      });
    }

    // Draw cluster hulls
    const hullGroup = g.append('g').attr('class', 'hulls');
    
    // Draw links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(processedData.links)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d: any) => Math.sqrt(d.weight));

    // Draw nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(processedData.nodes)
      .enter().append('circle')
      .attr('r', d => Math.max(4, Math.sqrt(d.weight) * 1.5))
      .attr('fill', d => getNodeColor(d, viewMode, colorScales))
      .attr('stroke', d => selectedNode === d.id ? '#000' : '#fff')
      .attr('stroke-width', d => selectedNode === d.id ? 3 : 1.5)
      .style('cursor', 'pointer')
      .call(d3.drag<SVGCircleElement, Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add node labels for important nodes
    const labels = g.append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(processedData.nodes.filter(d => 
        d.centrality?.betweenness > 0.1 || d.weight > 50
      ))
      .enter().append('text')
      .text(d => d.path.split('/').pop() || d.id)
      .attr('font-size', '10px')
      .attr('fill', '#333')
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .style('pointer-events', 'none');

    // Node interactions
    node
      .on('click', (event, d) => {
        setSelectedNode(d.id === selectedNode ? null : d.id);
        onNodeSelect?.(d.id);
      })
      .on('mouseover', (event, d) => {
        showTooltip(event, d);
      })
      .on('mouseout', hideTooltip);

    // Simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('cx', d => d.x!)
        .attr('cy', d => d.y!);

      labels
        .attr('x', d => d.x!)
        .attr('y', d => d.y! - Math.sqrt(d.weight) * 1.5 - 5);

      // Update cluster hulls
      updateClusterHulls();
    });

    // Drag functions
    function dragstarted(event: any, d: Node) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: Node) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: Node) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Update cluster hulls
    function updateClusterHulls() {
      if (viewMode !== 'clusters') return;

      clusters.forEach(cluster => {
        const clusterNodes = processedData.nodes
          .filter(n => n.clusterId === cluster.id)
          .filter(n => n.x !== undefined && n.y !== undefined);

        if (clusterNodes.length < 3) return;

        const points: [number, number][] = clusterNodes.map(n => [n.x!, n.y!]);
        const hull = d3.polygonHull(points);
        
        if (hull) {
          hullGroup.selectAll(`path.hull-${cluster.id}`)
            .data([hull])
            .join('path')
            .attr('class', `hull-${cluster.id}`)
            .attr('d', d3.line().curve(d3.curveCardinalClosed.tension(0.85))(hull))
            .attr('fill', colorScales.cluster(cluster.id))
            .attr('fill-opacity', 0.1)
            .attr('stroke', colorScales.cluster(cluster.id))
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.5)
            .style('cursor', 'pointer')
            .on('click', () => {
              setSelectedCluster(cluster.id === selectedCluster ? null : cluster.id);
              onClusterSelect?.(cluster.id);
            });
        }
      });
    }

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [processedData, dimensions, viewMode, selectedNode, selectedCluster, colorScales, onNodeSelect, onClusterSelect]);

  const getNodeColor = (node: Node, mode: string, scales: any) => {
    switch (mode) {
      case 'clusters':
        return scales.cluster(node.clusterId);
      case 'complexity':
        return scales.complexity(node.weight);
      case 'centrality':
        return scales.centrality(node.centrality?.betweenness || 0);
      default:
        return scales.cluster(node.clusterId);
    }
  };

  const showTooltip = (event: MouseEvent, node: Node) => {
    // Create tooltip content
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '10px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '1000');

    tooltip.html(`
      <div><strong>${node.path}</strong></div>
      <div>Complexity: ${node.complexity.grade} (${node.weight.toFixed(1)})</div>
      <div>Centrality: ${(node.centrality?.betweenness || 0).toFixed(3)}</div>
      <div>Cluster: ${node.clusterId}</div>
      <div>Risk: ${node.complexity.risk}</div>
    `);

    tooltip
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 10) + 'px')
      .style('opacity', 1);
  };

  const hideTooltip = () => {
    d3.selectAll('.tooltip').remove();
  };

  return (
    <div className="advanced-visualization">
      {/* Controls */}
      <div className="visualization-controls" style={{ marginBottom: '1rem' }}>
        <div className="view-mode-selector">
          {['network', 'clusters', 'complexity', 'centrality'].map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode as any)}
              className={viewMode === mode ? 'active' : ''}
              style={{
                margin: '0 0.5rem',
                padding: '0.5rem 1rem',
                backgroundColor: viewMode === mode ? '#007bff' : '#f8f9fa',
                color: viewMode === mode ? 'white' : '#333',
                border: '1px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Panel */}
      <div className="metrics-panel" style={{ 
        display: 'flex', 
        justifyContent: 'space-around', 
        marginBottom: '1rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px'
      }}>
        <div className="metric">
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
            {globalMetrics.modularityScore.toFixed(3)}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Modularity</div>
        </div>
        <div className="metric">
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
            {globalMetrics.clusteringCoefficient.toFixed(3)}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Clustering</div>
        </div>
        <div className="metric">
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
            {globalMetrics.averagePathLength.toFixed(1)}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Avg Path Length</div>
        </div>
        <div className="metric">
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
            {globalMetrics.networkDensity.toFixed(3)}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Density</div>
        </div>
      </div>

      {/* SVG Container */}
      <div style={{ 
        width: '100%', 
        height: '600px', 
        border: '1px solid #ddd', 
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          style={{ display: 'block' }}
        />
      </div>

      {/* Legend */}
      <div className="legend" style={{ 
        marginTop: '1rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Legend - {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} View
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {viewMode === 'clusters' && clusters.map(cluster => (
            <div key={cluster.id} style={{ display: 'flex', alignItems: 'center' }}>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  backgroundColor: colorScales.cluster(cluster.id),
                  marginRight: '0.5rem',
                  borderRadius: '50%'
                }}
              />
              <span style={{ fontSize: '0.9rem' }}>
                Cluster {cluster.id} ({cluster.nodes.length} nodes)
              </span>
            </div>
          ))}
          {viewMode === 'complexity' && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ 
                width: '100px', 
                height: '10px', 
                background: 'linear-gradient(to right, #ffffcc, #fd8d3c, #bd0026)',
                marginRight: '0.5rem'
              }} />
              <span style={{ fontSize: '0.9rem' }}>Low → High Complexity</span>
            </div>
          )}
          {viewMode === 'centrality' && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ 
                width: '100px', 
                height: '10px', 
                background: 'linear-gradient(to right, #f7fbff, #4292c6, #08519c)',
                marginRight: '0.5rem'
              }} />
              <span style={{ fontSize: '0.9rem' }}>Low → High Centrality</span>
            </div>
          )}
        </div>
      </div>

      {/* Selected Node/Cluster Info */}
      {selectedNode && (
        <div className="selection-info" style={{
          marginTop: '1rem',
          padding: '1rem',
          backgroundColor: '#e7f3ff',
          borderRadius: '4px',
          border: '1px solid #007bff'
        }}>
          <h4>Selected Node: {nodes[selectedNode]?.path}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <strong>Complexity:</strong> {nodes[selectedNode]?.complexity.grade} 
              ({nodes[selectedNode]?.weight.toFixed(1)})
            </div>
            <div>
              <strong>Risk Level:</strong> {nodes[selectedNode]?.complexity.risk}
            </div>
            <div>
              <strong>Betweenness:</strong> {(nodes[selectedNode]?.centrality?.betweenness || 0).toFixed(3)}
            </div>
            <div>
              <strong>PageRank:</strong> {(nodes[selectedNode]?.centrality?.pagerank || 0).toFixed(3)}
            </div>
          </div>
        </div>
      )}

      {selectedCluster && (
        <div className="selection-info" style={{
          marginTop: '1rem',
          padding: '1rem',
          backgroundColor: '#f0f8f0',
          borderRadius: '4px',
          border: '1px solid #28a745'
        }}>
          <h4>Selected Cluster: {selectedCluster}</h4>
          {clusters.find(c => c.id === selectedCluster) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <strong>Nodes:</strong> {clusters.find(c => c.id === selectedCluster)?.nodes.length}
              </div>
              <div>
                <strong>Cohesion:</strong> {clusters.find(c => c.id === selectedCluster)?.cohesion.toFixed(3)}
              </div>
              <div>
                <strong>Modularity:</strong> {clusters.find(c => c.id === selectedCluster)?.modularity.toFixed(3)}
              </div>
              <div>
                <strong>Quality Grade:</strong> {clusters.find(c => c.id === selectedCluster)?.quality?.grade}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
