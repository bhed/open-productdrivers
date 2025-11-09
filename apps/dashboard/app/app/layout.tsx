/**
 * App Layout with Sidebar Navigation
 * Shadcn-styled elegant dark theme
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogOut, BarChart3, LayoutDashboard, Settings } from 'lucide-react';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card">
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-14 items-center border-b px-6">
            <Link href="/app" className="flex items-center space-x-2">
              <div className="h-6 w-6 rounded-md bg-primary"></div>
              <span className="font-bold">ProductDrivers</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-3">
            <NavLink href="/app" icon={<LayoutDashboard className="h-4 w-4" />}>
              Overview
            </NavLink>
            <NavLink href="/app/projects" icon={<BarChart3 className="h-4 w-4" />}>
              Projects
            </NavLink>
            
            <div className="my-3 border-t"></div>
            
            <NavLink href="/app/settings" icon={<Settings className="h-4 w-4" />}>
              Settings
            </NavLink>
          </nav>

          {/* User */}
          <div className="border-t p-3">
            <div className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-accent">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <span className="text-xs font-medium">
                    {user.email?.[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {user.email}
                  </p>
                </div>
              </div>
              <form action="/api/auth/signout" method="post">
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

function NavLink({ 
  href, 
  icon, 
  children 
}: { 
  href: string; 
  icon: React.ReactNode; 
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}

