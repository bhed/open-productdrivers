/**
 * Onboarding Flow Component
 * Interactive guide for new users
 */

'use client';

import { useState } from 'react';
import { X, Check } from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

export function OnboardingFlow({ projectKey }: { projectKey: string }) {
  const [isOpen, setIsOpen] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);

  const steps: OnboardingStep[] = [
    {
      id: 'install',
      title: 'Install the SDK',
      description: 'Add @productdrivers/sdk-js to your project',
      completed: false,
    },
    {
      id: 'initialize',
      title: 'Initialize productdrivers',
      description: 'Call init() with your project key',
      completed: false,
    },
    {
      id: 'track',
      title: 'Send your first event',
      description: 'Track a journey step or feature usage',
      completed: false,
    },
    {
      id: 'verify',
      title: 'Verify events',
      description: 'Check that events are appearing in your dashboard',
      completed: false,
    },
  ];

  if (!isOpen) return null;

  const step = steps[currentStep];

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 rounded-lg border border-blue-200 bg-blue-50 p-6 shadow-xl">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-blue-900">
            Getting Started
          </h3>
          <p className="text-sm text-blue-700">
            Step {currentStep + 1} of {steps.length}
          </p>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-blue-400 hover:text-blue-600"
        >
          <X size={20} />
        </button>
      </div>

      <div className="mb-4">
        <h4 className="font-medium text-blue-900">{step.title}</h4>
        <p className="mt-1 text-sm text-blue-700">{step.description}</p>
      </div>

      {/* Code Example */}
      {currentStep === 1 && (
        <pre className="mb-4 overflow-x-auto rounded bg-blue-900 p-3 text-xs text-blue-50">
{`import { init } from '@productdrivers/sdk-js';

init({
  projectKey: '${projectKey}',
  apiKey: 'YOUR_SUPABASE_ANON_KEY',
  apiBaseUrl: 'https://YOUR_PROJECT.supabase.co/functions/v1'
});`}
        </pre>
      )}

      {currentStep === 2 && (
        <pre className="mb-4 overflow-x-auto rounded bg-blue-900 p-3 text-xs text-blue-50">
{`import { track } from '@productdrivers/sdk-js';

track({
  event: 'STEP_VIEW',
  journey: 'onboarding',
  step: 'welcome'
});`}
        </pre>
      )}

      {/* Progress Bar */}
      <div className="mb-4 h-2 rounded-full bg-blue-200">
        <div
          className="h-2 rounded-full bg-blue-600 transition-all"
          style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
        ></div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="text-sm text-blue-700 hover:text-blue-900 disabled:opacity-50"
        >
          Previous
        </button>
        {currentStep < steps.length - 1 ? (
          <button
            onClick={() => setCurrentStep(currentStep + 1)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Next
          </button>
        ) : (
          <button
            onClick={() => setIsOpen(false)}
            className="flex items-center space-x-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            <Check size={16} />
            <span>Complete</span>
          </button>
        )}
      </div>
    </div>
  );
}

