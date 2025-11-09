/**
 * Project Tabs Navigation (Client Component)
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Activity, Map, Lightbulb, MessageSquare, Settings, Users } from 'lucide-react';

interface ProjectTabsProps {
  projectId: string;
}

export function ProjectTabs({ projectId }: ProjectTabsProps) {
  const pathname = usePathname();
  
  const tabs = [
    { href: `/app/projects/${projectId}/getting-started`, icon: BookOpen, label: 'Getting Started' },
    { href: `/app/projects/${projectId}/events`, icon: Activity, label: 'Events' },
    { href: `/app/projects/${projectId}/journeys`, icon: Map, label: 'Journeys' },
    { href: `/app/projects/${projectId}/insights`, icon: Lightbulb, label: 'Insights' },
    { href: `/app/projects/${projectId}/feedback`, icon: MessageSquare, label: 'Feedback' },
    { href: `/app/projects/${projectId}/user-behavior`, icon: Users, label: 'User Behavior' },
    { href: `/app/projects/${projectId}/settings`, icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="px-8">
      <nav className="flex space-x-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href || pathname?.startsWith(tab.href + '/');
          
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
  );
}

