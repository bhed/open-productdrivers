/**
 * Workspace Settings Page
 * Manage workspace name, invite users, and switch between workspaces
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Users,
  Plus,
  Check,
  X,
  Loader2,
  Mail,
  Trash2,
  AlertCircle,
  Building2,
} from 'lucide-react';

interface WorkspaceMember {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

export default function WorkspaceSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [userWorkspaces, setUserWorkspaces] = useState<Workspace[]>([]);
  
  // Invite dialog
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadWorkspaceData = async () => {
    setLoading(true);
    const supabase = createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    // Get user's current workspace (from first project)
    const { data: projects } = await supabase
      .from('projects')
      .select('workspace_id, workspaces(id, name, created_at)')
      .eq('created_by', user.id)
      .limit(1);

    if (projects && projects.length > 0 && projects[0].workspaces) {
      const workspace = (Array.isArray(projects[0].workspaces) ? projects[0].workspaces[0] : projects[0].workspaces) as Workspace;
      setCurrentWorkspace(workspace);
      setWorkspaceName(workspace.name || '');

      // Load members (mock for now - needs workspace_members table)
      setMembers([
        {
          id: user.id,
          email: user.email || '',
          role: 'owner',
          joined_at: new Date().toISOString(),
        },
      ]);
    }

    // Get all user's workspaces
    const { data: allProjects } = await supabase
      .from('projects')
      .select('workspace_id, workspaces(id, name, created_at)')
      .eq('created_by', user.id);

    if (allProjects) {
      const uniqueWorkspaces = Array.from(
        new Map(
          allProjects
            .filter((p) => p.workspaces)
            .map((p) => [p.workspace_id, (Array.isArray(p.workspaces) ? p.workspaces[0] : p.workspaces) as Workspace])
        ).values()
      );
      setUserWorkspaces(uniqueWorkspaces);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadWorkspaceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save workspace name with debounce
  const saveWorkspaceName = useCallback(async (name: string) => {
    if (!currentWorkspace) return;

    setSaveStatus('saving');
    const supabase = createClient();

    const { error } = await supabase
      .from('workspaces')
      .update({ name })
      .eq('id', currentWorkspace.id);

    if (!error) {
      setCurrentWorkspace({ ...currentWorkspace, name });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
      setSaveStatus('idle');
      console.error('Error updating workspace name:', error);
    }
  }, [currentWorkspace]);

  // Debounced save for workspace name
  useEffect(() => {
    if (!currentWorkspace) return;
    
    const timeout = setTimeout(() => {
      if (workspaceName !== currentWorkspace.name && workspaceName.trim()) {
        saveWorkspaceName(workspaceName);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [workspaceName, currentWorkspace, saveWorkspaceName]);

  const handleInviteUser = async () => {
    if (!inviteEmail.trim() || !currentWorkspace) return;

    setInviting(true);
    setInviteResult(null);

    // Mock invite (needs workspace_members table + invite system)
    setTimeout(() => {
      setInviteResult({
        type: 'success',
        message: `Invitation sent to ${inviteEmail}`,
      });
      setInviteEmail('');
      setInviting(false);

      // Reload members
      setTimeout(() => {
        setInviteDialogOpen(false);
        setInviteResult(null);
      }, 2000);
    }, 1000);
  };

  const handleSwitchWorkspace = async (workspaceId: string) => {
    // Switching workspace would require updating user session/context
    // For now, just refresh to the new workspace's first project
    const supabase = createClient();
    
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
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Workspace Settings</h2>
        <p className="text-muted-foreground">
          Manage your workspace, invite team members, and switch between workspaces
        </p>
      </div>

      {/* Save Status Indicator */}
      {saveStatus !== 'idle' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {saveStatus === 'saving' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-green-600">Saved</span>
            </>
          )}
        </div>
      )}

      {/* Workspace Name */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Workspace Name
          </CardTitle>
          <CardDescription>
            Choose a name for your workspace (visible to all members, auto-saved)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="My Company"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Members
              </CardTitle>
              <CardDescription>
                Invite team members to collaborate on your workspace
              </CardDescription>
            </div>
            <Button onClick={() => setInviteDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-medium">{member.email}</div>
                    <div className="text-xs text-muted-foreground">
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                    {member.role}
                  </Badge>
                  {member.role !== 'owner' && (
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Switch Workspace */}
      {userWorkspaces.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Switch Workspace</CardTitle>
            <CardDescription>
              You have access to {userWorkspaces.length} workspaces
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {userWorkspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => handleSwitchWorkspace(workspace.id)}
                  className={`w-full flex items-center justify-between rounded-lg border p-4 text-left transition-colors hover:bg-muted ${
                    workspace.id === currentWorkspace?.id
                      ? 'border-primary bg-primary/5'
                      : ''
                  }`}
                >
                  <div>
                    <div className="font-medium">{workspace.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(workspace.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {workspace.id === currentWorkspace?.id && (
                    <Badge>Current</Badge>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feature Notice */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          <strong>Note:</strong> Full workspace management (invitations, roles, permissions) requires additional database tables. 
          This is a simplified implementation. See{' '}
          <code className="bg-muted px-1 rounded">CONTRIBUTING.md</code> for full workspace schema.
        </AlertDescription>
      </Alert>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join your workspace
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Email Address</label>
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={inviting}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                disabled={inviting}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="member">Member (View & Edit Projects)</option>
                <option value="admin">Admin (Manage Workspace)</option>
              </select>
            </div>

            {inviteResult && (
              <Alert variant={inviteResult.type === 'error' ? 'destructive' : 'default'}>
                {inviteResult.type === 'success' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                <AlertDescription>{inviteResult.message}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteDialogOpen(false)}
              disabled={inviting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleInviteUser}
              disabled={inviting || !inviteEmail.trim()}
            >
              {inviting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

