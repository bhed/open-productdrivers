/**
 * Project Settings Page
 * Unified settings with tabs for General and Privacy
 */

'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Shield, Download, UserX, UserMinus, AlertTriangle, CheckCircle, Key, Settings as SettingsIcon, Check, Loader2 } from 'lucide-react';

interface SettingsPageProps {
  params: Promise<{ id: string }>;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  project_key: string;
  domain_restriction: string | null;
}

export default function SettingsPage({ params }: SettingsPageProps) {
  const { id } = use(params);
  const [activeTab, setActiveTab] = useState<'general' | 'privacy'>('general');

  // General Tab State
  const [project, setProject] = useState<Project | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [domainRestriction, setDomainRestriction] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Privacy Tab State
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load project data
  useEffect(() => {
    const loadProject = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (data) {
        setProject(data);
        setProjectName(data.name || '');
        setProjectDescription(data.description || '');
        setDomainRestriction(data.domain_restriction || '');
      }
    };

    loadProject();
  }, [id]);

  // Auto-save with debounce
  const saveProject = useCallback(async (field: string, value: string | string[] | null) => {
    setSaveStatus('saving');
    
    const supabase = createClient();
    const { error } = await supabase
      .from('projects')
      .update({ [field]: value })
      .eq('id', id);

    if (!error) {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
      setSaveStatus('idle');
    }
  }, [id]);

  // Debounced save
  useEffect(() => {
    if (!project) return;
    
    const timeout = setTimeout(() => {
      if (projectName !== project.name) {
        saveProject('name', projectName);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [projectName, project, saveProject]);

  useEffect(() => {
    if (!project) return;
    
    const timeout = setTimeout(() => {
      if (projectDescription !== (project.description || '')) {
        saveProject('description', projectDescription);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [projectDescription, project, saveProject]);

  useEffect(() => {
    if (!project) return;
    
    const timeout = setTimeout(() => {
      const currentDomainStr = project.domain_restriction || '';
      
      if (domainRestriction !== currentDomainStr) {
        // Save as single domain (null if empty)
        const trimmedDomain = domainRestriction.trim();
        saveProject('domain_restriction', trimmedDomain || null);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [domainRestriction, project, saveProject]);

  const handleExport = async () => {
    setLoading(true);
    setResult({ type: 'success', message: 'Export functionality to be implemented' });
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      {/* Tabs */}
      <div className="flex space-x-1 border-b">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'general'
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            General
          </div>
        </button>
        <button
          onClick={() => setActiveTab('privacy')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'privacy'
              ? 'border-b-2 border-primary text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Privacy & Data
          </div>
        </button>
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="space-y-6">
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

          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
              <CardDescription>Basic settings for your project (auto-saved)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Project Name</label>
                <Input 
                  placeholder="My Awesome Project" 
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea 
                  placeholder="Optional description" 
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>Manage your API keys and endpoints</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Project Key
                  <Badge variant="outline" className="text-xs">Public</Badge>
                </label>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={project?.project_key || 'Loading...'} 
                    className="font-mono text-sm" 
                  />
                  <Button 
                    variant="outline"
                    onClick={() => {
                      if (project?.project_key) {
                        navigator.clipboard.writeText(project.project_key);
                      }
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Use this key to initialize the SDK in your application
                  </p>
                  <p className="text-xs text-green-600">
                    ✓ Safe to expose in client-side code (frontend, mobile apps)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This key only allows sending events, not reading data
                  </p>
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ Anyone with this key can send events to your project
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <strong>Best practices:</strong> Use <code className="bg-muted px-1 rounded">blockPII</code> option, validate data server-side, 
                    configure domain restrictions below (web apps only), and implement rate limiting if needed.
                  </p>
                  
                  <Alert className="mt-4">
                    <Shield className="h-4 w-4" />
                    <div className="ml-2">
                      <strong className="text-sm">Mobile Apps Security</strong>
                      <p className="text-xs text-muted-foreground mt-1">
                        For maximum security in mobile apps, implement a <strong>server-side proxy</strong>:
                      </p>
                      <ol className="text-xs text-muted-foreground mt-2 ml-4 list-decimal space-y-1">
                        <li>Route SDK calls through YOUR backend (not directly to ProductDrivers)</li>
                        <li>Authenticate users with your auth system (JWT, OAuth, etc.)</li>
                        <li>Validate and sanitize event data server-side</li>
                        <li>Keep the project key secret on your backend</li>
                      </ol>
                      <p className="text-xs mt-2">
                        <a 
                          href="https://github.com/bhed/open-productdrivers/blob/main/MOBILE_SECURITY.md" 
                          target="_blank" 
                          className="underline font-medium"
                        >
                          View complete mobile security guide →
                        </a>
                      </p>
                    </div>
                  </Alert>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Domain Restriction</CardTitle>
              <CardDescription>Control which domain can send events to your project</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Allowed Domain (Optional)
                </label>
                <Input 
                  placeholder="example.com"
                  value={domainRestriction}
                  onChange={(e) => setDomainRestriction(e.target.value)}
                  className="font-mono text-sm"
                />
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Enter a single domain. Leave empty to allow all domains.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <strong>Examples:</strong> <code className="bg-muted px-1 rounded">example.com</code> (allows example.com and all subdomains like www.example.com, app.example.com)
                  </p>
                  <p className="text-xs text-green-600 mt-2">
                    ✓ Subdomains are automatically allowed (e.g., <code className="bg-muted px-1 rounded">example.com</code> allows <code className="bg-muted px-1 rounded">www.example.com</code>)
                  </p>
                  <p className="text-xs text-amber-600">
                    ⚠️ Note: Mobile apps don&apos;t send Origin headers, so this only works for web applications
                  </p>
                  {saveStatus === 'saved' && (
                    <p className="text-xs text-green-600 flex items-center gap-1 mt-2">
                      <Check className="w-3 h-3" /> Saved automatically
                    </p>
                  )}
                  {saveStatus === 'saving' && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive">Delete Project</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Privacy Tab */}
      {activeTab === 'privacy' && (
        <div className="space-y-6">
          {/* GDPR Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <CardTitle>GDPR Compliance</CardTitle>
              </div>
              <CardDescription>
                Tools to manage user data and comply with privacy regulations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border bg-card p-4">
                  <Download className="h-8 w-8 mb-2" />
                  <h3 className="font-semibold mb-1">Right to Access</h3>
                  <p className="text-sm text-muted-foreground">
                    Export all data associated with a user
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <UserMinus className="h-8 w-8 mb-2" />
                  <h3 className="font-semibold mb-1">Right to Anonymize</h3>
                  <p className="text-sm text-muted-foreground">
                    Remove PII while keeping analytics data
                  </p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <UserX className="h-8 w-8 mb-2" />
                  <h3 className="font-semibold mb-1">Right to be Forgotten</h3>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete all user data
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User Data Management */}
          <Card>
            <CardHeader>
              <CardTitle>User Data Management</CardTitle>
              <CardDescription>
                Search for a user by their ID to manage their data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  User ID
                </label>
                <Input
                  type="text"
                  placeholder="e.g., user_123 or email@example.com"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter the user identifier (user_ref) you want to manage
                </p>
              </div>

              {result && (
                <Alert variant={result.type === 'error' ? 'destructive' : 'default'}>
                  {result.type === 'success' ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <AlertTitle>{result.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
                  <AlertDescription>{result.message}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleExport}
                  disabled={loading || !userId.trim()}
                  variant="outline"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </Button>
                <Button
                  onClick={() => {
                    setResult({ type: 'success', message: 'Anonymize functionality to be implemented' });
                  }}
                  disabled={loading || !userId.trim()}
                  variant="outline"
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  Anonymize User
                </Button>
                <Button
                  onClick={() => {
                    setResult({ type: 'success', message: 'Delete functionality to be implemented' });
                  }}
                  disabled={loading || !userId.trim()}
                  variant="destructive"
                >
                  <UserX className="h-4 w-4 mr-2" />
                  Delete User
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Privacy Best Practices */}
          <Card>
            <CardHeader>
              <CardTitle>Privacy Best Practices</CardTitle>
              <CardDescription>Guidelines for handling user data</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5">1</Badge>
                  <span>Use anonymous identifiers (UUIDs) instead of emails or names</span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5">2</Badge>
                  <span>Never send sensitive data in the <code className="text-xs bg-muted px-1 rounded">meta</code> field</span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5">3</Badge>
                  <span>Enable PII blocking in SDK: <code className="text-xs bg-muted px-1 rounded">blockPII: true</code></span>
                </li>
                <li className="flex items-start gap-2">
                  <Badge variant="outline" className="mt-0.5">4</Badge>
                  <span>Respond to data requests within 30 days (GDPR requirement)</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

