/**
 * Getting Started Page
 * Setup guide for integrating the SDK
 */

import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Code, CheckCircle, Zap, AlertCircle } from 'lucide-react';

interface GettingStartedPageProps {
  params: Promise<{ id: string }>;
}

export default async function GettingStartedPage({ params }: GettingStartedPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from('projects')
    .select('name, project_key, secret_key')
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

  const hasData = totalEvents && totalEvents > 0;

  return (
    <div className="flex flex-col gap-6 p-8 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Getting Started</h2>
        <p className="text-muted-foreground">
          Set up the SDK and start tracking user journeys
        </p>
        <div className="mt-2">
          <a 
            href="https://productdrivers.com/docs" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            📚 View full documentation →
          </a>
        </div>
      </div>

      {/* Status */}
      {hasData ? (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>SDK Connected!</AlertTitle>
          <AlertDescription>
            Your project is receiving events. You can now explore insights and analytics.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Waiting for events</AlertTitle>
          <AlertDescription>
            Follow the setup guide below to integrate the SDK and start tracking.
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            <CardTitle>Quick Start</CardTitle>
          </div>
          <CardDescription>
            Install and initialize the SDK in 3 steps
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge>1</Badge>
              <h3 className="font-semibold">Install the SDK</h3>
            </div>
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Manual Installation Required</AlertTitle>
                <AlertDescription>
                  SDKs are not yet published to package registries. Copy the source files from the repository:
                  <code className="block mt-2 text-xs">packages/sdk-js/</code>
                  <code className="block text-xs">packages/sdk-flutter/</code>
                  <code className="block text-xs">packages/sdk-kotlin/</code>
                </AlertDescription>
              </Alert>
              
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium mb-1">JavaScript / TypeScript</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Copy <code>packages/sdk-js/src/</code> to your project, or:
                  </p>
                  <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                    <code># When published:
npm install @productdrivers/sdk-js</code>
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Flutter</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Copy <code>packages/sdk-flutter/lib/</code> to your project, or:
                  </p>
                  <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                    <code># When published:
flutter pub add productdrivers</code>
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Kotlin (Android)</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Copy <code>packages/sdk-kotlin/src/</code> to your project, or:
                  </p>
                  <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                    <code># When published:
implementation &apos;com.productdrivers:sdk-kotlin:1.0.0&apos;</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge>2</Badge>
              <h3 className="font-semibold">Initialize with your Project Key</h3>
            </div>
            
            {/* Frontend Project Key */}
            <div className="mb-4">
              <p className="text-xs font-medium mb-2 text-muted-foreground">
                Public Key (Frontend - Safe to expose)
              </p>
              <div className="rounded-md bg-muted p-3">
                <div className="flex items-center justify-between">
                  <code className="text-xs font-mono">{project.project_key}</code>
                  <Button variant="outline" size="sm">Copy</Button>
                </div>
              </div>
            </div>

            {/* Backend Secret Key */}
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Server-Side Authentication</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-2">For server-side requests (Node.js, Python, etc.), use your Secret Key for enhanced security with HMAC signatures:</p>
                <div className="rounded-md bg-background p-2 mt-2">
                  <div className="flex items-center justify-between">
                    <code className="text-xs font-mono text-destructive">{project.secret_key}</code>
                    <Button variant="ghost" size="sm">Copy</Button>
                  </div>
                </div>
                <p className="text-xs mt-2 text-destructive font-semibold">
                  ⚠️ NEVER expose this key in frontend code, Git repos, or client-side applications!
                </p>
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <div>
                <p className="text-xs font-medium mb-1">JavaScript</p>
                <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                  <code>{`import { init } from '@productdrivers/sdk-js';

init({
  projectKey: '${project.project_key}',
  apiKey: 'YOUR_SUPABASE_ANON_KEY',  // From Supabase Dashboard
  apiBaseUrl: 'https://YOUR_PROJECT.supabase.co/functions/v1',
  blockPII: true  // Enable PII protection
});`}</code>
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium mb-1">Flutter</p>
                <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                  <code>{`import 'package:productdrivers/productdrivers.dart';

await productdrivers.init(
  projectKey: '${project.project_key}',
  apiKey: 'YOUR_SUPABASE_ANON_KEY',  // From Supabase Dashboard
  apiBaseUrl: 'https://YOUR_PROJECT.supabase.co/functions/v1',
  blockPII: true,
);`}</code>
                </pre>
              </div>
              <div>
                <p className="text-xs font-medium mb-1">Kotlin</p>
                <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                  <code>{`import com.productdrivers.productdrivers

productdrivers.init(
    context = applicationContext,
    projectKey = "${project.project_key}",
    apiKey = "YOUR_SUPABASE_ANON_KEY",  // From Supabase Dashboard
    apiBaseUrl = "https://YOUR_PROJECT.supabase.co/functions/v1",
    blockPII = true
)`}</code>
                </pre>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Badge>3</Badge>
              <h3 className="font-semibold">Track Events</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Start tracking user journeys and features:
            </p>
            <div className="space-y-2">
              <div>
                <p className="text-xs font-medium mb-1">JavaScript</p>
                <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
                  <code>{`import { track } from '@productdrivers/sdk-js';

// Start a journey
track({
  event: 'JOURNEY_START',
  journey: 'onboarding'
});

// Track a step
track({
  event: 'STEP_VIEW',
  journey: 'onboarding',
  step: 'welcome'
});

// Track feature usage
track({
  event: 'FEATURE_USED',
  journey: 'onboarding',
  feature: 'help_tooltip'
});

// Track satisfaction
track({
  event: 'JOURNEY_SATISFACTION',
  journey: 'onboarding',
  value: 5  // 1-5 scale
});`}</code>
                </pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event Types Reference */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            <CardTitle>Event Types</CardTitle>
          </div>
          <CardDescription>
            Available event types and their purposes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-start gap-3">
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded">JOURNEY_START</code>
                <p className="text-sm text-muted-foreground">
                  Mark the beginning of a user journey
                </p>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-start gap-3">
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded">JOURNEY_COMPLETE</code>
                <p className="text-sm text-muted-foreground">
                  Mark the successful completion of a journey
                </p>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-start gap-3">
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded">STEP_VIEW</code>
                <p className="text-sm text-muted-foreground">
                  Track when users view a specific step in a journey
                </p>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-start gap-3">
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded">FEATURE_USED</code>
                <p className="text-sm text-muted-foreground">
                  Track feature usage to understand adoption
                </p>
              </div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-start gap-3">
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded">JOURNEY_SATISFACTION</code>
                <p className="text-sm text-muted-foreground">
                  Collect satisfaction ratings (1-5, 1-10, or 1-100 scales supported)
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Server-Side Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            <CardTitle>Server-Side Integration (Optional)</CardTitle>
          </div>
          <CardDescription>
            For backend applications with enhanced security using HMAC signatures
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle>Why use server-side integration?</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 text-sm mt-2">
                <li>Prevent unauthorized event injection from malicious actors</li>
                <li>Authenticate requests with HMAC-SHA256 signatures</li>
                <li>Protect against replay attacks with timestamp validation</li>
                <li>Ideal for sensitive analytics data from backend systems</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div>
            <p className="text-sm font-medium mb-2">Example: Node.js Server-Side Tracking</p>
            <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
              <code>{`import { signRequest } from '@productdrivers/sdk-js/signature';

// ⚠️ Load secret key from environment variable
const SECRET_KEY = process.env.PRODUCTDRIVERS_SECRET_KEY;

async function trackServerEvent() {
  const payload = {
    projectKey: '${project.project_key}',
    event: 'JOURNEY_COMPLETE',
    journey: 'checkout',
    userId: 'user_12345',
    value: 99.99
  };

  // Sign the request with your secret key
  const signedPayload = await signRequest(SECRET_KEY, payload);

  // Send to ProductDrivers
  const response = await fetch('https://your-project.supabase.co/functions/v1/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signedPayload)
  });

  const result = await response.json();
  console.log('Event tracked:', result.success);
}`}</code>
            </pre>
          </div>

          <div className="rounded-lg border bg-card p-3">
            <p className="text-sm font-medium mb-2">Security Best Practices:</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>Store <code className="text-xs bg-muted px-1 rounded">secret_key</code> in environment variables, never in code</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>Use server-side tracking for sensitive business events (purchases, payments)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>Frontend tracking is still secure for user behavior (clicks, page views)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <span>Rotate your secret key if it&apos;s ever exposed (contact support)</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card>
        <CardHeader>
          <CardTitle>Best Practices</CardTitle>
          <CardDescription>
            Tips for getting the most out of productdrivers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 text-primary" />
              <span>Enable <code className="text-xs bg-muted px-1 rounded">blockPII: true</code> to prevent accidental PII collection</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 text-primary" />
              <span>Use consistent journey and feature names across your app</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 text-primary" />
              <span>Track satisfaction at the end of important journeys</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 text-primary" />
              <span>Use anonymous user IDs (UUIDs) instead of emails or names</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5 text-primary" />
              <span>Leverage the <code className="text-xs bg-muted px-1 rounded">meta</code> field for additional context (non-PII only)</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Next Steps */}
      {hasData && (
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
            <CardDescription>
              You&apos;re all set! Explore your analytics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a href={`/app/projects/${id}/insights`}>View Insights</a>
              </Button>
              <Button variant="outline" asChild>
                <a href={`/app/projects/${id}/journeys`}>Analyze Journeys</a>
              </Button>
              <Button variant="outline" asChild>
                <a href={`/app/projects/${id}/events`}>Browse Events</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documentation Link */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
          <CardDescription>
            Check out our comprehensive documentation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <Button variant="outline" asChild>
              <a href="https://productdrivers.com/docs" target="_blank" rel="noopener noreferrer">
                📚 Full Documentation
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="https://github.com/bhed/open-productdrivers" target="_blank" rel="noopener noreferrer">
                💻 GitHub Repository
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
