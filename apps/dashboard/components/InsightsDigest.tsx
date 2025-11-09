/**
 * Insights Digest Component
 * High-level overview section for quick insights
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Target, Users, Sparkles, ChevronDown } from 'lucide-react';

interface Driver {
  feature: string;
  usageCount: number;
  avgWith: number;
  avgWithout: number;
  delta: number;
  journeys: string[];
}

interface DigestProps {
  positiveDrivers: Driver[];
  negativeDrivers: Driver[];
  totalSessions: number;
  totalEvents: number;
  avgSatisfaction: number;
}

export function InsightsDigest({
  positiveDrivers,
  negativeDrivers,
  totalSessions,
  avgSatisfaction,
}: DigestProps) {
  // Calculate discovery score (0-100)
  const discoveryScore = Math.min(
    100,
    Math.round((positiveDrivers.length * 10 + negativeDrivers.length * 5) / 2)
  );

  const scrollToDetails = () => {
    document.getElementById('detailed-analysis')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      {/* Main Score Card */}
      <Card>
        <CardContent className="pt-8 pb-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Discovery Score */}
            <div className="text-center md:text-left">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-6 w-6" />
                <h2 className="text-lg font-semibold">Discovery Score</h2>
              </div>
              <div className="text-7xl font-bold">
                {discoveryScore}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                out of 100 - {discoveryScore >= 70 ? 'Excellent' : discoveryScore >= 40 ? 'Good' : 'Growing'} insights
              </p>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-4 flex-1">
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Positive</span>
                </div>
                <div className="text-3xl font-bold">
                  {positiveDrivers.length}
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Negative</span>
                </div>
                <div className="text-3xl font-bold">
                  {negativeDrivers.length}
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Sessions</span>
                </div>
                <div className="text-3xl font-bold">
                  {totalSessions}
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Satisfaction</span>
                </div>
                <div className="text-3xl font-bold">
                  {avgSatisfaction.toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Drivers Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Top 3 Positive Drivers */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Top Positive Drivers</h3>
            </div>

            {positiveDrivers.length > 0 ? (
              <div className="space-y-3">
                {positiveDrivers.slice(0, 3).map((driver, index) => (
                  <div
                    key={driver.feature}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                      </div>
                      <div>
                        <div className="font-medium">{driver.feature}</div>
                        <div className="text-xs text-muted-foreground">
                          {driver.usageCount} sessions
                        </div>
                      </div>
                    </div>
                    <Badge>
                      +{driver.delta.toFixed(0)}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No positive drivers found yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Top 3 Negative Drivers */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Top Negative Drivers</h3>
            </div>

            {negativeDrivers.length > 0 ? (
              <div className="space-y-3">
                {negativeDrivers.slice(0, 3).map((driver) => (
                  <div
                    key={driver.feature}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">⚠️</div>
                      <div>
                        <div className="font-medium">{driver.feature}</div>
                        <div className="text-xs text-muted-foreground">
                          {driver.usageCount} sessions
                        </div>
                      </div>
                    </div>
                    <Badge variant="destructive">
                      {driver.delta.toFixed(0)}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No negative drivers found yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Details Button */}
      <div className="flex justify-center">
        <Button
          onClick={scrollToDetails}
          size="lg"
        >
          View Detailed Analysis
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

