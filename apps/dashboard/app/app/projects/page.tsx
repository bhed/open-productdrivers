/**
 * Projects List Page
 * Shadcn-styled elegant UI
 */

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, Key } from 'lucide-react';

export default async function ProjectsPage() {
  const supabase = await createClient();

  // Fetch user's projects
  const { data: projects } = await supabase
    .from('projects')
    .select('*, workspaces(name)')
    .order('created_at', { ascending: false });

  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage your analytics projects
          </p>
        </div>
        <Link href="/app/projects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Projects Grid */}
      {projects && projects.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/app/projects/${project.id}`}
            >
              <Card className="transition-all hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{project.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {project.workspaces?.name}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs">Active</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Key className="h-3 w-3" />
                      Project Key
                    </span>
                    <code className="rounded bg-muted px-2 py-1 text-xs font-mono">
                      {project.project_key.substring(0, 12)}...
                    </code>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Created
                    </span>
                    <span className="text-xs">
                      {new Date(project.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No projects yet</h3>
            <p className="mb-6 text-sm text-muted-foreground text-center max-w-sm">
              Create your first project to start tracking analytics
            </p>
            <Link href="/app/projects/new">
              <Button>Create Project</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

