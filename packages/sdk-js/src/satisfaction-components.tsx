/**
 * Pre-built React components for satisfaction tracking
 * Ready-to-use UI components with different rating scales
 */

import React, { useState } from 'react';

interface SatisfactionProps {
  journey: string;
  onRate: (value: number, feedback?: string) => void;
  showFeedback?: boolean;
}

/**
 * Binary Like/Dislike Component
 * Scale: 1-2 (dislike=1, like=2)
 */
export function BinaryRating({ journey, onRate }: SatisfactionProps) {
  const [selected, setSelected] = useState<number | null>(null);

  const handleRate = (value: number) => {
    setSelected(value);
    onRate(value);
  };

  return (
    <div className="flex flex-col items-center space-y-4 p-6">
      <p className="text-center font-medium text-gray-900">
        How was your experience with {journey}?
      </p>
      <div className="flex space-x-4">
        <button
          onClick={() => handleRate(2)}
          className={`flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all ${
            selected === 2
              ? 'border-green-500 bg-green-100'
              : 'border-gray-300 hover:border-green-400'
          }`}
        >
          <span className="text-3xl">👍</span>
        </button>
        <button
          onClick={() => handleRate(1)}
          className={`flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all ${
            selected === 1
              ? 'border-red-500 bg-red-100'
              : 'border-gray-300 hover:border-red-400'
          }`}
        >
          <span className="text-3xl">👎</span>
        </button>
      </div>
    </div>
  );
}

/**
 * 3-Point Sentiment Component
 * Scale: 1-3 (unhappy=1, neutral=2, happy=3)
 */
export function SentimentRating({ journey, onRate }: SatisfactionProps) {
  const [selected, setSelected] = useState<number | null>(null);

  const sentiments = [
    { value: 1, emoji: '😞', label: 'Unhappy', color: 'red' },
    { value: 2, emoji: '😐', label: 'Neutral', color: 'yellow' },
    { value: 3, emoji: '😊', label: 'Happy', color: 'green' },
  ];

  const handleRate = (value: number) => {
    setSelected(value);
    onRate(value);
  };

  return (
    <div className="flex flex-col items-center space-y-4 p-6">
      <p className="text-center font-medium text-gray-900">
        How do you feel about {journey}?
      </p>
      <div className="flex space-x-4">
        {sentiments.map(({ value, emoji, label, color }) => (
          <button
            key={value}
            onClick={() => handleRate(value)}
            className={`flex flex-col items-center space-y-2 rounded-lg border-2 p-4 transition-all ${
              selected === value
                ? `border-${color}-500 bg-${color}-100`
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <span className="text-4xl">{emoji}</span>
            <span className="text-xs font-medium text-gray-600">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * 5-Star Rating Component
 * Scale: 1-5 (stars)
 */
export function StarRating({ journey, onRate, showFeedback }: SatisfactionProps) {
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (rating > 0) {
      onRate(rating, showFeedback && feedback ? feedback : undefined);
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center space-y-4 p-6">
        <span className="text-5xl">✅</span>
        <p className="text-center font-medium text-gray-900">
          Thank you for your feedback!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4 p-6">
      <p className="text-center font-medium text-gray-900">
        Rate your experience with {journey}
      </p>
      <div className="flex space-x-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="text-3xl transition-transform hover:scale-110"
          >
            {star <= (hover || rating) ? '⭐' : '☆'}
          </button>
        ))}
      </div>
      {showFeedback && rating > 0 && (
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Tell us more... (optional)"
          className="w-full rounded-lg border border-gray-300 p-3 text-sm"
          rows={3}
        />
      )}
      {rating > 0 && (
        <button
          onClick={handleSubmit}
          className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
        >
          Submit
        </button>
      )}
    </div>
  );
}

/**
 * NPS / 10-Point Scale Component
 * Scale: 1-10 (typical NPS scale)
 */
export function NPSRating({ journey, onRate, showFeedback }: SatisfactionProps) {
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (score !== null) {
      onRate(score, showFeedback && feedback ? feedback : undefined);
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center space-y-4 p-6">
        <span className="text-5xl">✅</span>
        <p className="text-center font-medium text-gray-900">
          Thank you for your feedback!
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4 p-6">
      <p className="text-center font-medium text-gray-900">
        How likely are you to recommend {journey}?
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
          <button
            key={num}
            onClick={() => setScore(num)}
            className={`flex h-12 w-12 items-center justify-center rounded-lg border-2 font-semibold transition-all ${
              score === num
                ? num <= 6
                  ? 'border-red-500 bg-red-100 text-red-700'
                  : num <= 8
                  ? 'border-yellow-500 bg-yellow-100 text-yellow-700'
                  : 'border-green-500 bg-green-100 text-green-700'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            {num}
          </button>
        ))}
      </div>
      <div className="flex w-full justify-between text-xs text-gray-500">
        <span>Not likely</span>
        <span>Very likely</span>
      </div>
      {showFeedback && score !== null && (
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="What's the main reason for your score?"
          className="w-full rounded-lg border border-gray-300 p-3 text-sm"
          rows={3}
        />
      )}
      {score !== null && (
        <button
          onClick={handleSubmit}
          className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700"
        >
          Submit
        </button>
      )}
    </div>
  );
}

/**
 * Usage Example:
 * 
 * import { StarRating } from '@productdrivers/sdk-js/satisfaction-components';
 * import { track, EventType } from '@productdrivers/sdk-js';
 * 
 * function MyComponent() {
 *   return (
 *     <StarRating
 *       journey="checkout"
 *       showFeedback={true}
 *       onRate={(value, feedback) => {
 *         track({
 *           event: EventType.JOURNEY_SATISFACTION,
 *           journey: 'checkout',
 *           value,
 *           feedback
 *         });
 *       }}
 *     />
 *   );
 * }
 */

