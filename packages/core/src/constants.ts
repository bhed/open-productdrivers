/**
 * Shared constants for ProductDrivers
 */

/**
 * API endpoints (relative paths)
 * Note: Use /track and /identify because the base URL already includes /v1
 * Example: https://project.supabase.co/functions/v1 + /track = https://project.supabase.co/functions/v1/track
 */
export const API_ENDPOINTS = {
  TRACK: '/track',
  IDENTIFY: '/identify',
} as const;

/**
 * SDK configuration defaults
 */
export const SDK_DEFAULTS = {
  /** Maximum number of events to batch before auto-flush */
  MAX_BATCH_SIZE: 50,
  
  /** Maximum time in milliseconds to wait before auto-flush */
  MAX_BATCH_WAIT_MS: 30000, // 30 seconds
  
  /** Number of retry attempts for failed requests */
  MAX_RETRIES: 3,
  
  /** Base delay in milliseconds for exponential backoff */
  RETRY_BASE_DELAY_MS: 1000,
  
  /** LocalStorage key for session ID */
  SESSION_STORAGE_KEY: 'productdrivers_session',
  
  /** LocalStorage key for queued events */
  QUEUE_STORAGE_KEY: 'productdrivers_queue',
} as const;

/**
 * Default API base URL - MUST be configured by user
 * Set this in your SDK initialization with your Supabase project URL
 * Example: 'https://your-project.supabase.co/functions/v1'
 */
export const DEFAULT_API_BASE_URL = '';

/**
 * Event validation limits
 */
export const LIMITS = {
  /** Maximum length for journey name */
  MAX_JOURNEY_LENGTH: 100,
  
  /** Maximum length for step name */
  MAX_STEP_LENGTH: 100,
  
  /** Maximum length for feature name */
  MAX_FEATURE_LENGTH: 100,
  
  /** Maximum length for feedback text */
  MAX_FEEDBACK_LENGTH: 5000,
  
  /** Maximum number of events in a batch */
  MAX_BATCH_SIZE: 100,
  
  /** Maximum size of meta object in bytes (approximate) */
  MAX_META_SIZE_BYTES: 10000,
} as const;

/**
 * Rate limiting (for backend implementation)
 */
export const RATE_LIMITS = {
  /** Requests per minute per project */
  REQUESTS_PER_MINUTE: 1000,
  
  /** Events per minute per project */
  EVENTS_PER_MINUTE: 10000,
} as const;

