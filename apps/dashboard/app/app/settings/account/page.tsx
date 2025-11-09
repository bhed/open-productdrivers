/**
 * Account Settings Page
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, Mail, Key, AlertTriangle } from 'lucide-react';

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex flex-col gap-6 p-8 max-w-4xl">
      {/* Profile Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <CardTitle>Profile</CardTitle>
          </div>
          <CardDescription>
            Your account information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email
            </label>
            <Input
              type="email"
              value={user.email || ''}
              disabled
              className="max-w-md"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Email cannot be changed
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Key className="h-4 w-4" />
              User ID
            </label>
            <code className="block rounded-md bg-muted px-3 py-2 text-sm font-mono max-w-md">
              {user.id}
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </div>
          <CardDescription>
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" disabled>
            Delete Account
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            This action is permanent and cannot be undone
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

