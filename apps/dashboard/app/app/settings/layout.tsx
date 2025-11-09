/**
 * Settings Layout with Tabs
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Building2 } from 'lucide-react';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { href: '/app/settings/account', label: 'Account', icon: User },
    { href: '/app/settings/workspace', label: 'Workspace', icon: Building2 },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="px-8 py-6">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account and workspace settings
          </p>
        </div>

        {/* Tabs */}
        <div className="px-8">
          <nav className="flex space-x-1">
            {tabs.map((tab) => {
              const isActive = pathname === tab.href || pathname?.startsWith(tab.href + '/');
              const Icon = tab.icon;
              
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center space-x-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-primary text-foreground bg-background'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-background">
        {children}
      </div>
    </div>
  );
}

