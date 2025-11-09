'use client';

import { useRef, useState } from 'react';

interface FlowNode {
  id: string;
  label: string;
  value: number; // Session count
  type: 'journey' | 'step' | 'feature' | 'outcome';
  avgSatisfaction?: number; // Average satisfaction for outcome nodes (already normalized to 0-100)
}

interface FlowLink {
  source: string;
  target: string;
  value: number;
}

interface FlowDiagramProps {
  nodes: FlowNode[];
  links: FlowLink[];
  width?: number;
  height?: number;
}

export function FlowDiagram({ nodes, links, width = 800, height = 500 }: FlowDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);

  // Helper to format satisfaction score (avgSatisfaction is already normalized to 0-100)
  const formatSatisfaction = (satisfaction: number | undefined): string => {
    if (satisfaction === undefined || satisfaction === null) return '-';
    if (isNaN(satisfaction) || !isFinite(satisfaction)) return '-';
    // Clamp to 0-100 range just in case
    const clamped = Math.max(0, Math.min(100, satisfaction));
    return `${clamped.toFixed(0)}%`;
  };

  // Group nodes by type
  const nodesByType = {
    journey: nodes.filter(n => n.type === 'journey'),
    step: nodes.filter(n => n.type === 'step'),
    feature: nodes.filter(n => n.type === 'feature'),
    outcome: nodes.filter(n => n.type === 'outcome'),
  };

  // Calculate positions
  const padding = { top: 40, right: 150, bottom: 40, left: 150 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Column positions
  const columns = [
    { x: 0, label: 'Start', nodes: nodesByType.journey },
    { x: innerWidth * 0.33, label: 'Steps', nodes: nodesByType.step },
    { x: innerWidth * 0.66, label: 'Features', nodes: nodesByType.feature },
    { x: innerWidth, label: 'Outcomes', nodes: nodesByType.outcome },
  ];

  // Calculate node positions
  const nodePositions = new Map<string, { x: number; y: number; height: number }>();
  
  columns.forEach((column) => {
    const totalValue = column.nodes.reduce((sum, n) => sum + n.value, 0);
    let currentY = 0;
    
    column.nodes.forEach((node) => {
      const nodeHeight = Math.max(20, (node.value / Math.max(totalValue, 1)) * innerHeight * 0.8);
      const spacing = (innerHeight - column.nodes.reduce((sum, n) => {
        const h = Math.max(20, (n.value / Math.max(totalValue, 1)) * innerHeight * 0.8);
        return sum + h;
      }, 0)) / Math.max(column.nodes.length + 1, 1);
      
      nodePositions.set(node.id, {
        x: padding.left + column.x,
        y: padding.top + currentY + spacing,
        height: nodeHeight,
      });
      
      currentY += nodeHeight + spacing;
    });
  });

  // Generate path for links using cubic Bezier curves
  const generatePath = (link: FlowLink): string => {
    const source = nodePositions.get(link.source);
    const target = nodePositions.get(link.target);
    
    if (!source || !target) return '';

    const sourceX = source.x + 120; // Node width
    const sourceY = source.y + source.height / 2;
    const targetX = target.x;
    const targetY = target.y + target.height / 2;
    
    const midX = (sourceX + targetX) / 2;
    
    // Create a smooth curve
    return `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;
  };

  // Calculate paths to selected outcome with contribution scores
  const { pathsToOutcome, nodesInPath, nodeContributions, linkContributions } = selectedOutcome ? (() => {
    const paths = new Set<string>();
    const nodeSet = new Set<string>();
    const visited = new Set<string>();
    const contributions = new Map<string, number>(); // sessions flowing through each node to outcome
    const linkContrib = new Map<string, number>(); // sessions flowing through each link
    
    const traverse = (nodeId: string): number => {
      if (visited.has(nodeId)) {
        return contributions.get(nodeId) || 0;
      }
      visited.add(nodeId);
      nodeSet.add(nodeId);
      
      // Find all links that lead to this node
      const incomingLinks = links.filter(l => l.target === nodeId);
      
      if (incomingLinks.length === 0) {
        // Leaf node (the outcome itself)
        const node = nodes.find(n => n.id === nodeId);
        const count = node?.value || 0;
        contributions.set(nodeId, count);
        return count;
      }
      
      let totalContribution = 0;
      incomingLinks.forEach(link => {
        const linkKey = `${link.source}-${link.target}`;
        paths.add(linkKey);
        nodeSet.add(link.source);
        
        // The link's contribution is its value (sessions)
        const linkValue = link.value;
        linkContrib.set(linkKey, linkValue);
        totalContribution += linkValue;
        
        // Recursively traverse
        traverse(link.source);
      });
      
      contributions.set(nodeId, totalContribution);
      return totalContribution;
    };
    
    traverse(selectedOutcome);
    
    // Normalize contributions to 0-1 range
    const maxContribution = Math.max(...Array.from(contributions.values()), 1);
    const normalizedContributions = new Map<string, number>();
    contributions.forEach((value, key) => {
      normalizedContributions.set(key, value / maxContribution);
    });
    
    const maxLinkContrib = Math.max(...Array.from(linkContrib.values()), 1);
    const normalizedLinkContrib = new Map<string, number>();
    linkContrib.forEach((value, key) => {
      normalizedLinkContrib.set(key, value / maxLinkContrib);
    });
    
    return { 
      pathsToOutcome: paths, 
      nodesInPath: nodeSet, 
      nodeContributions: normalizedContributions,
      linkContributions: normalizedLinkContrib
    };
  })() : { 
    pathsToOutcome: new Set<string>(), 
    nodesInPath: new Set<string>(),
    nodeContributions: new Map<string, number>(),
    linkContributions: new Map<string, number>()
  };

  // Get heat map color based on contribution and outcome type
  const getHeatMapColor = (nodeId: string, contribution: number): { fill: string; opacity: number } => {
    if (!selectedOutcome) return { fill: 'transparent', opacity: 0 };
    
    const outcomeNode = nodes.find(n => n.id === selectedOutcome);
      if (!outcomeNode) return { fill: 'transparent', opacity: 0 };
      
      const satisfaction = outcomeNode.avgSatisfaction ?? 50; // Default to neutral 50% if no satisfaction data
    
    // Intensity based on contribution (0-1)
    const intensity = Math.max(0.2, contribution); // minimum 20% opacity for visibility
    
    if (satisfaction >= 80) { // ≥80% = Satisfied
      // Satisfied: green gradient
      return { fill: 'rgb(16 185 129)', opacity: intensity * 0.4 }; // emerald with variable opacity
    } else if (satisfaction >= 60) { // 60-80% = Neutral
      // Neutral: orange gradient
      return { fill: 'rgb(245 158 11)', opacity: intensity * 0.5 }; // amber
    } else { // <60% = Unsatisfied
      // Unsatisfied: red gradient (more intense)
      return { fill: 'rgb(239 68 68)', opacity: intensity * 0.6 }; // rose
    }
  };

  // Get color based on link type
  const getLinkColor = (link: FlowLink, contribution?: number): string => {
    const target = nodes.find(n => n.id === link.target);
    if (!target) return 'rgb(203 213 225)'; // slate-300

      if (target.type === 'outcome') {
        // Color based on outcome satisfaction (use avgSatisfaction, not value which is session count)
        const outcomeValue = target.avgSatisfaction ?? 50; // Default to neutral 50% if no satisfaction data
      
      // Apply heat map intensity if selected
      if (selectedOutcome && contribution !== undefined) {
        const alpha = Math.max(0.4, contribution);
        if (outcomeValue >= 80) return `rgba(16, 185, 129, ${alpha})`; // emerald
        if (outcomeValue >= 60) return `rgba(245, 158, 11, ${alpha})`; // amber
        return `rgba(239, 68, 68, ${alpha})`; // rose
      }
      
      if (outcomeValue >= 80) return 'rgb(16 185 129)'; // emerald-500
      if (outcomeValue >= 60) return 'rgb(245 158 11)'; // amber-500
      return 'rgb(239 68 68)'; // rose-500
    }

    return 'rgb(148 163 184)'; // slate-400
  };

  const getNodeColor = (node: FlowNode): string => {
    switch (node.type) {
      case 'journey':
        return 'rgb(79 70 229)'; // indigo-600
      case 'step':
        return 'rgb(59 130 246)'; // blue-500
      case 'feature':
        return 'rgb(16 185 129)'; // emerald-500
        case 'outcome':
          // Use avgSatisfaction for color, not value (which is session count)
          const satisfaction = node.avgSatisfaction ?? 50; // Default to neutral 50% if no satisfaction data
        if (satisfaction >= 80) return 'rgb(16 185 129)'; // emerald-500
        if (satisfaction >= 60) return 'rgb(245 158 11)'; // amber-500
        return 'rgb(239 68 68)'; // rose-500
      default:
        return 'rgb(148 163 184)'; // slate-400
    }
  };

  if (nodes.length === 0 || links.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-border p-12 text-center">
        <div>
          <p className="text-sm text-muted-foreground">Not enough data to display flow diagram</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Track more events with journeys, steps, and features to see the flow
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="w-full"
        style={{ minWidth: `${width}px` }}
      >
        {/* Column labels */}
        {columns.map((column, index) => (
          <text
            key={`label-${index}`}
            x={padding.left + column.x}
            y={padding.top - 15}
            className="text-xs font-semibold fill-foreground"
            textAnchor="middle"
          >
            {column.label}
          </text>
        ))}

        {/* Links */}
        <g className="links">
          {links.map((link, index) => {
            const path = generatePath(link);
            const isHovered = hoveredLink === `${link.source}-${link.target}`;
            const linkId = `${link.source}-${link.target}`;
            const isInPath = pathsToOutcome.has(linkId);
            const hasSelection = selectedOutcome !== null;
            const contribution = linkContributions.get(linkId) || 0;

            return (
              <path
                key={`link-${index}`}
                d={path}
                fill="none"
                stroke={
                  hasSelection && !isInPath 
                    ? 'rgb(148 163 184)' // gray for non-path links when outcome selected
                    : isInPath 
                      ? getLinkColor(link, contribution) 
                      : getLinkColor(link)
                }
                strokeWidth={
                  hasSelection && !isInPath 
                    ? 1 // Very thin for non-path links
                    : isInPath 
                      ? Math.max(4, Math.min(link.value * 3 * (1 + contribution), 30)) 
                      : Math.max(2, Math.min(link.value * 2, 20))
                }
                opacity={hasSelection ? (isInPath ? 0.95 : 0.15) : (hoveredLink && !isHovered ? 0.2 : 0.5)}
                className="transition-all duration-300"
                onMouseEnter={() => setHoveredLink(linkId)}
                onMouseLeave={() => setHoveredLink(null)}
                style={{ cursor: 'pointer' }}
              >
                <title>
                  {nodes.find(n => n.id === link.source)?.label} → {nodes.find(n => n.id === link.target)?.label}: {link.value} sessions
                  {isInPath && contribution > 0 && ` (${Math.round(contribution * 100)}% contribution)`}
                </title>
              </path>
            );
          })}
        </g>

        {/* Nodes */}
        <g className="nodes">
          {Array.from(nodePositions.entries()).map(([nodeId, pos]) => {
            const node = nodes.find(n => n.id === nodeId);
            if (!node) return null;

            const isInPath = nodesInPath.has(nodeId);
            const isSelected = selectedOutcome === nodeId;
            const hasSelection = selectedOutcome !== null;
            const contribution = nodeContributions.get(nodeId) || 0;
            const heatMapColor = isInPath && !isSelected ? getHeatMapColor(nodeId, contribution) : null;

            return (
              <g key={`node-${nodeId}`} className="node-group">
                {/* Highlight ring for selected/path nodes */}
                {(isSelected || isInPath) && (
                  <>
                    {/* Outer glow */}
                    <rect
                      x={pos.x - 6}
                      y={pos.y - 6}
                      width={132}
                      height={pos.height + 12}
                      fill={isSelected ? 'rgba(251, 146, 60, 0.2)' : 'rgba(99, 102, 241, 0.15)'}
                      stroke="none"
                      rx={10}
                      className="transition-all duration-300"
                    />
                    {/* Border */}
                    <rect
                      x={pos.x - 3}
                      y={pos.y - 3}
                      width={126}
                      height={pos.height + 6}
                      fill="none"
                      stroke={isSelected ? 'rgb(251 146 60)' : 'rgb(99 102 241)'}
                      strokeWidth={isSelected ? 4 : 3}
                      rx={8}
                      className="transition-all duration-300"
                    />
                  </>
                )}

                {/* Node rectangle */}
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={120}
                  height={pos.height}
                  fill={getNodeColor(node)}
                  rx={6}
                  className="transition-all duration-300 hover:brightness-110"
                  style={{ cursor: node.type === 'outcome' ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (node.type === 'outcome') {
                      setSelectedOutcome(selectedOutcome === nodeId ? null : nodeId);
                    }
                  }}
                  opacity={hasSelection && !isInPath ? 0.3 : 1}
                >
                    <title>
                      {node.label}: {node.value} sessions
                      {node.type === 'outcome' && node.avgSatisfaction !== undefined && node.avgSatisfaction !== null && ` (avg: ${formatSatisfaction(node.avgSatisfaction)})`}
                      {node.type === 'outcome' && ' (Click to analyze)'}
                      {isInPath && contribution > 0 && ` (${Math.round(contribution * 100)}% contribution to outcome)`}
                    </title>
                </rect>

                {/* Heat map overlay */}
                {heatMapColor && heatMapColor.opacity > 0 && (
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={120}
                    height={pos.height}
                    fill={heatMapColor.fill}
                    opacity={heatMapColor.opacity}
                    rx={6}
                    className="pointer-events-none transition-all duration-500"
                    style={{ mixBlendMode: 'multiply' }}
                  />
                )}

                {/* Node label */}
                <text
                  x={pos.x + 60}
                  y={pos.y + pos.height / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-white text-xs font-semibold pointer-events-none drop-shadow-sm"
                  style={{ userSelect: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                >
                  {node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label}
                </text>

                {/* Node value */}
                <text
                  x={pos.x + 60}
                  y={pos.y + pos.height / 2 + 14}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-white text-[10px] font-semibold pointer-events-none drop-shadow-sm"
                  style={{ userSelect: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                >
                  {node.type === 'outcome' 
                    ? `${node.value} users • ${formatSatisfaction(node.avgSatisfaction)}`
                    : `${node.value} users`
                  }
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legend */}
      <div className="mt-4 space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-emerald-500"></div>
            <span className="text-muted-foreground">High Satisfaction (≥80%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-amber-500"></div>
            <span className="text-muted-foreground">Medium (60-80%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-rose-500"></div>
            <span className="text-muted-foreground">Low Satisfaction (&lt;60%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded border-2 border-amber-500"></div>
            <span className="text-muted-foreground">Click outcomes to analyze drivers</span>
          </div>
        </div>
        
        {selectedOutcome && (
          <div className="flex items-center justify-center gap-3 rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-2 text-xs">
            <span className="font-semibold text-orange-900">🔥 Heat Map Active:</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="h-3 w-2 rounded bg-gradient-to-r from-transparent to-rose-500"></div>
                <span className="text-foreground">Darker color = Higher contribution to outcome</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="h-3 w-8 rounded border border-border bg-gradient-to-r from-white via-rose-300 to-rose-600"></div>
              <span className="text-foreground">0% → 100%</span>
            </div>
          </div>
        )}
      </div>

      {/* Driver Analysis Panel */}
      {selectedOutcome && (() => {
        const outcomeNode = nodes.find(n => n.id === selectedOutcome);
        if (!outcomeNode) return null;

        // Get all nodes in the path
        const journeysInPath = nodes.filter(n => nodesInPath.has(n.id) && n.type === 'journey');
        const stepsInPath = nodes.filter(n => nodesInPath.has(n.id) && n.type === 'step');
        const featuresInPath = nodes.filter(n => nodesInPath.has(n.id) && n.type === 'feature');

        // Count sessions through each path with contribution scores
        const featureUsage = featuresInPath.map(feature => {
          const linksToFeature = links.filter(l => l.target === feature.id);
          const sessionsCount = linksToFeature.reduce((sum, l) => sum + l.value, 0);
          const contribution = nodeContributions.get(feature.id) || 0;
          return { feature, sessions: sessionsCount, contribution };
        }).sort((a, b) => b.contribution - a.contribution); // Sort by contribution, not just sessions

        const journeyUsage = journeysInPath.map(journey => {
          const contribution = nodeContributions.get(journey.id) || 0;
          return { journey, contribution };
        }).sort((a, b) => b.contribution - a.contribution);

        const stepUsage = stepsInPath.map(step => {
          const contribution = nodeContributions.get(step.id) || 0;
          return { step, contribution };
        }).sort((a, b) => b.contribution - a.contribution);

        return (
          <div className="mt-6 rounded-xl border-2 border-primary bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-primary/10 p-3">
                    <span className="text-3xl">
                      {(() => {
                        const sat = outcomeNode.avgSatisfaction ?? 50;
                        return sat >= 80 ? '😊' : sat >= 60 ? '😐' : '😟';
                      })()}
                    </span>
                  </div>
                <div>
                  <h3 className="text-2xl font-bold">
                    Drivers Analysis: {outcomeNode.label}
                    </h3>
                    <p className="text-sm font-medium text-muted-foreground">
                      {outcomeNode.value} sessions • avg {formatSatisfaction(outcomeNode.avgSatisfaction)} • {nodesInPath.size} nodes in path
                    </p>
                  </div>
              </div>
              <button
                onClick={() => setSelectedOutcome(null)}
                className="rounded-lg bg-muted px-4 py-2 text-sm font-medium transition-all hover:bg-muted/80"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {/* Journeys */}
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xl">🗺️</span>
                  <h4 className="font-bold">Journeys</h4>
                  <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold">
                    {journeysInPath.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {journeyUsage.length > 0 ? (
                    journeyUsage.map(({ journey, contribution }) => {
                      const heatColor = getHeatMapColor(journey.id, contribution);
                      return (
                        <div key={journey.id} className="rounded-md bg-muted/50 px-3 py-2 relative overflow-hidden">
                          {/* Heat map background */}
                          <div 
                            className="absolute inset-0 rounded-md transition-all duration-500"
                            style={{ 
                              background: `linear-gradient(to right, transparent, ${heatColor.fill})`,
                              opacity: heatColor.opacity * 0.3
                            }}
                          />
                          <div className="relative flex items-center justify-between">
                            <span className="text-sm font-medium">
                              • {journey.label}
                            </span>
                            <span className="text-xs font-bold">
                              {Math.round(contribution * 100)}%
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-md bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">No specific journey</div>
                  )}
                </div>
              </div>

              {/* Steps */}
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xl">📍</span>
                  <h4 className="font-bold">Steps</h4>
                  <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold">
                    {stepsInPath.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {stepUsage.length > 0 ? (
                    stepUsage.map(({ step, contribution }) => {
                      const heatColor = getHeatMapColor(step.id, contribution);
                      return (
                        <div key={step.id} className="rounded-md bg-muted/50 px-3 py-2 relative overflow-hidden">
                          {/* Heat map background */}
                          <div 
                            className="absolute inset-0 rounded-md transition-all duration-500"
                            style={{ 
                              background: `linear-gradient(to right, transparent, ${heatColor.fill})`,
                              opacity: heatColor.opacity * 0.3
                            }}
                          />
                          <div className="relative flex items-center justify-between">
                            <span className="text-sm font-medium">
                              • {step.label}
                            </span>
                            <span className="text-xs font-bold">
                              {Math.round(contribution * 100)}%
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-md bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">No specific steps</div>
                  )}
                </div>
              </div>

              {/* Features */}
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xl">✨</span>
                  <h4 className="font-bold">Key Features</h4>
                  <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold">
                    {featuresInPath.length}
                  </span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {featureUsage.length > 0 ? (
                    featureUsage.map(({ feature, contribution }) => {
                      const heatColor = getHeatMapColor(feature.id, contribution);
                      return (
                        <div key={feature.id} className="rounded-md bg-muted/50 px-3 py-2 relative overflow-hidden">
                          {/* Heat map background */}
                          <div 
                            className="absolute inset-0 rounded-md transition-all duration-500"
                            style={{ 
                              background: `linear-gradient(to right, transparent, ${heatColor.fill})`,
                              opacity: heatColor.opacity * 0.3
                            }}
                          />
                          <div className="relative flex items-center justify-between">
                            <span className="text-sm font-medium">{feature.label}</span>
                            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-bold">
                              {Math.round(contribution * 100)}%
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-md bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">No features tracked</div>
                  )}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="mt-4 rounded-xl border bg-card p-5">
              <h4 className="mb-4 text-base font-bold">📊 Path Summary</h4>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-3xl font-bold">{journeysInPath.length}</div>
                  <div className="text-xs font-semibold text-muted-foreground">Journeys</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-3xl font-bold">{stepsInPath.length}</div>
                  <div className="text-xs font-semibold text-muted-foreground">Steps</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <div className="text-3xl font-bold">{featuresInPath.length}</div>
                  <div className="text-xs font-semibold text-muted-foreground">Features</div>
                </div>
                  <div className="rounded-lg bg-primary/10 p-3 text-center">
                    <div className="text-3xl font-bold">
                      {formatSatisfaction(outcomeNode.avgSatisfaction)}
                    </div>
                    <div className="text-xs font-semibold text-muted-foreground">Avg Rating</div>
                  </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border bg-muted/50 p-4">
              <p className="text-sm font-medium leading-relaxed">
                <span className="text-lg">💡</span> <strong>Tip:</strong> The highlighted paths show which journeys, steps, and features led users to this satisfaction level. 
                Features used more frequently in these paths are the <strong>key drivers</strong> of this outcome.
              </p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

