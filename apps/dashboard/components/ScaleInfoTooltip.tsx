/**
 * ScaleInfoTooltip Component
 * Displays normalized satisfaction score with original scale breakdown
 */

'use client';

import React from 'react';
import { SCALE_CONFIGS, type ScaleBreakdown } from '@/lib/satisfaction-scales';

interface ScaleInfoTooltipProps {
  normalizedScore: number;
  scaleBreakdown: ScaleBreakdown[];
  className?: string;
}

export function ScaleInfoTooltip({ 
  normalizedScore, 
  scaleBreakdown, 
  className = '' 
}: ScaleInfoTooltipProps) {
  // Determine color based on normalized score
  const getScoreColor = (score: number): string => {
    if (score >= 70) return 'emerald';
    if (score >= 50) return 'amber';
    return 'rose';
  };

  const scoreColor = getScoreColor(normalizedScore);
  
  const colorClasses: Record<string, {
    bg: string;
    border: string;
    text: string;
    badge: string;
  }> = {
    emerald: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-900',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    },
    amber: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-900',
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    rose: {
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      text: 'text-rose-900',
      badge: 'bg-rose-100 text-rose-800 border-rose-300',
    },
  };

  const colors = colorClasses[scoreColor] || colorClasses.rose;
  const isMixed = scaleBreakdown.length > 1;

  return (
    <div className={`rounded-lg border-2 ${colors.border} ${colors.bg} p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className={`text-sm font-bold ${colors.text}`}>
            Satisfaction Score
          </h4>
          <p className="text-xs text-gray-600 mt-0.5">
            {isMixed ? 'Normalized across scales' : 'Consistent scale'}
          </p>
        </div>
        <div className={`text-3xl font-bold ${colors.text}`}>
          {normalizedScore.toFixed(0)}%
        </div>
      </div>

      {/* Scale Breakdown */}
      {scaleBreakdown.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Original Scales
          </p>
          {scaleBreakdown.map((breakdown, index) => {
            const scaleConfig = SCALE_CONFIGS[breakdown.scale];
            return (
              <div key={index} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded border font-medium ${colors.badge}`}>
                    {scaleConfig.description}
                  </span>
                  <span className="text-gray-600">
                    {breakdown.count} rating{breakdown.count !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">
                    {breakdown.avgOriginal.toFixed(1)}
                  </span>
                  <span className="text-gray-500">
                    / {scaleConfig.max}
                  </span>
                  <span className="text-gray-400">
                    →
                  </span>
                  <span className={`font-semibold ${colors.text}`}>
                    {breakdown.avgNormalized.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      {isMixed && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-600">
            <span className="font-semibold">💡 Normalization:</span> Different rating scales
            are converted to a 0-100% range for accurate comparison.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for inline display
 */
interface ScaleInfoBadgeProps {
  normalizedScore: number;
  scaleBreakdown: ScaleBreakdown[];
  onClick?: () => void;
}

export function ScaleInfoBadge({ 
  normalizedScore, 
  scaleBreakdown, 
  onClick 
}: ScaleInfoBadgeProps) {
  const getScoreColor = (score: number): string => {
    if (score >= 70) return 'emerald';
    if (score >= 50) return 'amber';
    return 'rose';
  };

  const scoreColor = getScoreColor(normalizedScore);
  const isMixed = scaleBreakdown.length > 1;
  
  const colorClass = 
    scoreColor === 'emerald' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
    scoreColor === 'amber' ? 'bg-amber-100 text-amber-800 border-amber-300' :
    'bg-rose-100 text-rose-800 border-rose-300';

  const title = isMixed
    ? `Normalized from ${scaleBreakdown.map(b => {
        const config = SCALE_CONFIGS[b.scale];
        return `${b.count}× ${config.description}`;
      }).join(', ')}`
    : `Based on ${scaleBreakdown[0]?.count || 0} ratings`;

  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border font-semibold text-xs ${colorClass} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}`}
    >
      <span>{normalizedScore.toFixed(0)}%</span>
      {isMixed && (
        <span className="text-[10px] opacity-75">*</span>
      )}
    </button>
  );
}

