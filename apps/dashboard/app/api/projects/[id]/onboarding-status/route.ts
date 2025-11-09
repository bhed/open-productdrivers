/**
 * Onboarding Status API
 * Checks SDK integration progress
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get event counts
    const { count: eventCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', id);

    const { data: journeyEvents } = await supabase
      .from('events')
      .select('journey')
      .eq('project_id', id)
      .not('journey', 'is', null);

    const { data: featureEvents } = await supabase
      .from('events')
      .select('feature')
      .eq('project_id', id)
      .not('feature', 'is', null);

    const uniqueJourneys = new Set(journeyEvents?.map((e) => e.journey) || []);
    const uniqueFeatures = new Set(featureEvents?.map((e) => e.feature) || []);

    return NextResponse.json({
      hasEvents: (eventCount || 0) > 0,
      eventCount: eventCount || 0,
      hasJourneyEvents: uniqueJourneys.size > 0,
      journeyCount: uniqueJourneys.size,
      hasFeatureEvents: uniqueFeatures.size > 0,
      featureCount: uniqueFeatures.size,
    });
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

