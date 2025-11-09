/**
 * Project Layout with Tabs Navigation
 */

import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ProjectTabs } from '@/components/ProjectTabs';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Get project
  const { data: project } = await supabase
    .from('projects')
    .select('name, workspaces(name)')
    .eq('id', id)
    .single();

  if (!project) {
    notFound();
  }

  // Type assertion for workspace relation
  const workspace = (Array.isArray(project.workspaces) ? project.workspaces[0] : project.workspaces) as { name: string } | null;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <p className="text-sm text-muted-foreground">{workspace?.name}</p>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <ProjectTabs projectId={id} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-background">
        {children}
      </div>
    </div>
  );
}
