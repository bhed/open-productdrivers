/**
 * Feedback Page - User satisfaction and feedback
 */

'use client';

import { use, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MessageSquare, Star, Info } from 'lucide-react';
import { PeriodFilter, filterByPeriod } from '@/components/PeriodFilter';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  detectScaleFromValue,
  calculateNormalizedAverage,
  SCALE_CONFIGS,
  type EventWithScale,
} from '@/lib/satisfaction-scales';

interface FeedbackEvent {
  id: string;
  journey?: string;
  value: number;
  created_at: string;
  meta?: Record<string, unknown>;
  session_id?: string;
  user_id?: string;
  user_ref?: string;
}

export default function FeedbackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [feedbackEvents, setFeedbackEvents] = useState<FeedbackEvent[]>([]);
  const [period, setPeriod] = useState<string>('30d');
  const [journeyFilter, setJourneyFilter] = useState<string>('all');
  const [minScore, setMinScore] = useState<number>(1);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();

      // Get all satisfaction events
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('project_id', id)
        .eq('event', 'JOURNEY_SATISFACTION')
        .order('created_at', { ascending: false });

      setFeedbackEvents(data || []);
      setLoading(false);
    };

    fetchData();
  }, [id]);

  // Apply filters
  const filteredEvents = feedbackEvents
    .filter((e) => {
      // Period filter
      const periodFiltered = filterByPeriod([e], period);
      if (periodFiltered.length === 0) return false;

      // Journey filter
      if (journeyFilter !== 'all' && e.journey !== journeyFilter) return false;

      // Min score filter (normalized)
      const scaleType = detectScaleFromValue(e.value || 0);
      const scaleConfig = SCALE_CONFIGS[scaleType];
      const normalized = ((e.value || 0) / scaleConfig.max) * 100;
      if (normalized < (minScore / 5) * 100) return false;

      return true;
    });

  // Calculate normalized average satisfaction
  const eventsWithScale: EventWithScale[] = filteredEvents.map((e) => ({
    value: e.value || 0,
    detectedScale: detectScaleFromValue(e.value || 0),
  }));
  
  const avgSatisfactionNormalized = eventsWithScale.length > 0
    ? calculateNormalizedAverage(eventsWithScale)
    : 0;

  // Get unique journeys for filter
  const uniqueJourneys = Array.from(new Set(feedbackEvents.map((e) => e.journey).filter(Boolean)));

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" text="Loading feedback..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">User Feedback</h2>
        <p className="text-muted-foreground">
          Satisfaction scores and user feedback
        </p>
      </div>

      {/* Filters */}
      {feedbackEvents.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-3">
              {/* Journey Filter */}
              {uniqueJourneys.length > 0 && (
                <div className="flex-1 min-w-[200px] max-w-xs">
                  <label className="block text-sm font-medium mb-2">
                    Journey
                  </label>
                  <select
                    value={journeyFilter}
                    onChange={(e) => setJourneyFilter(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="all">All Journeys</option>
                    {uniqueJourneys.map((journey) => (
                      <option key={journey} value={journey}>
                        {journey}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Period Filter */}
              <PeriodFilter value={period} onChange={setPeriod} />

              {/* Min Score Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Min Score
                </label>
                <select
                  value={minScore}
                  onChange={(e) => setMinScore(parseInt(e.target.value))}
                  className="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="1">All (≥1)</option>
                  <option value="2">≥2</option>
                  <option value="3">≥3</option>
                  <option value="4">≥4</option>
                  <option value="5">Perfect (5)</option>
                </select>
              </div>

              {/* Reset */}
              {(journeyFilter !== 'all' || period !== '30d' || minScore !== 1) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setJourneyFilter('all');
                    setPeriod('30d');
                    setMinScore(1);
                  }}
                >
                  Reset Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgSatisfactionNormalized > 0 ? `${avgSatisfactionNormalized.toFixed(0)}%` : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              Normalized across scales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredEvents.length}</div>
            <p className="text-xs text-muted-foreground">
              {filteredEvents.length !== feedbackEvents.length && `of ${feedbackEvents.length} total`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium">Positive Rate</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-2">
                      <p className="font-semibold">How we calculate this:</p>
                      <p className="text-xs">
                        All scores are normalized to 0-100% regardless of the original scale:
                      </p>
                      <ul className="text-xs list-disc pl-4 space-y-1">
                        <li><strong>Binary (0-1):</strong> 1 = 100%</li>
                        <li><strong>3-point (1-3):</strong> 3 = 100%, 2 = 66%, 1 = 33%</li>
                        <li><strong>5-star (1-5):</strong> 5 = 100%, 4 = 80%, etc.</li>
                        <li><strong>NPS (0-10):</strong> 9-10 = Promoters (100%), 7-8 = Passives (50%), 0-6 = Detractors (0%)</li>
                      </ul>
                      <p className="text-xs">
                        <strong>Positive Rate</strong> = % of responses with normalized score ≥80% (equivalent to 4/5 stars)
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredEvents.length > 0
                ? `${Math.round((eventsWithScale.filter(e => {
                    const scaleConfig = SCALE_CONFIGS[e.detectedScale];
                    const normalized = (e.value / scaleConfig.max) * 100;
                    return normalized >= 80; // 80% = 4/5 on 5-point scale
                  }).length / eventsWithScale.length) * 100)}%`
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              Score ≥80%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Feedback List */}
      {filteredEvents.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent Feedback</CardTitle>
            <CardDescription>Latest satisfaction ratings from users</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredEvents.slice(0, 50).map((feedback) => {
                const scaleType = detectScaleFromValue(feedback.value || 0);
                const scaleConfig = SCALE_CONFIGS[scaleType];
                const normalized = ((feedback.value || 0) / scaleConfig.max) * 100;
                
                return (
                  <div key={feedback.id} className="p-4 hover:bg-muted/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          normalized >= 80 ? 'default' : 
                          normalized >= 60 ? 'secondary' : 
                          'destructive'
                        }>
                          {normalized.toFixed(0)}%
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ({feedback.value}/{scaleConfig.max})
                        </span>
                        {feedback.journey && (
                          <span className="text-sm text-muted-foreground">
                            {feedback.journey}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(feedback.created_at).toLocaleString()}
                      </span>
                    </div>
                    {feedback.user_ref && (
                      <p className="text-xs text-muted-foreground">
                        User: {feedback.user_ref}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {filteredEvents.length > 50 && (
              <div className="p-4 text-center text-sm text-muted-foreground border-t">
                Showing first 50 of {filteredEvents.length} responses
              </div>
            )}
          </CardContent>
        </Card>
      ) : feedbackEvents.length > 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <h3 className="text-sm font-medium mb-2">
              No feedback matches your filters
            </h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No feedback yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Track satisfaction scores to see feedback here
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
