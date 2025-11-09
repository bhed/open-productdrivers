/**
 * Journeys Analytics Page
 * Shows journey completion rates, funnels, and step analysis
 */

'use client';

import { use, useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { FlowDiagram } from '@/components/FlowDiagram';
import { PeriodFilter } from '@/components/PeriodFilter';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  detectScaleFromValue,
  normalizeRating,
  calculateNormalizedAverage,
  groupByScale,
  hasMixedScales,
  type EventWithScale,
} from '@/lib/satisfaction-scales';

interface FlowNode {
  id: string;
  label: string;
  type: 'journey' | 'step' | 'feature' | 'outcome';
  value: number;
  avgSatisfaction?: number;
}

interface FlowLink {
  source: string;
  target: string;
  value: number;
}

interface FlowData {
  nodes: FlowNode[];
  links: FlowLink[];
}

interface JourneyEvent {
  event: string;
  journey?: string;
  step?: string;
  feature?: string;
  session_id?: string;
  value?: number;
  created_at: string;
}

interface Journey {
  name: string;
  sessions: number;
  starts: number;
  completions: number;
  completionRate: number;
  avgSatisfaction: number | null;
  normalizedSatisfaction: number | null;
  hasMixedScales: boolean;
  scaleBreakdown: unknown[];
  steps: Array<{ step: string; count: number }>;
}

