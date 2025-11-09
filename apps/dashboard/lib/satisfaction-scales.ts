/**
 * Satisfaction Scale Utilities
 * Handles normalization and conversion between different rating scales
 */

export type ScaleType = 'binary' | '3-point' | '5-star' | 'nps' | 'mixed' | 'unknown';

export interface ScaleConfig {
  type: ScaleType;
  min: number;
  max: number;
  satisfiedThreshold: number;
  description: string;
}

export interface ScaleBreakdown {
  scale: ScaleType;
  count: number;
  avgOriginal: number;
  avgNormalized: number;
}

export interface EventWithScale {
  value: number;
  detectedScale: ScaleType;
}

// Scale definitions with thresholds
export const SCALE_CONFIGS: Record<ScaleType, Omit<ScaleConfig, 'type'>> = {
  binary: {
    min: 0,
    max: 1,
    satisfiedThreshold: 1,
    description: 'Binary (0-1)',
  },
  '3-point': {
    min: 1,
    max: 3,
    satisfiedThreshold: 3,
    description: '3-Point (1-3)',
  },
  '5-star': {
    min: 1,
    max: 5,
    satisfiedThreshold: 4,
    description: '5-Star (1-5)',
  },
  nps: {
    min: 0,
    max: 10,
    satisfiedThreshold: 9,
    description: 'NPS (0-10)',
  },
  mixed: {
    min: 0,
    max: 10,
    satisfiedThreshold: 7,
    description: 'Mixed Scales',
  },
  unknown: {
    min: 0,
    max: 5,
    satisfiedThreshold: 4,
    description: 'Unknown Scale',
  },
};

/**
 * Detect scale type from a single rating value
 */
export function detectScaleFromValue(value: number): ScaleType {
  if (value <= 1) return 'binary';
  if (value <= 3) return '3-point';
  if (value <= 5) return '5-star';
  if (value <= 10) return 'nps';
  return 'unknown';
}

/**
 * Detect scale from array of ratings
 */
export function detectScale(ratings: number[]): ScaleConfig {
  if (!ratings || ratings.length === 0) {
    return { type: 'unknown', ...SCALE_CONFIGS.unknown };
  }

  const min = Math.min(...ratings);
  const max = Math.max(...ratings);
  const uniqueValues = new Set(ratings);

  // Binary: only 0 and 1
  if (max <= 1 && uniqueValues.size <= 2) {
    return { type: 'binary', ...SCALE_CONFIGS.binary };
  }

  // 3-point: 1-3 range
  if (max <= 3 && min >= 1) {
    return { type: '3-point', ...SCALE_CONFIGS['3-point'] };
  }

  // 5-star: 1-5 range
  if (max <= 5 && min >= 1) {
    return { type: '5-star', ...SCALE_CONFIGS['5-star'] };
  }

  // NPS: 0-10 range
  if (max <= 10 && min >= 0) {
    return { type: 'nps', ...SCALE_CONFIGS.nps };
  }

  // Mixed or unknown
  return {
    type: 'mixed',
    min,
    max,
    satisfiedThreshold: Math.ceil(max * 0.7),
    description: `Mixed Scales (${min}-${max})`,
  };
}

/**
 * Normalize any rating to 0-100 percentage based on its scale
 */
export function normalizeRating(value: number, scaleType: ScaleType): number {
  const config = SCALE_CONFIGS[scaleType];
  
  if (!config) return 0;

  // Handle special case for binary
  if (scaleType === 'binary') {
    return value === 1 ? 100 : 0;
  }

  // Handle special case for NPS (Net Promoter Score)
  if (scaleType === 'nps') {
    // NPS uses categories, not linear scale
    if (value >= 9) return 100; // Promoters (9-10)
    if (value >= 7) return 50;  // Passives (7-8)
    return 0;                   // Detractors (0-6)
  }

  // Linear normalization for other scales
  const range = config.max - config.min;
  if (range === 0) return 0;

  const normalized = ((value - config.min) / range) * 100;
  return Math.max(0, Math.min(100, normalized));
}

