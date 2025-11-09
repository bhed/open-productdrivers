/**
 * User Behavior Analytics Page
 * Track rage clicks, frustration, time spent, and hesitations
 * Correlate with satisfaction and feedback
 */

'use client';

import { use, useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PeriodFilter } from '@/components/PeriodFilter';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  MousePointerClick,
  Timer,
  Frown,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Activity,
  BarChart3,
  Users,
} from 'lucide-react';

interface BehaviorMetrics {
  rageClicks: number;
  avgTimeSpent: number;
  frustrationEvents: number;
  hesitations: number;
  totalSessions: number;
  uniqueUsers: number;
}

interface JourneyBehavior {
  journey: string;
  rageClicks: number;
  avgTimeSpent: number;
  frustrationEvents: number;
  hesitations: number;
  sessions: number;
  avgSatisfaction: number | null;
  uniqueUsers: number;
}

interface CorrelationInsight {
  type: 'positive' | 'negative' | 'neutral';
  metric: string;
  insight: string;
  correlation: number;
}

export default function UserBehaviorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('30d');
  const [selectedJourney, setSelectedJourney] = useState<string>('all');
  const [minSessions, setMinSessions] = useState<number>(1);
  const [sortBy, setSortBy] = useState<'friction' | 'satisfaction' | 'sessions'>('friction');
  
  const [metrics, setMetrics] = useState<BehaviorMetrics>({
    rageClicks: 0,
    avgTimeSpent: 0,
    frustrationEvents: 0,
    hesitations: 0,
    totalSessions: 0,
    uniqueUsers: 0,
  });
  
  const [journeyBehaviors, setJourneyBehaviors] = useState<JourneyBehavior[]>([]);
  const [correlations, setCorrelations] = useState<CorrelationInsight[]>([]);

  // Helper functions
  // Calculate Pearson correlation coefficient
  const calculateCorrelation = (x: number[], y: number[]): number => {
    const n = x.length;
    if (n === 0) return 0;

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return 0;
    return numerator / denominator;
  };

  // Format time (seconds to minutes)
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

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

      // Query pre-aggregated behavior_stats table
      const { data: behaviorStatsData } = await supabase
        .from('behavior_stats')
        .select('*')
        .eq('project_id', id)
        .gte('period_start', periodStart.toISOString());

      // Aggregate behavior stats
      let totalRageClicks = 0;
      let totalFrustrations = 0;
      let totalHesitations = 0;
      let totalTimeSpent = 0;
      const uniqueSessions = new Set<number>();
      
      const journeyMap = new Map<string, {
        rageClicks: number;
        timeSpent: number;
        frustrations: number;
        hesitations: number;
        sessions: number;
        satisfactionScores: number[];
        userIds: Set<string>;
      }>();

      behaviorStatsData?.forEach((row) => {
        const behaviorType = row.behavior_type;
        
        if (behaviorType === 'rage_click') {
          totalRageClicks += row.occurrence_count || 0;
        } else if (behaviorType === 'frustration' || behaviorType === 'dead_click') {
          totalFrustrations += row.occurrence_count || 0;
        } else if (behaviorType === 'hesitation') {
          totalHesitations += row.occurrence_count || 0;
        } else if (behaviorType === 'time_spent' && row.avg_value) {
          totalTimeSpent += row.avg_value * (row.unique_sessions || 0);
        }

        uniqueSessions.add(row.unique_sessions || 0);

        // Aggregate by journey
        if (row.journey) {
          if (!journeyMap.has(row.journey)) {
            journeyMap.set(row.journey, {
              rageClicks: 0,
              timeSpent: 0,
              frustrations: 0,
              hesitations: 0,
              sessions: 0,
              satisfactionScores: [],
              userIds: new Set(),
            });
          }

          const journeyStats = journeyMap.get(row.journey)!;
          
          if (behaviorType === 'rage_click') {
            journeyStats.rageClicks += row.occurrence_count || 0;
          } else if (behaviorType === 'frustration' || behaviorType === 'dead_click') {
            journeyStats.frustrations += row.occurrence_count || 0;
          } else if (behaviorType === 'hesitation') {
            journeyStats.hesitations += row.occurrence_count || 0;
          } else if (behaviorType === 'time_spent' && row.avg_value) {
            journeyStats.timeSpent += row.avg_value * (row.unique_sessions || 0);
          }

          journeyStats.sessions = Math.max(journeyStats.sessions, row.unique_sessions || 0);

          // Add satisfaction scores if available
          if (row.avg_satisfaction_with_behavior) {
            journeyStats.satisfactionScores.push(row.avg_satisfaction_with_behavior);
          }
        }
      });

      // Get unique user count from events (not in behavior_stats)
      const { data: userIdData } = await supabase
        .from('events')
        .select('user_id')
        .eq('project_id', id)
        .not('user_id', 'is', null)
        .gte('created_at', periodStart.toISOString());

      const uniqueUserIds = new Set(userIdData?.map(e => e.user_id).filter(Boolean) || []);

      // Calculate total unique sessions from max of all behavior types
      const totalSessions = Math.max(...Array.from(uniqueSessions), 1);
      const avgTimeSpent = totalTimeSpent > 0 ? Math.round(totalTimeSpent / totalSessions) : 0;

      setMetrics({
        rageClicks: totalRageClicks,
        avgTimeSpent,
        frustrationEvents: totalFrustrations,
        hesitations: totalHesitations,
        totalSessions,
        uniqueUsers: uniqueUserIds.size,
      });

      // Convert journey map to array
      const journeyBehaviorsArray: JourneyBehavior[] = Array.from(journeyMap.entries()).map(
        ([journey, stats]) => ({
          journey,
          rageClicks: stats.rageClicks,
          avgTimeSpent: stats.sessions > 0 ? Math.round(stats.timeSpent / stats.sessions) : 0,
          frustrationEvents: stats.frustrations,
          hesitations: stats.hesitations,
          sessions: stats.sessions,
          uniqueUsers: stats.userIds.size,
          avgSatisfaction:
            stats.satisfactionScores.length > 0
              ? stats.satisfactionScores.reduce((sum, s) => sum + s, 0) / stats.satisfactionScores.length
              : null,
        })
      );

      setJourneyBehaviors(journeyBehaviorsArray);

      // Calculate correlations and insights
      const calculatedCorrelations: CorrelationInsight[] = [];

      // Correlation: Rage Clicks vs Satisfaction
      const journeysWithSat = journeyBehaviorsArray.filter((j) => j.avgSatisfaction !== null);
      if (journeysWithSat.length > 2) {
        const rageClicksSat = journeysWithSat.map((j) => ({
          x: j.rageClicks,
          y: j.avgSatisfaction!,
        }));
        const rageCorr = calculateCorrelation(
          rageClicksSat.map((p) => p.x),
          rageClicksSat.map((p) => p.y)
        );

        if (rageCorr < -0.5) {
          calculatedCorrelations.push({
            type: 'negative',
            metric: 'Rage Clicks',
            insight: `Very strong negative correlation (-${Math.abs(rageCorr).toFixed(2)}): Rage clicks severely impact satisfaction. Priority: Fix UX issues causing repeated clicks.`,
            correlation: rageCorr,
          });
        } else if (rageCorr < -0.3) {
          calculatedCorrelations.push({
            type: 'negative',
            metric: 'Rage Clicks',
            insight: `Moderate negative correlation (-${Math.abs(rageCorr).toFixed(2)}): More rage clicks = Lower satisfaction. Investigate UI elements users repeatedly click.`,
            correlation: rageCorr,
          });
        } else if (rageCorr > 0.3) {
          calculatedCorrelations.push({
            type: 'positive',
            metric: 'Rage Clicks',
            insight: `Unexpected positive correlation (+${rageCorr.toFixed(2)}): Users who rage click might be power users exploring features. Verify tracking accuracy.`,
            correlation: rageCorr,
          });
        }
      }

      // Correlation: Time Spent vs Satisfaction
      if (journeysWithSat.length > 2) {
        const timeSpentSat = journeysWithSat.map((j) => ({
          x: j.avgTimeSpent,
          y: j.avgSatisfaction!,
        }));
        const timeCorr = calculateCorrelation(
          timeSpentSat.map((p) => p.x),
          timeSpentSat.map((p) => p.y)
        );

        if (timeCorr < -0.5) {
          calculatedCorrelations.push({
            type: 'negative',
            metric: 'Time Spent',
            insight: `Strong negative correlation (-${Math.abs(timeCorr).toFixed(2)}): Longer time = Lower satisfaction. Users are likely confused or stuck. Simplify the flow.`,
            correlation: timeCorr,
          });
        } else if (timeCorr < -0.3) {
          calculatedCorrelations.push({
            type: 'negative',
            metric: 'Time Spent',
            insight: `Moderate negative correlation (-${Math.abs(timeCorr).toFixed(2)}): Extended time might indicate friction points. Review steps taking longer than expected.`,
            correlation: timeCorr,
          });
        } else if (timeCorr > 0.5) {
          calculatedCorrelations.push({
            type: 'positive',
            metric: 'Time Spent',
            insight: `Strong positive correlation (+${timeCorr.toFixed(2)}): More time = Higher satisfaction. Users are engaged! Consider this a healthy sign.`,
            correlation: timeCorr,
          });
        } else if (timeCorr > 0.3) {
          calculatedCorrelations.push({
            type: 'positive',
            metric: 'Time Spent',
            insight: `Moderate positive correlation (+${timeCorr.toFixed(2)}): Users spending more time tend to be more satisfied (engagement indicator).`,
            correlation: timeCorr,
          });
        }
      }

      // Correlation: Frustration vs Satisfaction
      if (journeysWithSat.length > 2) {
        const frustrationSat = journeysWithSat.map((j) => ({
          x: j.frustrationEvents,
          y: j.avgSatisfaction!,
        }));
        const frustCorr = calculateCorrelation(
          frustrationSat.map((p) => p.x),
          frustrationSat.map((p) => p.y)
        );

        if (frustCorr < -0.5) {
          calculatedCorrelations.push({
            type: 'negative',
            metric: 'Frustration Events',
            insight: `Very strong negative correlation (-${Math.abs(frustCorr).toFixed(2)}): Frustration significantly impacts satisfaction. Critical: Reduce errors and fix broken features.`,
            correlation: frustCorr,
          });
        } else if (frustCorr < -0.3) {
          calculatedCorrelations.push({
            type: 'negative',
            metric: 'Frustration Events',
            insight: `Moderate negative correlation (-${Math.abs(frustCorr).toFixed(2)}): Frustration affects user experience. Focus on error handling and validation.`,
            correlation: frustCorr,
          });
        }
      }

      // Correlation: Hesitations vs Satisfaction
      if (journeysWithSat.length > 2) {
        const hesitationSat = journeysWithSat.map((j) => ({
          x: j.hesitations,
          y: j.avgSatisfaction!,
        }));
        const hesitCorr = calculateCorrelation(
          hesitationSat.map((p) => p.x),
          hesitationSat.map((p) => p.y)
        );

        if (hesitCorr < -0.4) {
          calculatedCorrelations.push({
            type: 'negative',
            metric: 'Hesitations',
            insight: `Strong negative correlation (-${Math.abs(hesitCorr).toFixed(2)}): Long pauses harm satisfaction. Users may be uncertain or unclear about next steps.`,
            correlation: hesitCorr,
          });
        } else if (hesitCorr < -0.25) {
          calculatedCorrelations.push({
            type: 'negative',
            metric: 'Hesitations',
            insight: `Moderate negative correlation (-${Math.abs(hesitCorr).toFixed(2)}): Hesitations indicate confusion. Improve copy, add tooltips, or simplify UI.`,
            correlation: hesitCorr,
          });
        }
      }

      // Additional insights based on absolute values
      const avgRageClicksPerSession = totalRageClicks / Math.max(uniqueSessions.size, 1);
      const avgFrustrationPerSession = totalFrustrations / Math.max(uniqueSessions.size, 1);

      if (avgRageClicksPerSession > 2) {
        calculatedCorrelations.push({
          type: 'negative',
          metric: 'High Rage Click Rate',
          insight: `Alert: Average ${avgRageClicksPerSession.toFixed(1)} rage clicks per session. This is significantly above normal (< 0.5). Investigate UI responsiveness and button states.`,
          correlation: -0.8,
        });
      }

      if (avgFrustrationPerSession > 1.5) {
        calculatedCorrelations.push({
          type: 'negative',
          metric: 'High Frustration Rate',
          insight: `Alert: Average ${avgFrustrationPerSession.toFixed(1)} frustration events per session. Users are encountering many errors. Review error logs and validation logic.`,
          correlation: -0.8,
        });
      }

      // Compare journey performance
      if (journeyBehaviorsArray.length > 1) {
        const sortedByFriction = [...journeyBehaviorsArray]
          .filter((j) => j.sessions >= 3) // Min sessions for reliability
          .sort((a, b) => {
            const aFriction = a.rageClicks + a.frustrationEvents + a.hesitations;
            const bFriction = b.rageClicks + b.frustrationEvents + b.hesitations;
            return bFriction - aFriction;
          });

        if (sortedByFriction.length >= 2) {
          const worst = sortedByFriction[0];
          const best = sortedByFriction[sortedByFriction.length - 1];
          const worstFriction = worst.rageClicks + worst.frustrationEvents + worst.hesitations;
          const bestFriction = best.rageClicks + best.frustrationEvents + best.hesitations;

          if (worstFriction > bestFriction * 3) {
            calculatedCorrelations.push({
              type: 'negative',
              metric: 'Journey Comparison',
              insight: `"${worst.journey}" has ${Math.round(worstFriction / worst.sessions)} friction events per session vs "${best.journey}" with ${Math.round(bestFriction / best.sessions)}. Focus optimization efforts on the worst performer.`,
              correlation: -0.7,
            });
          }
        }
      }

      // Check for time spent anomalies
      const journeysWithTime = journeyBehaviorsArray.filter((j) => j.avgTimeSpent > 0);
      if (journeysWithTime.length >= 2) {
        const avgTime = journeysWithTime.reduce((sum, j) => sum + j.avgTimeSpent, 0) / journeysWithTime.length;
        const slowJourneys = journeysWithTime.filter((j) => j.avgTimeSpent > avgTime * 2);

        if (slowJourneys.length > 0) {
          const slowestJourney = slowJourneys.reduce((a, b) => a.avgTimeSpent > b.avgTimeSpent ? a : b);
          calculatedCorrelations.push({
            type: 'neutral',
            metric: 'Time Anomaly',
            insight: `"${slowestJourney.journey}" takes ${formatTime(slowestJourney.avgTimeSpent)} on average, 2x longer than other journeys. Verify if this is expected or indicates a bottleneck.`,
            correlation: 0,
          });
        }
      }

      // If no strong correlations found
      if (calculatedCorrelations.length === 0) {
        calculatedCorrelations.push({
          type: 'neutral',
          metric: 'Overall',
          insight: 'No strong correlations detected yet. Collect more data (minimum 3 journeys with 10+ sessions each) or verify behavior tracking is implemented correctly.',
          correlation: 0,
        });
      }

      setCorrelations(calculatedCorrelations);
      setLoading(false);
    };

    fetchData();
  }, [id, period]);

  // Filter journeys
  const filteredJourneys = useMemo(() => {
    let filtered = journeyBehaviors;
    
    // Filter by selected journey
    if (selectedJourney !== 'all') {
      filtered = filtered.filter((j) => j.journey === selectedJourney);
    }

    // Filter by minimum sessions
    filtered = filtered.filter((j) => j.sessions >= minSessions);

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'friction':
          const aFriction = a.rageClicks + a.frustrationEvents + a.hesitations;
          const bFriction = b.rageClicks + b.frustrationEvents + b.hesitations;
          return bFriction - aFriction;
        case 'satisfaction':
          if (a.avgSatisfaction === null && b.avgSatisfaction === null) return 0;
          if (a.avgSatisfaction === null) return 1;
          if (b.avgSatisfaction === null) return -1;
          return b.avgSatisfaction - a.avgSatisfaction;
        case 'sessions':
          return b.sessions - a.sessions;
        default:
          return 0;
      }
    });

    return filtered;
  }, [journeyBehaviors, selectedJourney, minSessions, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <LoadingSpinner size="lg" text="Loading behavior data..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">User Behavior</h2>
        <p className="text-muted-foreground">
          Understand how users interact with your application and identify friction points
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Time Period</label>
          <PeriodFilter value={period} onChange={setPeriod} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Journey</label>
          <select
            value={selectedJourney}
            onChange={(e) => setSelectedJourney(e.target.value)}
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="all">All Journeys</option>
            {journeyBehaviors.map((j) => (
              <option key={j.journey} value={j.journey}>
                {j.journey}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Min Sessions</label>
          <select
            value={minSessions}
            onChange={(e) => setMinSessions(Number(e.target.value))}
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="1">1+</option>
            <option value="3">3+</option>
            <option value="5">5+</option>
            <option value="10">10+</option>
            <option value="50">50+</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Sort by</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'friction' | 'satisfaction' | 'sessions')}
            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="friction">Friction (High to Low)</option>
            <option value="satisfaction">Satisfaction (High to Low)</option>
            <option value="sessions">Sessions (High to Low)</option>
          </select>
        </div>
      </div>

      {/* Reset Filters */}
      {(selectedJourney !== 'all' || minSessions > 1 || sortBy !== 'friction') && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedJourney('all');
              setMinSessions(1);
              setSortBy('friction');
            }}
          >
            Reset Filters
          </Button>
        </div>
      )}

      {/* Overall Metrics */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rage Clicks</CardTitle>
            <MousePointerClick className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.rageClicks}</div>
            <p className="text-xs text-muted-foreground">
              Across {metrics.totalSessions} sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Time Spent</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTime(metrics.avgTimeSpent)}</div>
            <p className="text-xs text-muted-foreground">
              Per session
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Frustration Events</CardTitle>
            <Frown className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.frustrationEvents}</div>
            <p className="text-xs text-muted-foreground">
              Errors, back button, etc.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hesitations</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.hesitations}</div>
            <p className="text-xs text-muted-foreground">
              Long pauses ({">"} 10s)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.uniqueUsers}</div>
            <p className="text-xs text-muted-foreground">
              vs {metrics.totalSessions} sessions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Information Alert */}
      {metrics.totalSessions === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No behavior data available yet. Start tracking events with metadata like{' '}
            <code className="bg-muted px-1 rounded">clickCount</code>,{' '}
            <code className="bg-muted px-1 rounded">timeSpent</code>, or{' '}
            <code className="bg-muted px-1 rounded">error</code> to see insights here.
          </AlertDescription>
        </Alert>
      )}

      {/* Journey Breakdown */}
      {filteredJourneys.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Behavior by Journey</CardTitle>
            <CardDescription>
              Identify which journeys have the most friction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredJourneys.map((journey) => (
                  <div
                    key={journey.journey}
                    className="rounded-lg border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{journey.journey}</h4>
                        <p className="text-xs text-muted-foreground">
                          {journey.sessions} sessions • {journey.uniqueUsers} unique users
                        </p>
                      </div>
                      {journey.avgSatisfaction !== null && (
                        <Badge
                          variant={
                            journey.avgSatisfaction >= 80
                              ? 'default'
                              : journey.avgSatisfaction >= 60
                              ? 'secondary'
                              : 'destructive'
                          }
                        >
                          {journey.avgSatisfaction.toFixed(0)}% satisfaction
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Rage Clicks</div>
                        <div className="font-medium">{journey.rageClicks}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Avg Time</div>
                        <div className="font-medium">{formatTime(journey.avgTimeSpent)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Frustration</div>
                        <div className="font-medium">{journey.frustrationEvents}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Hesitations</div>
                        <div className="font-medium">{journey.hesitations}</div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Section - Correlations */}
      {correlations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Correlation Analysis
            </CardTitle>
            <CardDescription>
              How behavior metrics correlate with user satisfaction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {correlations.map((corr, index) => (
                <div
                  key={index}
                  className="rounded-lg border bg-card p-4 flex items-start gap-4"
                >
                  {corr.type === 'negative' ? (
                    <TrendingDown className="h-5 w-5 text-destructive mt-0.5" />
                  ) : corr.type === 'positive' ? (
                    <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <Activity className="h-5 w-5 text-muted-foreground mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h4 className="font-semibold">{corr.metric}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{corr.insight}</p>
                  </div>
                </div>
              ))}

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Note:</strong> Correlation does not imply causation. Use these insights
                  to identify areas for deeper investigation, not as definitive conclusions.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Implementation Guide */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">📚 Tracking Behavior Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            To get richer behavior insights, include metadata in your tracking calls:
          </p>
          
          <div className="space-y-2">
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs font-semibold mb-1">Rage Clicks</p>
              <pre className="text-xs overflow-x-auto">
{`track({
  event: 'FEATURE_USED',
  feature: 'submit_button',
  meta: { clickCount: 5 } // >3 = rage click
});`}
              </pre>
            </div>

            <div className="rounded-md bg-muted p-3">
              <p className="text-xs font-semibold mb-1">Frustration (Errors)</p>
              <pre className="text-xs overflow-x-auto">
{`track({
  event: 'FEATURE_USED',
  feature: 'form_submission',
  meta: { error: 'Validation failed' }
});`}
              </pre>
            </div>

            <div className="rounded-md bg-muted p-3">
              <p className="text-xs font-semibold mb-1">Hesitation (Time Spent)</p>
              <pre className="text-xs overflow-x-auto">
{`track({
  event: 'JOURNEY_STEP',
  step: 'payment_form',
  meta: { timeSpent: 15000 } // milliseconds
});`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