export default function JourneysPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [flowData, setFlowData] = useState<FlowData>({ nodes: [], links: [] });
  const [rawJourneyEvents, setRawJourneyEvents] = useState<JourneyEvent[]>([]);
  
  // Filters
  const [sortBy, setSortBy] = useState<'sessions' | 'completion' | 'satisfaction'>('sessions');
  const [minSessions, setMinSessions] = useState<number>(1);
  const [satisfactionFilter, setSatisfactionFilter] = useState<'all' | 'good' | 'bad'>('all');
  const [period, setPeriod] = useState<string>('30d');
  const [selectedJourney, setSelectedJourney] = useState<string>('all');

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();

      // Calculate period range
      const now = new Date();
      let periodStart: Date;
      
      switch (period) {
        case '7d':
          periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          periodStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'all':
          periodStart = new Date(0);
          break;
        default:
          periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Query pre-aggregated journey_stats table
      const { data: journeyStatsData } = await supabase
        .from('journey_stats')
        .select('*')
        .eq('project_id', id)
        .gte('period_start', periodStart.toISOString());

      // Aggregate data by journey (combining multiple period rows)
      const journeyMap = new Map<string, {
        totalSessions: number;
        totalCompletions: number;
        satisfactionSum: number;
        satisfactionCount: number;
      }>();

      journeyStatsData?.forEach((row) => {
        if (!journeyMap.has(row.journey)) {
          journeyMap.set(row.journey, {
            totalSessions: 0,
            totalCompletions: 0,
            satisfactionSum: 0,
            satisfactionCount: 0,
          });
        }

        const stats = journeyMap.get(row.journey)!;
        stats.totalSessions += row.total_sessions || 0;
        stats.totalCompletions += row.completed_sessions || 0;
        
        if (row.avg_satisfaction != null && row.total_sessions > 0) {
          stats.satisfactionSum += row.avg_satisfaction * row.total_sessions;
          stats.satisfactionCount += row.total_sessions;
        }
      });

      // Get raw journey events for flow diagram and step details
      const { data: allJourneyEvents } = await supabase
        .from('events')
        .select('journey, event, step, feature, value, session_id, created_at')
        .eq('project_id', id)
        .not('journey', 'is', null)
        .gte('created_at', periodStart.toISOString());
      
      // Store raw events for flow filtering
      setRawJourneyEvents(allJourneyEvents || []);

      // Calculate step breakdown from raw events for each journey
      const stepsByJourney = new Map<string, Map<string, number>>();
      const satisfactionByJourney = new Map<string, Array<EventWithScale>>();

      allJourneyEvents?.forEach((event) => {
        if (!event.journey) return;

        if (event.step) {
          if (!stepsByJourney.has(event.journey)) {
            stepsByJourney.set(event.journey, new Map());
          }
          const steps = stepsByJourney.get(event.journey)!;
          steps.set(event.step, (steps.get(event.step) || 0) + 1);
        }

        if (event.event === 'JOURNEY_SATISFACTION' && event.value) {
          if (!satisfactionByJourney.has(event.journey)) {
            satisfactionByJourney.set(event.journey, []);
          }
          satisfactionByJourney.get(event.journey)!.push({
            value: event.value,
            detectedScale: detectScaleFromValue(event.value),
          });
        }
      });

      // Combine aggregated stats with detailed event data
      const calculatedJourneys = Array.from(journeyMap.entries()).map(
        ([name, stats]) => {
          const satisfactionEvents = satisfactionByJourney.get(name) || [];
          const avgSatisfaction = stats.satisfactionCount > 0
            ? stats.satisfactionSum / stats.satisfactionCount
            : null;

          return {
            name,
            sessions: stats.totalSessions,
            starts: stats.totalSessions, // Approximation: total_sessions ≈ starts
            completions: stats.totalCompletions,
            completionRate:
              stats.totalSessions > 0
                ? (stats.totalCompletions / stats.totalSessions) * 100
                : 0,
            avgSatisfaction,
            normalizedSatisfaction:
              satisfactionEvents.length > 0
                ? calculateNormalizedAverage(satisfactionEvents)
                : avgSatisfaction, // Use aggregated value if no detailed events
            hasMixedScales: hasMixedScales(satisfactionEvents),
            scaleBreakdown: groupByScale(satisfactionEvents),
            steps: Array.from(stepsByJourney.get(name)?.entries() || []).map(([step, count]) => ({
              step,
              count,
            })),
          };
        }
      );

      setJourneys(calculatedJourneys);

      // Calculate flow data for Sankey diagram
      const flowNodes: FlowNode[] = [];
      const flowLinks: FlowLink[] = [];
      const nodeMap = new Map<string, number>();
      const outcomeSatisfactionScores = new Map<string, number[]>(); // Track satisfaction scores per outcome

      // Helper to add/update node
      const addNode = (id: string, label: string, type: 'journey' | 'step' | 'feature' | 'outcome', value: number = 1, satisfactionScore?: number) => {
        if (!nodeMap.has(id)) {
          nodeMap.set(id, flowNodes.length);
          flowNodes.push({ id, label, type, value });
        } else {
          const index = nodeMap.get(id)!;
          flowNodes[index].value += value;
        }

        // Track satisfaction scores for outcome nodes
        if (type === 'outcome' && satisfactionScore !== undefined) {
          if (!outcomeSatisfactionScores.has(id)) {
            outcomeSatisfactionScores.set(id, []);
          }
          outcomeSatisfactionScores.get(id)!.push(satisfactionScore);
        }
      };

      // Helper to add/update link
      const linkMap = new Map<string, number>();
      const addLink = (source: string, target: string, value: number = 1) => {
        const key = `${source}-${target}`;
        if (!linkMap.has(key)) {
          linkMap.set(key, flowLinks.length);
          flowLinks.push({ source, target, value });
        } else {
          const index = linkMap.get(key)!;
          flowLinks[index].value += value;
        }
      };

      // Process events by session to build flows
      const sessionFlows = new Map<string, { journey?: string; steps: Set<string>; features: Set<string>; satisfaction?: number }>();
      
      allJourneyEvents?.forEach((event: JourneyEvent) => {
        if (!event.session_id) return;
        
        if (!sessionFlows.has(event.session_id)) {
          sessionFlows.set(event.session_id, { steps: new Set(), features: new Set() });
        }
        
        const flow = sessionFlows.get(event.session_id)!;
        
        if (event.event === 'JOURNEY_START' && event.journey) {
          flow.journey = event.journey;
        }
        if (event.event === 'STEP_VIEW' && event.step) {
          flow.steps.add(event.step);
        }
        if (event.event === 'FEATURE_USED' && event.feature) {
          flow.features.add(event.feature);
        }
        if (event.event === 'JOURNEY_SATISFACTION' && event.value) {
          flow.satisfaction = event.value;
        }
      });

              // Build nodes and links from session flows
              sessionFlows.forEach((flow) => {
                if (!flow.journey) return;
                
                // Journey node
                const journeyId = `journey-${flow.journey}`;
                addNode(journeyId, flow.journey, 'journey');
                
                // Determine outcome category (group by NORMALIZED satisfaction range)
                let outcomeId = '';
                let outcomeLabel = '';
                if (flow.satisfaction !== undefined) {
                  // IMPORTANT: Normalize the satisfaction score first before categorizing
                  const scale = detectScaleFromValue(flow.satisfaction);
                  const normalizedSat = normalizeRating(flow.satisfaction, scale);
                  
                  if (normalizedSat >= 80) { // ≥80% = Satisfied
                    outcomeId = 'outcome-satisfied';
                    outcomeLabel = 'Satisfied';
                  } else if (normalizedSat >= 60) { // 60-80% = Neutral
                    outcomeId = 'outcome-neutral';
                    outcomeLabel = 'Neutral';
                  } else { // <60% = Unsatisfied
                    outcomeId = 'outcome-unsatisfied';
                    outcomeLabel = 'Unsatisfied';
                  }
                  
                  // Store the NORMALIZED satisfaction score for averaging
                  addNode(outcomeId, outcomeLabel, 'outcome', 1, normalizedSat);
                }
                
                // Track which features/steps should link to outcome (for final link creation)
                const featuresToOutcome: string[] = [];
                const stepsToOutcome: string[] = [];
                
                // Steps
                if (flow.steps.size > 0) {
                  flow.steps.forEach(step => {
                    const stepId = `step-${step}`;
                    addNode(stepId, step, 'step');
                    addLink(journeyId, stepId);
                    
                    // Features used in this step
                    if (flow.features.size > 0) {
                      flow.features.forEach(feature => {
                        const featureId = `feature-${feature}`;
                        addNode(featureId, feature, 'feature');
                        addLink(stepId, featureId);
                        
                        // Track feature for outcome link (create link later)
                        if (flow.satisfaction !== undefined && !featuresToOutcome.includes(featureId)) {
                          featuresToOutcome.push(featureId);
                        }
                      });
                    } else if (flow.satisfaction !== undefined && !stepsToOutcome.includes(stepId)) {
                      // No features, link step directly to outcome
                      stepsToOutcome.push(stepId);
                    }
                  });
                } else if (flow.satisfaction !== undefined) {
                  // Direct journey to outcome if no steps
                  addLink(journeyId, outcomeId);
                }
                
                // Create links to outcome (one link per feature/step, not per session)
                if (flow.satisfaction !== undefined) {
                  featuresToOutcome.forEach(featureId => {
                    addLink(featureId, outcomeId);
                  });
                  stepsToOutcome.forEach(stepId => {
                    addLink(stepId, outcomeId);
                  });
                }
              });

      // Calculate average satisfaction for outcome nodes
      flowNodes.forEach(node => {
        if (node.type === 'outcome') {
          const scores = outcomeSatisfactionScores.get(node.id);
          console.log(`[OUTCOME DEBUG] ${node.id} (${node.label}):`, {
            scores,
            scoresLength: scores?.length,
            nodeValue: node.value,
          });
          if (scores && scores.length > 0) {
            // Store both the count (value) and average satisfaction
            const avgSatisfaction = scores.reduce((a, b) => a + b, 0) / scores.length;
            console.log(`[OUTCOME DEBUG] ${node.id} calculated avgSatisfaction:`, avgSatisfaction);
            // Ensure the avgSatisfaction is a valid number
            if (!isNaN(avgSatisfaction) && isFinite(avgSatisfaction)) {
              node.avgSatisfaction = avgSatisfaction;
            }
            // Keep value as session count for sizing
            // node.value is already the session count
          }
        }
      });

      setFlowData({ nodes: flowNodes, links: flowLinks });
      setLoading(false);
    };

    fetchData();
  }, [id, period]);

  // Apply filters
  const filteredJourneys = journeys
    .filter((j) => {
      // Journey name filter
      if (selectedJourney !== 'all' && j.name !== selectedJourney) return false;

      // Min sessions filter
      if (j.sessions < minSessions) return false;

      // Satisfaction filter
      if (satisfactionFilter === 'good' && (j.avgSatisfaction === null || j.avgSatisfaction < 4)) {
        return false;
      }
      if (satisfactionFilter === 'bad' && (j.avgSatisfaction === null || j.avgSatisfaction >= 3)) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Apply sorting
      if (sortBy === 'sessions') {
        return b.sessions - a.sessions;
      } else if (sortBy === 'completion') {
        return b.completionRate - a.completionRate;
      } else if (sortBy === 'satisfaction') {
        const aVal = a.avgSatisfaction ?? -1;
        const bVal = b.avgSatisfaction ?? -1;
        return bVal - aVal;
      }
      return 0;
    });

  const hasData = journeys.length > 0;

  // Filter flow data based on selected journey - recalculate from raw events
  const filteredFlowData = useMemo(() => {
    if (selectedJourney === 'all' || rawJourneyEvents.length === 0) {
      return flowData;
    }

    // Filter events to only include selected journey
    const filteredEvents = rawJourneyEvents.filter(event => event.journey === selectedJourney);
    
    if (filteredEvents.length === 0) {
      return { nodes: [], links: [] };
    }

    // Rebuild flow data from scratch for this journey
    const flowNodes: FlowNode[] = [];
    const flowLinks: FlowLink[] = [];
    const nodeMap = new Map<string, number>();
    const outcomeSatisfactionScores = new Map<string, number[]>();

    // Helper to add/update node
    const addNode = (id: string, label: string, type: 'journey' | 'step' | 'feature' | 'outcome', value: number = 1, satisfactionScore?: number) => {
      if (!nodeMap.has(id)) {
        nodeMap.set(id, flowNodes.length);
        flowNodes.push({ id, label, type, value });
      } else {
        const index = nodeMap.get(id)!;
        flowNodes[index].value += value;
      }

      if (type === 'outcome' && satisfactionScore !== undefined) {
        if (!outcomeSatisfactionScores.has(id)) {
          outcomeSatisfactionScores.set(id, []);
        }
        outcomeSatisfactionScores.get(id)!.push(satisfactionScore);
      }
    };

    // Helper to add/update link
    const linkMap = new Map<string, number>();
    const addLink = (source: string, target: string, value: number = 1) => {
      const key = `${source}-${target}`;
      if (!linkMap.has(key)) {
        linkMap.set(key, flowLinks.length);
        flowLinks.push({ source, target, value });
      } else {
        const index = linkMap.get(key)!;
        flowLinks[index].value += value;
      }
    };

    // Process events by session
    const sessionFlows = new Map<string, { journey?: string; steps: Set<string>; features: Set<string>; satisfaction?: number }>();
    
    filteredEvents.forEach(event => {
      if (!event.session_id) return;
      
      if (!sessionFlows.has(event.session_id)) {
        sessionFlows.set(event.session_id, { steps: new Set(), features: new Set() });
      }
      
      const flow = sessionFlows.get(event.session_id)!;
      
      if (event.event === 'JOURNEY_START' && event.journey) {
        flow.journey = event.journey;
      }
      if (event.event === 'STEP_VIEW' && event.step) {
        flow.steps.add(event.step);
      }
      if (event.event === 'FEATURE_USED' && event.feature) {
        flow.features.add(event.feature);
      }
      if (event.event === 'JOURNEY_SATISFACTION' && event.value) {
        flow.satisfaction = event.value;
      }
    });

    // Build nodes and links from session flows
    sessionFlows.forEach((flow) => {
      if (!flow.journey) return;
      
      const journeyId = `journey-${flow.journey}`;
      addNode(journeyId, flow.journey, 'journey');
      
      // Determine outcome (NORMALIZED)
      let outcomeId = '';
      let outcomeLabel = '';
      if (flow.satisfaction !== undefined) {
        // IMPORTANT: Normalize the satisfaction score first before categorizing
        const scale = detectScaleFromValue(flow.satisfaction);
        const normalizedSat = normalizeRating(flow.satisfaction, scale);
        
        if (normalizedSat >= 80) { // ≥80% = Satisfied
          outcomeId = 'outcome-satisfied';
          outcomeLabel = 'Satisfied';
        } else if (normalizedSat >= 60) { // 60-80% = Neutral
          outcomeId = 'outcome-neutral';
          outcomeLabel = 'Neutral';
        } else { // <60% = Unsatisfied
          outcomeId = 'outcome-unsatisfied';
          outcomeLabel = 'Unsatisfied';
        }
        
        // Store the NORMALIZED satisfaction score for averaging
        addNode(outcomeId, outcomeLabel, 'outcome', 1, normalizedSat);
      }
      
      const featuresToOutcome: string[] = [];
      const stepsToOutcome: string[] = [];
      
      // Steps
      if (flow.steps.size > 0) {
        flow.steps.forEach(step => {
          const stepId = `step-${step}`;
          addNode(stepId, step, 'step');
          addLink(journeyId, stepId);
          
          // Features
          if (flow.features.size > 0) {
            flow.features.forEach(feature => {
              const featureId = `feature-${feature}`;
              addNode(featureId, feature, 'feature');
              addLink(stepId, featureId);
              
              if (flow.satisfaction !== undefined && !featuresToOutcome.includes(featureId)) {
                featuresToOutcome.push(featureId);
              }
            });
          } else if (flow.satisfaction !== undefined && !stepsToOutcome.includes(stepId)) {
            stepsToOutcome.push(stepId);
          }
        });
      } else if (flow.satisfaction !== undefined) {
        addLink(journeyId, outcomeId);
      }
      
      // Create links to outcome
      if (flow.satisfaction !== undefined) {
        featuresToOutcome.forEach(featureId => {
          addLink(featureId, outcomeId);
        });
        stepsToOutcome.forEach(stepId => {
          addLink(stepId, outcomeId);
        });
      }
    });

    // Calculate average satisfaction for outcome nodes
    flowNodes.forEach(node => {
      if (node.type === 'outcome') {
        const scores = outcomeSatisfactionScores.get(node.id);
        console.log(`[FILTERED OUTCOME DEBUG] ${node.id} (${node.label}):`, {
          scores,
          scoresLength: scores?.length,
          nodeValue: node.value,
        });
        if (scores && scores.length > 0) {
          const avgSatisfaction = scores.reduce((a, b) => a + b, 0) / scores.length;
          console.log(`[FILTERED OUTCOME DEBUG] ${node.id} calculated avgSatisfaction:`, avgSatisfaction);
          // Ensure the avgSatisfaction is a valid number
          if (!isNaN(avgSatisfaction) && isFinite(avgSatisfaction)) {
            node.avgSatisfaction = avgSatisfaction;
          }
        }
      }
    });

    return { nodes: flowNodes, links: flowLinks };
  }, [flowData, selectedJourney, rawJourneyEvents]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <LoadingSpinner size="lg" text="Loading journeys..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Journeys</h2>
        <p className="text-muted-foreground">
          Analyze user flows and completion rates
        </p>
      </div>

      {/* Filters */}
      {hasData && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Top Row: Journey + Period */}
              <div className="flex flex-wrap items-end gap-3">
                {/* Journey Filter */}
                <div className="flex-1 min-w-[220px] max-w-xs">
                  <label className="block text-sm font-medium mb-2">
                    Select Journey
                  </label>
                  <select
                    value={selectedJourney}
                    onChange={(e) => setSelectedJourney(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="all">All Journeys ({journeys.length})</option>
                    {journeys.map((journey) => (
                      <option key={journey.name} value={journey.name}>
                        {journey.name} ({journey.sessions} sessions)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Period Filter */}
                <PeriodFilter value={period} onChange={setPeriod} />
              </div>

              {/* Bottom Row: Other Filters */}
              <div className="flex flex-wrap items-end gap-3">
                {/* Sort By */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Sort By
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'sessions' | 'completion' | 'satisfaction')}
                    className="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="sessions">Sessions (most first)</option>
                    <option value="completion">Completion Rate</option>
                    <option value="satisfaction">Satisfaction</option>
                  </select>
                </div>

                {/* Min Sessions */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Min Sessions
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={minSessions}
                    onChange={(e) => setMinSessions(parseInt(e.target.value) || 1)}
                    className="flex h-10 w-24 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                </div>

                {/* Satisfaction Filter */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Satisfaction
                  </label>
                  <select
                    value={satisfactionFilter}
                    onChange={(e) => setSatisfactionFilter(e.target.value as 'all' | 'good' | 'bad')}
                    className="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="all">All Levels</option>
                    <option value="good">Good (≥4 ⭐)</option>
                    <option value="bad">Needs Work (&lt;3 ⭐)</option>
                  </select>
                </div>

                {/* Reset */}
                {(selectedJourney !== 'all' || minSessions > 1 || satisfactionFilter !== 'all' || sortBy !== 'sessions' || period !== '30d') && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedJourney('all');
                      setMinSessions(1);
                      setSatisfactionFilter('all');
                      setSortBy('sessions');
                      setPeriod('30d');
                    }}
                  >
                    Reset Filters
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {!hasData && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-6xl mb-4">🗺️</div>
            <h3 className="text-lg font-semibold mb-2">
              No Journeys Tracked Yet
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Start tracking journeys by sending events with the{' '}
              <code className="rounded bg-muted px-2 py-1">journey</code>{' '}
              parameter
            </p>
            <pre className="rounded-lg bg-muted p-4 text-xs">
              {`track({
  event: 'JOURNEY_START',
  journey: 'onboarding'
});`}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Filtered Results Info */}
      {hasData && filteredJourneys.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <h3 className="text-sm font-medium mb-2">
              No journeys match your filters
            </h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters or{' '}
              <button
                onClick={() => {
                  setMinSessions(1);
                  setSatisfactionFilter('all');
                }}
                className="font-medium underline hover:no-underline"
              >
                reset all filters
              </button>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Journeys Summary Stats */}
      {filteredJourneys.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {filteredJourneys.length === journeys.length ? 'Total Journeys' : 'Filtered Journeys'}
              </CardTitle>
              <span className="text-2xl">🗺️</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredJourneys.length}
                {filteredJourneys.length !== journeys.length && (
                  <span className="text-base text-muted-foreground"> / {journeys.length}</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              <span className="text-2xl">👥</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredJourneys.reduce((sum, j) => sum + j.sessions, 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
              <span className="text-2xl">✅</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredJourneys.length > 0
                  ? (
                      filteredJourneys.reduce((sum, j) => sum + j.completionRate, 0) /
                      filteredJourneys.length
                    ).toFixed(0)
                  : 0}
                %
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Satisfaction</CardTitle>
              <span className="text-2xl">⭐</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(() => {
                  // Calculate global satisfaction from ALL satisfaction events (not average of averages)
                  const satisfactionEvents = rawJourneyEvents.filter(
                    e => e.event === 'JOURNEY_SATISFACTION' && e.value !== null && e.value !== undefined
                  );
                  
                  if (satisfactionEvents.length === 0) return '-';
                  
                  const eventsWithScale: EventWithScale[] = satisfactionEvents.map(e => ({
                    value: e.value || 0,
                    detectedScale: detectScaleFromValue(e.value || 0),
                  }));
                  
                  const globalAvg = calculateNormalizedAverage(eventsWithScale);
                  return globalAvg.toFixed(0);
                })()}
                {rawJourneyEvents.some(e => e.event === 'JOURNEY_SATISFACTION' && e.value !== null) && (
                  <span className="text-base text-muted-foreground">%</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Normalized across all journeys
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Flow Visualization */}
      {flowData.nodes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>User Flow</CardTitle>
            <CardDescription>
              Visualize how users move through journeys, steps, features, and outcomes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FlowDiagram
              nodes={filteredFlowData.nodes}
              links={filteredFlowData.links}
              width={1000}
              height={600}
            />
          </CardContent>
        </Card>
      )}

      {/* Journeys List */}
      {filteredJourneys.length > 0 && (
        <div className="space-y-4">
          {filteredJourneys.map((journey) => (
            <Card key={journey.name}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{journey.name}</CardTitle>
                    <CardDescription>
                      {journey.sessions} sessions
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    {journey.normalizedSatisfaction !== null && (
                      <div className="text-2xl font-bold">
                        {journey.normalizedSatisfaction.toFixed(0)}%
                        {journey.hasMixedScales && (
                          <span className="ml-2 text-xs text-muted-foreground">*</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Metrics Grid */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border bg-card p-4">
                    <div className="text-sm font-medium text-muted-foreground">Starts</div>
                    <div className="mt-1 text-2xl font-bold">
                      {journey.starts}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-card p-4">
                    <div className="text-sm font-medium text-muted-foreground">
                      Completions
                    </div>
                    <div className="mt-1 text-2xl font-bold">
                      {journey.completions}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-card p-4">
                    <div className="text-sm font-medium text-muted-foreground">
                      Completion Rate
                    </div>
                    <div className="mt-1 text-2xl font-bold">
                      {journey.completionRate.toFixed(0)}%
                    </div>
                  </div>
                </div>

                {/* Steps Funnel */}
                {journey.steps.length > 0 && (
                  <div>
                    <h4 className="mb-3 text-sm font-medium">Steps</h4>
                    <div className="space-y-2">
                      {journey.steps
                        .sort((a, b) => b.count - a.count)
                        .map((stepData) => (
                          <div key={stepData.step} className="flex items-center gap-3">
                            <div className="w-32 text-sm text-muted-foreground">
                              {stepData.step}
                            </div>
                            <div className="flex-1">
                              <div className="h-8 overflow-hidden rounded-md bg-muted">
                                <div
                                  className="h-full bg-primary flex items-center justify-end px-3 text-xs font-medium text-primary-foreground"
                                  style={{
                                    width: `${
                                      (stepData.count / journey.steps[0].count) * 100
                                    }%`,
                                  }}
                                >
                                  {stepData.count}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
