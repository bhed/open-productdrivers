/**
 * App Overview Page
 */

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, Users, Activity, Plus } from 'lucide-react';
import {
  detectScaleFromValue,
  calculateNormalizedAverage,
  type EventWithScale,
} from '@/lib/satisfaction-scales';

export default async function OverviewPage() {
  const supabase = await createClient();

  // Get user's projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id');

  const projectIds = projects?.map(p => p.id) || [];

  // Get total events count
  const { count: eventsCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .in('project_id', projectIds.length > 0 ? projectIds : ['']);

  // Get active users (last 30 days) - using session_id OR user_id if available
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentEvents } = await supabase
    .from('events')
    .select('user_id, session_id')
    .in('project_id', projectIds.length > 0 ? projectIds : [''])
    .gte('created_at', thirtyDaysAgo.toISOString());

  // Count unique users (prefer user_id, fallback to session_id)
  const uniqueUsers = new Set(
    (recentEvents || [])
      .map(e => e.user_id || e.session_id)
      .filter(Boolean)
  );
  const activeUsersCount = uniqueUsers.size;

  // Get satisfaction events
  const { data: satisfactionEvents } = await supabase
    .from('events')
    .select('value')
    .in('project_id', projectIds.length > 0 ? projectIds : [''])
    .eq('event', 'JOURNEY_SATISFACTION')
    .not('value', 'is', null);

  // Calculate normalized average satisfaction
  const eventsWithScale: EventWithScale[] = (satisfactionEvents || []).map((e) => ({
    value: e.value || 0,
    detectedScale: detectScaleFromValue(e.value || 0),
  }));

  const avgSatisfaction = eventsWithScale.length > 0
    ? calculateNormalizedAverage(eventsWithScale)
    : null;

  return (
    <div className="flex flex-col gap-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s what&apos;s happening with your analytics.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active analytics projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Events Tracked</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {eventsCount ? eventsCount.toLocaleString() : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeUsersCount}</div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Satisfaction</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgSatisfaction ? `${avgSatisfaction.toFixed(0)}%` : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {avgSatisfaction ? 'Normalized average' : 'No data yet'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Get started with your analytics
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {projects && projects.length > 0 ? (
            <>
              <Link href="/app/projects">
                <Button variant="outline">View All Projects</Button>
              </Link>
              <Link href="/app/projects/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Project
                </Button>
              </Link>
            </>
          ) : (
            <Link href="/app/projects/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Project
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity (if there are projects) */}
      {projects && projects.length > 0 && eventsCount && eventsCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest events across all projects
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {eventsCount.toLocaleString()} total events tracked
            </p>
            <div className="mt-4">
              <Link href="/app/projects">
                <Button variant="outline" size="sm">
                  View Projects
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
