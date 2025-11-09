/**
 * Insights & Drivers Page
 * Unified view of feature correlations with visual analytics
 */

'use client';

import { use, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { PeriodFilter } from '@/components/PeriodFilter';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { InsightsDigest } from '@/components/InsightsDigest';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, TrendingDown, Minus, AlertCircle, Lightbulb } from 'lucide-react';
import {
  detectScaleFromValue,
  normalizeRating,
} from '@/lib/satisfaction-scales';

interface EventData {
  session_id: string | null;
  event: string;
  feature?: string;
  value?: number;
  journey?: string;
  created_at: string;
}

interface SessionData {
  features: Set<string>;
  satisfaction?: number;
  journey?: string;
}

interface Driver {
  feature: string;
  usageCount: number;
  avgWith: number;
  avgWithout: number;
  delta: number;
  journeys: string[];
}

export default function InsightsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [sessionData, setSessionData] = useState<Map<string, SessionData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [eventsWithSession, setEventsWithSession] = useState<EventData[]>([]);
  const [eventsWithoutSession, setEventsWithoutSession] = useState<EventData[]>([]);
  const [allJourneys, setAllJourneys] = useState<string[]>([]);
  
  // Filters
  const [selectedJourney, setSelectedJourney] = useState<string>('all');
  const [minSessions, setMinSessions] = useState<number>(1);
  const [showPositive, setShowPositive] = useState(true);
  const [showNegative, setShowNegative] = useState(true);
  const [showNeutral, setShowNeutral] = useState(false);
  const [period, setPeriod] = useState<string>('30d');

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      const supabase = createClient();
      setLoading(true);

      // Calculate period range for querying aggregation tables
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
          periodStart = new Date(0); // Beginning of time
          break;
        default:
          periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Query pre-aggregated driver_stats table
      const { data: driverStatsData } = await supabase
        .from('driver_stats')
        .select('*')
        .eq('project_id', id)
        .gte('period_start', periodStart.toISOString())
        .order('satisfaction_delta', { ascending: false, nullsFirst: false });

      // Aggregate data by feature (combining multiple period rows)
      const featureMap = new Map<string, {
        totalSessionsWith: number;
        totalSessionsWithout: number;
        satisfactionWithSum: number;
        satisfactionWithCount: number;
        satisfactionWithoutSum: number;
        satisfactionWithoutCount: number;
        journeys: Set<string>;
      }>();

      driverStatsData?.forEach((row) => {
        const key = row.feature;
        
        if (!featureMap.has(key)) {
          featureMap.set(key, {
            totalSessionsWith: 0,
            totalSessionsWithout: 0,
            satisfactionWithSum: 0,
            satisfactionWithCount: 0,
            satisfactionWithoutSum: 0,
            satisfactionWithoutCount: 0,
            journeys: new Set(),
          });
        }

        const stats = featureMap.get(key)!;
        stats.totalSessionsWith += row.sessions_with_feature || 0;
        stats.totalSessionsWithout += row.sessions_without_feature || 0;
        
        if (row.avg_satisfaction_with != null) {
          stats.satisfactionWithSum += row.avg_satisfaction_with * (row.sessions_with_feature || 0);
          stats.satisfactionWithCount += row.sessions_with_feature || 0;
        }
        
        if (row.avg_satisfaction_without != null) {
          stats.satisfactionWithoutSum += row.avg_satisfaction_without * (row.sessions_without_feature || 0);
          stats.satisfactionWithoutCount += row.sessions_without_feature || 0;
        }
        
        if (row.journey) {
          stats.journeys.add(row.journey);
        }
      });

      // Calculate weighted averages and deltas
      const calculatedDrivers = Array.from(featureMap.entries())
        .map(([feature, stats]) => {
          const avgWith = stats.satisfactionWithCount > 0
            ? stats.satisfactionWithSum / stats.satisfactionWithCount
            : 0;

          const avgWithout = stats.satisfactionWithoutCount > 0
            ? stats.satisfactionWithoutSum / stats.satisfactionWithoutCount
            : 0;

          const delta = avgWith - avgWithout;

          return {
            feature,
            usageCount: stats.totalSessionsWith,
            avgWith,
            avgWithout,
            delta,
            journeys: Array.from(stats.journeys),
          };
        })
        .filter((d) => d.usageCount >= 1 && d.avgWith > 0)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

      setDrivers(calculatedDrivers);

      // Extract unique journeys from drivers
      const journeysSet = new Set<string>();
      calculatedDrivers.forEach((d) => {
        d.journeys.forEach(j => journeysSet.add(j));
      });
      setAllJourneys(Array.from(journeysSet).sort());

      // Query minimal event data for session/event counts (for display only)
      const { data: eventCounts } = await supabase
        .from('events')
        .select('session_id, event', { count: 'exact' })
        .eq('project_id', id)
        .gte('created_at', periodStart.toISOString());

      const withSession = eventCounts?.filter(e => e.session_id !== null) || [];
      const withoutSession = eventCounts?.filter(e => e.session_id === null) || [];

      setEventsWithSession(withSession as EventData[]);
      setEventsWithoutSession(withoutSession as EventData[]);

      // Create minimal session data for avgSatisfaction calculation
      const sessions = new Map<string, SessionData>();
      withSession.forEach((e) => {
        if (e.session_id && !sessions.has(e.session_id)) {
          sessions.set(e.session_id, { features: new Set() });
        }
      });
      setSessionData(sessions);

      setLoading(false);
    };

    fetchData();
  }, [id, period]);

  // Apply filters
  const filteredDrivers = drivers.filter((d) => {
    // Filter by journey
    if (selectedJourney !== 'all' && !d.journeys.includes(selectedJourney)) {
      return false;
    }
    
    // Filter by minimum sessions
    if (d.usageCount < minSessions) {
      return false;
    }
    
    // Filter by type
    if (!showPositive && d.delta > 0.1) return false;
    if (!showNegative && d.delta < -0.1) return false;
    if (!showNeutral && Math.abs(d.delta) <= 0.1) return false;
    
    return true;
  });

  const positiveDrivers = filteredDrivers.filter((d) => d.delta > 0.1);
  const negativeDrivers = filteredDrivers.filter((d) => d.delta < -0.1);
  const neutralDrivers = filteredDrivers.filter((d) => Math.abs(d.delta) <= 0.1);
  const hasData = drivers.length > 0;
  const hasSignificantData = positiveDrivers.length > 0 || negativeDrivers.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <LoadingSpinner size="lg" text="Loading insights..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Insights & Drivers</h2>
        <p className="text-muted-foreground">
          Discover what drives user satisfaction
        </p>
      </div>

      {/* Filters */}
      {hasData && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Top Row: Journey + Period + Min Sessions */}
              <div className="flex flex-wrap items-end gap-3">
                {/* Journey Filter */}
                {allJourneys.length > 0 && (
                  <div className="flex-1 min-w-[200px] max-w-xs">
                    <label className="block text-sm font-medium mb-2">
                      Journey
                    </label>
                    <select
                      value={selectedJourney}
                      onChange={(e) => setSelectedJourney(e.target.value)}
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      <option value="all">All Journeys</option>
                      {allJourneys.map((journey) => (
                        <option key={journey} value={journey}>
                          {journey}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Period Filter */}
                <PeriodFilter value={period} onChange={setPeriod} />

                {/* Min Sessions Filter */}
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
              </div>

              {/* Bottom Row: Driver Type Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={showPositive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowPositive(!showPositive)}
                  className={showPositive ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Positive ({positiveDrivers.length})
                </Button>
                <Button
                  variant={showNegative ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setShowNegative(!showNegative)}
                >
                  <TrendingDown className="h-4 w-4 mr-2" />
                  Negative ({negativeDrivers.length})
                </Button>
                <Button
                  variant={showNeutral ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setShowNeutral(!showNeutral)}
                  className={showNeutral ? "bg-gray-500 hover:bg-gray-600" : ""}
                >
                  <Minus className="h-4 w-4 mr-2" />
                  Neutral ({neutralDrivers.length})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights Digest - Crystal Clear Summary */}
      {hasSignificantData && (
        <InsightsDigest
          positiveDrivers={positiveDrivers}
          negativeDrivers={negativeDrivers}
          totalSessions={sessionData?.size || 0}
          totalEvents={eventsWithSession.length}
          avgSatisfaction={
            (() => {
              // Calculate global satisfaction from ALL sessions with satisfaction (not average of drivers)
              const satisfactionScores: number[] = [];
              sessionData?.forEach((data: { features: Set<string>; satisfaction?: number; journey?: string }) => {
                if (data.satisfaction !== undefined) {
                  // Normalize each score
                  const scale = detectScaleFromValue(data.satisfaction);
                  const normalized = normalizeRating(data.satisfaction, scale);
                  satisfactionScores.push(normalized);
                }
              });
              
              return satisfactionScores.length > 0
                ? satisfactionScores.reduce((sum, v) => sum + v, 0) / satisfactionScores.length
                : 0;
            })()
          }
        />
      )}

      {/* Session ID Warning */}
      {eventsWithoutSession.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Events without session_id detected</strong>
            <br />
            {eventsWithoutSession.length} out of {eventsWithSession.length + eventsWithoutSession.length} events don&apos;t have a sessionId.
            Correlations require sessionIds to work.
          </AlertDescription>
        </Alert>
      )}

      {/* No Data State */}
      {!hasData && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Lightbulb className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No Correlation Data Yet
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Track features and satisfaction <strong>in the same session</strong> to see insights
            </p>
            <pre className="rounded-md bg-muted p-4 text-xs max-w-md">
{`// SDK auto-generates sessionId
init({
  projectKey: 'YOUR_KEY',
  apiKey: 'YOUR_SUPABASE_ANON_KEY',
  apiBaseUrl: 'https://YOUR_PROJECT.supabase.co/functions/v1'
});

track({ event: 'FEATURE_USED', feature: 'help_tooltip' });
track({ event: 'JOURNEY_SATISFACTION', value: 5 });`}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Insufficient Data Warning */}
      {hasData && !hasSignificantData && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Insufficient data for correlations</strong>
            <br />
            {drivers.length} features detected, but no significant correlations.
            <br />
            <strong>Why?</strong> All sessions have similar features and satisfaction scores.
            <br />
            <strong>Need:</strong> Sessions with varied features and satisfaction (1-5)
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Stats */}
      {hasSignificantData && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Positive Drivers</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{positiveDrivers.length}</div>
              <p className="text-xs text-muted-foreground">
                Features that boost satisfaction
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Negative Drivers</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{negativeDrivers.length}</div>
              <p className="text-xs text-muted-foreground">
                Features that reduce satisfaction
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sessions Analyzed</CardTitle>
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sessionData?.size || 0}</div>
              <p className="text-xs text-muted-foreground">
                {eventsWithSession.length} events total
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Analysis Section */}
      {hasSignificantData && (
        <div id="detailed-analysis" className="scroll-mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Feature Impact Analysis</CardTitle>
              <CardDescription>
                See how features correlate with user satisfaction (normalized to 100)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Positive Drivers Chart */}
              {positiveDrivers.length > 0 && (
                <div>
                  <h3 className="mb-4 text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Positive Impact
                  </h3>
                  <div className="space-y-4">
                    {positiveDrivers.slice(0, 5).map((driver, index) => (
                      <div key={driver.feature} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '⭐'}
                            </Badge>
                            <span className="font-medium">{driver.feature}</span>
                            {driver.journeys.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {driver.journeys[0]}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-bold">
                            +{driver.delta.toFixed(0)}%
                          </span>
                        </div>
                        
                        {/* Comparison Bar Chart */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="w-28 text-right text-xs text-muted-foreground">With:</div>
                            <div className="flex-1">
                              <div className="h-8 overflow-hidden rounded-md bg-muted">
                                <div
                                  className="flex h-full items-center justify-end bg-green-600 px-3 text-xs font-medium text-white"
                                  style={{ width: `${driver.avgWith}%` }}
                                >
                                  {driver.avgWith.toFixed(0)}%
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="w-28 text-right text-xs text-muted-foreground">Without:</div>
                            <div className="flex-1">
                              <div className="h-8 overflow-hidden rounded-md bg-muted">
                                <div
                                  className="flex h-full items-center justify-end bg-gray-400 px-3 text-xs font-medium text-white"
                                  style={{ width: `${driver.avgWithout}%` }}
                                >
                                  {driver.avgWithout.toFixed(0)}%
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-xs text-muted-foreground">
                          {driver.usageCount} sessions
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Negative Drivers Chart */}
              {negativeDrivers.length > 0 && (
                <div className="pt-6 border-t">
                  <h3 className="mb-4 text-sm font-semibold flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    Negative Impact
                  </h3>
                  <div className="space-y-4">
                    {negativeDrivers.slice(0, 5).map((driver) => (
                      <div key={driver.feature} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">⚠️</Badge>
                            <span className="font-medium">{driver.feature}</span>
                            {driver.journeys.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {driver.journeys[0]}
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-bold text-destructive">
                            {driver.delta.toFixed(0)}%
                          </span>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="w-28 text-right text-xs text-muted-foreground">With:</div>
                            <div className="flex-1">
                              <div className="h-8 overflow-hidden rounded-md bg-muted">
                                <div
                                  className="flex h-full items-center justify-end bg-red-600 px-3 text-xs font-medium text-white"
                                  style={{ width: `${driver.avgWith}%` }}
                                >
                                  {driver.avgWith.toFixed(0)}%
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="w-28 text-right text-xs text-muted-foreground">Without:</div>
                            <div className="flex-1">
                              <div className="h-8 overflow-hidden rounded-md bg-muted">
                                <div
                                  className="flex h-full items-center justify-end bg-gray-400 px-3 text-xs font-medium text-white"
                                  style={{ width: `${driver.avgWithout}%` }}
                                >
                                  {driver.avgWithout.toFixed(0)}%
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-xs text-muted-foreground">
                          {driver.usageCount} sessions
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delta Distribution Chart */}
      {hasSignificantData && drivers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Impact Distribution</CardTitle>
            <CardDescription>
              Visual comparison of feature impacts on satisfaction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {drivers.slice(0, 10).map((driver) => {
                const isPositive = driver.delta > 0.1;
                const isNegative = driver.delta < -0.1;
                const maxDelta = Math.max(...drivers.map(d => Math.abs(d.delta)), 1);
                const barWidth = (Math.abs(driver.delta) / maxDelta) * 100;
                
                return (
                  <div key={driver.feature} className="flex items-center group hover:bg-muted/50 rounded-lg p-2 -m-2">
                    <div className="w-40 truncate text-sm font-medium">
                      {driver.feature}
                    </div>
                    <div className="flex-1">
                      <div className="flex h-8 items-center">
                        {driver.delta < 0 && (
                          <div className="flex-1 text-right pr-3">
                            <div
                              className="ml-auto h-6 rounded-l-md bg-red-600"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        )}
                        <div className="w-0.5 bg-border h-8"></div>
                        {driver.delta > 0 && (
                          <div className="flex-1 pl-3">
                            <div
                              className="h-6 rounded-r-md bg-green-600"
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={`w-20 text-right text-sm font-bold ${
                      isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-muted-foreground'
                    }`}>
                      {driver.delta > 0 ? '+' : ''}{driver.delta.toFixed(0)}%
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Neutral Features (if any) */}
      {neutralDrivers.length > 0 && !hasSignificantData && (
        <Card>
          <CardHeader>
            <CardTitle>Tracked Features (Neutral Impact)</CardTitle>
            <CardDescription>
              Features with minimal correlation to satisfaction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {neutralDrivers.map((driver) => (
                <div
                  key={driver.feature}
                  className="flex items-center justify-between rounded-lg border bg-card p-3"
                >
                  <div>
                    <div className="font-medium">{driver.feature}</div>
                    <div className="text-xs text-muted-foreground">{driver.usageCount} sessions</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      Δ {driver.delta.toFixed(0)}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {driver.avgWith.toFixed(0)}% vs {driver.avgWithout.toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
