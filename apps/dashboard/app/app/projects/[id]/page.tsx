/**
 * Project Default Page
 * Redirects to insights if data exists, or getting-started if not
 */

import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';

export default async function ProjectDefaultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Get project
  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (!project) {
    notFound();
  }

  // Check if project has any events
  const { count: totalEvents } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', id);

  // Redirect based on whether project has data
  if (totalEvents && totalEvents > 0) {
    // Project has data -> redirect to insights
    redirect(`/app/projects/${id}/insights`);
  } else {
    // No data yet -> redirect to getting started
    redirect(`/app/projects/${id}/getting-started`);
  }
}

