/**
 * Events Page - Raw event stream
 */

'use client';

import { use, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, Calendar, User } from 'lucide-react';
import { PeriodFilter, filterByPeriod } from '@/components/PeriodFilter';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface EventData {
  id: string;
  event: string;
  name?: string;
  journey?: string;
  step?: string;
  feature?: string;
  value?: number;
  created_at: string;
  session_id?: string;
  user_id?: string;
  user_ref?: string;
  meta?: Record<string, unknown>;
}

export default function EventsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [allEvents, setAllEvents] = useState<EventData[]>([]);
  const [period, setPeriod] = useState<string>('30d');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [journeyFilter, setJourneyFilter] = useState<string>('all');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();

      // Get all events
      const { data } = await supabase
        .from('events')
        .select('id, event, name, journey, step, feature, value, created_at, session_id, user_id, meta')
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      setAllEvents(data || []);
      setLoading(false);
    };

    fetchData();
  }, [id]);

  // Apply filters
  const filteredEvents = allEvents
    .filter((e) => {
      // Period filter
      const periodFiltered = filterByPeriod([e], period);
      if (periodFiltered.length === 0) return false;

      // Event type filter
      if (eventTypeFilter !== 'all' && e.event !== eventTypeFilter) return false;

      // Journey filter
      if (journeyFilter !== 'all' && e.journey !== journeyFilter) return false;

      return true;
    });

  // Get unique event types and journeys for filters
  const uniqueEventTypes = Array.from(new Set(allEvents.map((e) => e.event)));
  const uniqueJourneys = Array.from(new Set(allEvents.map((e) => e.journey).filter(Boolean)));

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" text="Loading events..." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Event Stream</h2>
        <p className="text-muted-foreground">
          Real-time view of all tracked events
        </p>
      </div>

      {/* Filters */}
      {allEvents.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-3">
              {/* Event Type Filter */}
              {uniqueEventTypes.length > 0 && (
                <div className="flex-1 min-w-[200px] max-w-xs">
                  <label className="block text-sm font-medium mb-2">
                    Event Type
                  </label>
                  <select
                    value={eventTypeFilter}
                    onChange={(e) => setEventTypeFilter(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="all">All Events</option>
                    {uniqueEventTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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

              {/* Reset */}
              {(eventTypeFilter !== 'all' || journeyFilter !== 'all' || period !== '30d') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEventTypeFilter('all');
                    setJourneyFilter('all');
                    setPeriod('30d');
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
      {allEvents.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredEvents.length}</div>
              <p className="text-xs text-muted-foreground">
                {filteredEvents.length !== allEvents.length && `of ${allEvents.length} total`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Users</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(filteredEvents.map(e => e.user_ref).filter(Boolean)).size}
              </div>
              <p className="text-xs text-muted-foreground">
                Tracked in this period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Event Types</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(filteredEvents.map(e => e.event)).size}
              </div>
              <p className="text-xs text-muted-foreground">
                Different event types
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Event List */}
      {filteredEvents.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredEvents.slice(0, 100).map((event) => (
                <div key={event.id} className="flex items-center justify-between p-4 hover:bg-muted/50">
                  <div className="flex items-center gap-4 flex-1">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">
                          {event.event === 'CUSTOM' && event.name 
                            ? `CUSTOM: ${event.name}` 
                            : event.event}
                        </Badge>
                        {event.event === 'USER_BEHAVIOR' && event.meta?.behaviorType ? (
                          <Badge variant="outline" className="bg-amber-50">
                            {String(event.meta.behaviorType)}
                          </Badge>
                        ) : null}
                        {event.journey && (
                          <span className="text-sm text-muted-foreground">
                            {event.journey}
                            {event.step && ` → ${event.step}`}
                          </span>
                        )}
                        {event.feature && (
                          <Badge variant="secondary">{event.feature}</Badge>
                        )}
                        {event.value !== null && event.value !== undefined && (
                          <Badge>{event.value}</Badge>
                        )}
                      </div>
                      {event.user_ref && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          {event.user_ref}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                    <Calendar className="h-3 w-3" />
                    {new Date(event.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
            {filteredEvents.length > 100 && (
              <div className="p-4 text-center text-sm text-muted-foreground border-t">
                Showing first 100 of {filteredEvents.length} events
              </div>
            )}
          </CardContent>
        </Card>
      ) : allEvents.length > 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <h3 className="text-sm font-medium mb-2">
              No events match your filters
            </h3>
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No events yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Start tracking events with the SDK to see them here
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
