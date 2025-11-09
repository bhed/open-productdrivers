/**
 * Workspace Selector Page
 * Shows after login if user has multiple workspaces
 */

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, ArrowRight, Loader2, Plus } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  created_at: string;
  project_count: number;
}

export default function WorkspaceSelectorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selecting, setSelecting] = useState(false);

  const loadWorkspaces = async () => {
    setLoading(true);
    const supabase = createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    // Get all user's projects and their workspaces
    const { data: projects } = await supabase
      .from('projects')
      .select('workspace_id, workspaces(id, name, created_at)')
      .eq('created_by', user.id);

    if (projects) {
      // Group by workspace and count projects
      const workspaceMap = new Map<string, { workspace: { id: string; name: string; created_at: string }; count: number }>();

      projects.forEach((project) => {
        if (project.workspaces) {
          const ws = (Array.isArray(project.workspaces) ? project.workspaces[0] : project.workspaces) as { id: string; name: string; created_at: string };
          if (!workspaceMap.has(ws.id)) {
            workspaceMap.set(ws.id, { workspace: ws, count: 0 });
          }
          workspaceMap.get(ws.id)!.count++;
        }
      });

      const workspaceList: Workspace[] = Array.from(workspaceMap.values()).map((entry) => ({
        id: entry.workspace.id,
        name: entry.workspace.name,
        created_at: entry.workspace.created_at,
        project_count: entry.count,
      }));

      setWorkspaces(workspaceList);

      // If only one workspace, auto-redirect
      if (workspaceList.length === 1) {
        handleSelectWorkspace(workspaceList[0].id);
        return;
      }

      // If no workspaces, redirect to overview (will create one)
      if (workspaceList.length === 0) {
        router.push('/app');
        return;
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    loadWorkspaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectWorkspace = async (workspaceId: string) => {
    setSelecting(true);
    const supabase = createClient();

    // Get first project in this workspace
    const { data: projects } = await supabase
      .from('projects')
      .select('id')
      .eq('workspace_id', workspaceId)
      .limit(1);

    if (projects && projects.length > 0) {
      router.push(`/app/projects/${projects[0].id}`);
    } else {
      router.push('/app');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-background">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h1 className="text-3xl font-bold mb-2">Select Workspace</h1>
          <p className="text-muted-foreground">
            You have access to {workspaces.length} workspaces
          </p>
        </div>

        <div className="space-y-3">
          {workspaces.map((workspace) => (
            <Card
              key={workspace.id}
              className="cursor-pointer transition-all hover:border-primary hover:shadow-md"
              onClick={() => !selecting && handleSelectWorkspace(workspace.id)}
            >
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{workspace.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {workspace.project_count} {workspace.project_count === 1 ? 'project' : 'projects'}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 text-center">
          <Button
            variant="outline"
            onClick={() => router.push('/app/projects/new')}
            disabled={selecting}
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New Project
          </Button>
        </div>
      </div>
    </div>
  );
}

