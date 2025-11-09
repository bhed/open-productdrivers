/**
 * Export utility functions
 * CSV and JSON export for analytics data
 */

export interface ExportData {
  headers: string[];
  rows: (string | number | null)[][];
}

/**
 * Convert data to CSV format
 */
export function toCSV(data: ExportData): string {
  const csvRows: string[] = [];
  
  // Add headers
  csvRows.push(data.headers.map(escapeCSVValue).join(','));
  
  // Add data rows
  for (const row of data.rows) {
    csvRows.push(row.map(escapeCSVValue).join(','));
  }
  
  return csvRows.join('\n');
}

/**
 * Escape CSV values
 */
function escapeCSVValue(value: string | number | null): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // Escape quotes and wrap in quotes if necessary
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

/**
 * Download data as CSV file
 */
export function downloadCSV(data: ExportData, filename: string): void {
  const csv = toCSV(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Download data as JSON file
 */
export function downloadJSON<T = unknown>(data: T, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

/**
 * Format driver stats for export
 */
interface DriverStat {
  feature: string;
  journey?: string;
  sessions_with_feature: number;
  sessions_without_feature: number;
  avg_satisfaction_with?: number;
  avg_satisfaction_without?: number;
  satisfaction_delta?: number;
}

export function formatDriverStatsForExport(stats: DriverStat[]): ExportData {
  return {
    headers: [
      'Feature',
      'Journey',
      'Sessions With Feature',
      'Sessions Without Feature',
      'Avg Satisfaction (With)',
      'Avg Satisfaction (Without)',
      'Satisfaction Delta',
    ],
    rows: stats.map(s => [
      s.feature,
      s.journey || 'All',
      s.sessions_with_feature,
      s.sessions_without_feature,
      s.avg_satisfaction_with?.toFixed(2) || 'N/A',
      s.avg_satisfaction_without?.toFixed(2) || 'N/A',
      s.satisfaction_delta?.toFixed(2) || 'N/A',
    ]),
  };
}

/**
 * Format journey stats for export
 */
interface JourneyStat {
  journey: string;
  total_sessions: number;
  completed_sessions: number;
  completion_rate: number;
  avg_satisfaction?: number;
}

export function formatJourneyStatsForExport(stats: JourneyStat[]): ExportData {
  return {
    headers: [
      'Journey',
      'Total Sessions',
      'Completed Sessions',
      'Completion Rate (%)',
      'Avg Satisfaction',
    ],
    rows: stats.map(s => [
      s.journey,
      s.total_sessions,
      s.completed_sessions,
      s.completion_rate,
      s.avg_satisfaction?.toFixed(2) || 'N/A',
    ]),
  };
}

/**
 * Format survey responses for export
 */
interface SurveyResponse {
  created_at: string;
  journey?: string;
  score: number;
  feedback?: string;
  user_id?: string;
  session_id?: string;
}

export function formatSurveyResponsesForExport(responses: SurveyResponse[]): ExportData {
  return {
    headers: [
      'Date',
      'Journey',
      'Score',
      'Feedback',
      'User ID',
      'Session ID',
    ],
    rows: responses.map(r => [
      new Date(r.created_at).toISOString(),
      r.journey || 'N/A',
      r.score,
      r.feedback || '',
      r.user_id || 'Anonymous',
      r.session_id || 'N/A',
    ]),
  };
}

