/**
 * Survey Widget Component
 * React component for displaying in-app satisfaction surveys
 * 
 * Usage:
 * import { SurveyWidget } from '@productdrivers/sdk-js';
 * <SurveyWidget projectKey="..." journey="checkout" />
 */

'use client';

import { useState } from 'react';

interface SurveyWidgetProps {
  projectKey: string;
  journey: string;
  apiBaseUrl?: string;
  question?: string;
  scaleMin?: number;
  scaleMax?: number;
  onSubmit?: (score: number, feedback?: string) => void;
  onClose?: () => void;
}

export function SurveyWidget({
  projectKey,
  journey,
  apiBaseUrl = 'https://api.productdrivers.com',
  question = 'How satisfied are you with your experience?',
  scaleMin = 1,
  scaleMax = 10,
  onSubmit,
  onClose,
}: SurveyWidgetProps) {
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (selectedScore === null) return;

    setLoading(true);

    try {
      // Send satisfaction event
      const response = await fetch(`${apiBaseUrl}/v1/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectKey,
          event: 'JOURNEY_SATISFACTION',
          journey,
          value: selectedScore,
          feedback: feedback || undefined,
        }),
      });

      if (response.ok) {
        setSubmitted(true);
        onSubmit?.(selectedScore, feedback);
        
        // Auto-close after 2 seconds
        setTimeout(() => {
          onClose?.();
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to submit survey:', error);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-96 rounded-lg border border-gray-200 bg-white p-6 shadow-xl">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-6 w-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Thank you!</h3>
          <p className="mt-2 text-sm text-gray-600">
            Your feedback helps us improve.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 rounded-lg border border-gray-200 bg-white p-6 shadow-xl">
      <div className="mb-4 flex items-start justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{question}</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Score Selection */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Not satisfied</span>
          <span>Very satisfied</span>
        </div>
        <div className="mt-2 flex gap-2">
          {Array.from({ length: scaleMax - scaleMin + 1 }, (_, i) => i + scaleMin).map(
            (score) => (
              <button
                key={score}
                onClick={() => setSelectedScore(score)}
                className={`flex h-10 w-10 items-center justify-center rounded-lg border-2 font-medium transition-all ${
                  selectedScore === score
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 text-gray-700 hover:border-blue-400'
                }`}
              >
                {score}
              </button>
            )
          )}
        </div>
      </div>

      {/* Optional Feedback */}
      {selectedScore !== null && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Tell us more (optional)
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What could we improve?"
            rows={3}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={selectedScore === null || loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Submit Feedback'}
      </button>
    </div>
  );
}

/**
 * Hook to trigger survey widget programmatically
 */
export function useSurveyWidget() {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return {
    isOpen,
    open,
    close,
  };
}

