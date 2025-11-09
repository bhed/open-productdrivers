/**
 * Period Filter Component
 * Reusable date range filter for analytics pages
 */

'use client';

interface PeriodFilterProps {
  value: string;
  onChange: (period: string) => void;
  className?: string;
}

export function PeriodFilter({ value, onChange, className = '' }: PeriodFilterProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium mb-2">
        Time Period
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-w-[160px]"
      >
        <option value="24h">Last 24 hours</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="90d">Last 90 days</option>
        <option value="all">All time</option>
      </select>
    </div>
  );
}

// Helper function to filter events by period
export function filterByPeriod<T extends { created_at: string }>(
  items: T[],
  period: string
): T[] {
  if (period === 'all') return items;

  const now = new Date();
  const cutoff = new Date();

  switch (period) {
    case '24h':
      cutoff.setHours(now.getHours() - 24);
      break;
    case '7d':
      cutoff.setDate(now.getDate() - 7);
      break;
    case '30d':
      cutoff.setDate(now.getDate() - 30);
      break;
    case '90d':
      cutoff.setDate(now.getDate() - 90);
      break;
    default:
      return items;
  }

  return items.filter((item) => new Date(item.created_at) >= cutoff);
}