/**
 * Check if a rating is "satisfied" based on its scale
 */
export function isSatisfied(value: number, scaleType: ScaleType): boolean {
  const config = SCALE_CONFIGS[scaleType];
  return value >= config.satisfiedThreshold;
}

/**
 * Calculate normalized average from events with potentially mixed scales
 */
export function calculateNormalizedAverage(
  events: Array<{ value: number; detectedScale?: ScaleType }>
): number {
  if (!events || events.length === 0) return 0;

  const normalizedValues = events.map((event) => {
    const scale = event.detectedScale || detectScaleFromValue(event.value);
    return normalizeRating(event.value, scale);
  });

  const sum = normalizedValues.reduce((acc, val) => acc + val, 0);
  return sum / normalizedValues.length;
}

/**
 * Format rating for display based on scale
 */
export function formatRating(value: number, scaleType: ScaleType, short: boolean = false): string {
  switch (scaleType) {
    case 'binary':
      return value === 1 ? (short ? '👍' : '👍 Positive') : (short ? '👎' : '👎 Negative');
    case '3-point':
      if (value === 3) return short ? '😊' : '😊 Satisfied';
      if (value === 2) return short ? '😐' : '😐 Neutral';
      return short ? '😞' : '😞 Unsatisfied';
    case '5-star':
      return short ? '⭐'.repeat(value) : `${'⭐'.repeat(value)} (${value}/5)`;
    case 'nps':
      if (value >= 9) return short ? `${value}` : `${value} (Promoter)`;
      if (value >= 7) return short ? `${value}` : `${value} (Passive)`;
      return short ? `${value}` : `${value} (Detractor)`;
    default:
      return value.toString();
  }
}

/**
 * Get color class based on normalized satisfaction percentage
 */
export function getSatisfactionColor(normalizedPercentage: number): string {
  if (normalizedPercentage >= 70) return 'emerald';
  if (normalizedPercentage >= 50) return 'amber';
  return 'rose';
}

/**
 * Get color class based on raw rating and scale
 */
export function getRatingColor(value: number, scaleType: ScaleType): string {
  const normalized = normalizeRating(value, scaleType);
  return getSatisfactionColor(normalized);
}

/**
 * Group events by their detected scale and calculate stats
 */
export function groupByScale(
  events: Array<{ value: number; detectedScale?: ScaleType }>
): ScaleBreakdown[] {
  const scaleGroups = new Map<ScaleType, number[]>();

  events.forEach((event) => {
    const scale = event.detectedScale || detectScaleFromValue(event.value);
    if (!scaleGroups.has(scale)) {
      scaleGroups.set(scale, []);
    }
    scaleGroups.get(scale)!.push(event.value);
  });

  return Array.from(scaleGroups.entries()).map(([scale, values]) => {
    const avgOriginal = values.reduce((sum, v) => sum + v, 0) / values.length;
    const avgNormalized = normalizeRating(avgOriginal, scale);

    return {
      scale,
      count: values.length,
      avgOriginal,
      avgNormalized,
    };
  }).sort((a, b) => b.count - a.count);
}

/**
 * Format scale breakdown for tooltip display
 */
export function formatScaleBreakdown(breakdown: ScaleBreakdown[]): string {
  return breakdown
    .map((b) => {
      const config = SCALE_CONFIGS[b.scale];
      return `${b.count}× ${config.description} (avg: ${b.avgOriginal.toFixed(1)})`;
    })
    .join(', ');
}

/**
 * Detect if a set of events contains mixed scales
 */
export function hasMixedScales(events: Array<{ value: number }>): boolean {
  const scales = new Set(events.map(e => detectScaleFromValue(e.value)));
  return scales.size > 1;
}

/**
 * Get satisfaction status label based on normalized percentage
 */
export function getSatisfactionStatus(normalizedPercentage: number): string {
  if (normalizedPercentage >= 70) return 'High Satisfaction';
  if (normalizedPercentage >= 50) return 'Moderate Satisfaction';
  return 'Low Satisfaction';
}

