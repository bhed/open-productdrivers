/**
 * Onboarding Assistant
 * Interactive guide that checks SDK installation progress
 */

'use client';

import { useEffect, useState } from 'react';

interface OnboardingStep {
  id: string;
  title: string;
  status: 'pending' | 'checking' | 'complete' | 'error';
  description?: string;
}

interface OnboardingAssistantProps {
  projectId: string;
  hasEvents: boolean;
  eventCount: number;
}

export function OnboardingAssistant({
  projectId,
  hasEvents,
}: OnboardingAssistantProps) {
  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      id: 'sdk-installed',
      title: 'SDK installed and initialized',
      status: 'pending',
    },
    {
      id: 'first-event',
      title: 'First event received',
      status: 'pending',
    },
    {
      id: 'journey-tracking',
      title: 'Journey tracking active',
      status: 'pending',
    },
    {
      id: 'feature-tracking',
      title: 'Feature tracking active',
      status: 'pending',
    },
  ]);

  const [isExpanded, setIsExpanded] = useState(!hasEvents);

  useEffect(() => {
    // Auto-check progress
    const checkProgress = async () => {
      const response = await fetch(`/api/projects/${projectId}/onboarding-status`);
      if (response.ok) {
        const data = await response.json();
        
        setSteps([
          {
            id: 'sdk-installed',
            title: 'SDK installed and initialized',
            status: data.hasEvents ? 'complete' : 'pending',
            description: data.hasEvents
              ? '✓ SDK is sending events'
              : 'Install the SDK and call init() with your project key',
          },
          {
            id: 'first-event',
            title: 'First event received',
            status: data.hasEvents ? 'complete' : 'pending',
            description: data.hasEvents
              ? `✓ Received ${data.eventCount} events`
              : 'Send a track() event from your app',
          },
          {
            id: 'journey-tracking',
            title: 'Journey tracking active',
            status: data.hasJourneyEvents ? 'complete' : 'pending',
            description: data.hasJourneyEvents
              ? `✓ Tracking ${data.journeyCount} journeys`
              : 'Track journey steps with STEP_VIEW events',
          },
          {
            id: 'feature-tracking',
            title: 'Feature tracking active',
            status: data.hasFeatureEvents ? 'complete' : 'pending',
            description: data.hasFeatureEvents
              ? `✓ Tracking ${data.featureCount} features`
              : 'Track features with FEATURE_USED events',
          },
        ]);
      }
    };

    checkProgress();
    const interval = setInterval(checkProgress, 5000); // Check every 5s

    return () => clearInterval(interval);
  }, [projectId]);

  const completedCount = steps.filter((s) => s.status === 'complete').length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50"
      >
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
            <span className="text-xl">🚀</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Setup Assistant</h3>
            <p className="text-sm text-gray-500">
              {completedCount}/{steps.length} steps complete
            </p>
          </div>
        </div>
        <svg
          className={`h-5 w-5 text-gray-400 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Progress Bar */}
      <div className="px-4">
        <div className="h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      {isExpanded && (
        <div className="space-y-3 p-4">
          {steps.map((step) => (
            <div key={step.id} className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                {step.status === 'complete' ? (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
                    <svg
                      className="h-4 w-4 text-green-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                ) : step.status === 'checking' ? (
                  <div className="flex h-6 w-6 items-center justify-center">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  </div>
                ) : (
                  <div className="h-6 w-6 rounded-full border-2 border-gray-300" />
                )}
              </div>
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    step.status === 'complete'
                      ? 'text-gray-900'
                      : 'text-gray-500'
                  }`}
                >
                  {step.title}
                </p>
                {step.description && (
                  <p className="mt-1 text-xs text-gray-500">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      {isExpanded && completedCount < steps.length && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <a
            href={`/app/projects/${projectId}/events`}
            className="block text-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            View live event stream →
          </a>
        </div>
      )}

      {/* Success */}
      {isExpanded && completedCount === steps.length && (
        <div className="border-t border-gray-200 bg-green-50 p-4">
          <p className="text-center text-sm font-medium text-green-800">
            🎉 All set! Check out the Journeys tab to see your analytics.
          </p>
        </div>
      )}
    </div>
  );
}

