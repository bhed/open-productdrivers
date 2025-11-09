/**
 * Create New Project Page
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Sparkles, Key, Code, Zap } from 'lucide-react';

export default function NewProjectPage() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Call API route (server-side)
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error + (data.details ? `: ${data.details}` : ''));
        setLoading(false);
        return;
      }

      // Redirect to the new project
      router.push(`/app/projects/${data.project.id}/getting-started`);
    } catch (err) {
      console.error('Submit error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <Link 
            href="/app/projects" 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <CardTitle>Create New Project</CardTitle>
            </div>
            <CardDescription>
              Set up analytics for your application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Project Name
                </label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="My Awesome App"
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Choose a descriptive name for your project
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  asChild
                >
                  <Link href="/app/projects">
                    Cancel
                  </Link>
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !name}
                  className="flex-1"
                >
                  {loading ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </form>

            <Card className="border-dashed">
              <CardContent className="pt-6">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  What happens next?
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Key className="h-4 w-4 mt-0.5" />
                    <span>A unique project key will be generated</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Code className="h-4 w-4 mt-0.5" />
                    <span>You&apos;ll get SDK integration instructions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 mt-0.5" />
                    <span>Start tracking events immediately</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

