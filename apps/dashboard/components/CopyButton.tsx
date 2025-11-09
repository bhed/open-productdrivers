/**
 * Copy Button Component
 * Client-side button to copy text to clipboard
 */

'use client';

import { useState } from 'react';

interface CopyButtonProps {
  text: string;
  label?: string;
}

export function CopyButton({ text, label = '📋 Copy' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="rounded bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
    >
      {copied ? '✓ Copied!' : label}
    </button>
  );
}

