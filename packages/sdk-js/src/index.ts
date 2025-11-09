/**
 * @productdrivers/sdk-js
 * JavaScript/TypeScript SDK for ProductDrivers analytics
 * 
 * Features:
 * - Auto session management
 * - Event batching & queueing
 * - Offline support with localStorage
 * - Retry logic with exponential backoff
 * - Type-safe API
 */

import type {
  TrackPayload,
  IdentifyPayload,
  JourneyEventPayload,
  FeatureEventPayload,
  SatisfactionEventPayload,
  CustomEventPayload,
  UserBehaviorEventPayload,
} from '@productdrivers/core';
import {
  SDK_DEFAULTS,
  API_ENDPOINTS,
  DEFAULT_API_BASE_URL,
} from '@productdrivers/core';

interface SDKConfig {
  /** Your ProductDrivers project key (starts with pk_) */
  projectKey: string;

  /**
   * Your Supabase anonymous key (REQUIRED)
   *
   * Get it from: Supabase Dashboard → Settings → API → Project API keys → anon public
   * This is safe to expose in frontend code and is used for Edge Function authentication.
   */
  apiKey: string;

  /** Your Supabase Edge Functions URL (e.g., https://xxx.supabase.co/functions/v1) */
  apiBaseUrl?: string;

  /** Max events before auto-flush (default: 50) */
  maxBatchSize?: number;

  /** Max time (ms) before auto-flush (default: 30000) */
  maxBatchWaitMs?: number;

  /** Max retry attempts for failed requests (default: 3) */
  maxRetries?: number;

  /** Enable debug logging (default: false) */
  debug?: boolean;

  /** Enable PII detection and blocking (default: false) */
  blockPII?: boolean;
}

interface QueuedEvent {
  payload: Omit<TrackPayload, 'projectKey'>;
  retryCount: number;
  timestamp: number;
}

/**
 * PII Detection Patterns
 */
const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
};

/**
 * Check if a value contains PII
 */
function containsPII(value: unknown): boolean {
  if (typeof value !== 'string') {
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => containsPII(v));
    }
    return false;
  }

  // Check against all PII patterns
  for (const pattern of Object.values(PII_PATTERNS)) {
    if (pattern.test(value)) {
      return true;
    }
  }

  return false;
}

/**
 * Scan an object for PII
 */
function scanForPII(obj: unknown, path: string = ''): string[] {
  const violations: string[] = [];

  if (typeof obj === 'string') {
    if (containsPII(obj)) {
      violations.push(path || 'value');
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      violations.push(...scanForPII(item, `${path}[${index}]`));
    });
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      const newPath = path ? `${path}.${key}` : key;
      violations.push(...scanForPII(value, newPath));
    }
  }

  return violations;
}

/**
 * ProductDrivers SDK Client
 */
class ProductDriversClient {
  private projectKey: string;
  private apiKey: string;
  private apiBaseUrl: string;
  private maxBatchSize: number;
  private maxBatchWaitMs: number;
  private maxRetries: number;
  private debug: boolean;
  private blockPII: boolean;
  
  private sessionId: string | null = null;
  private eventQueue: QueuedEvent[] = [];
  private flushTimer: number | null = null;
  private isFlushing = false;
  private isInitialized = false;

  constructor(config: SDKConfig) {
    // Validate required fields
    if (!config.projectKey) {
      throw new Error(
        '[ProductDrivers] projectKey is required. Get it from ProductDrivers Dashboard → Your Project → Getting Started'
      );
    }

    if (!config.apiKey) {
      throw new Error(
        '[ProductDrivers] apiKey is required. ' +
        'Get your Supabase anonymous key from: Supabase Dashboard → Settings → API → Project API keys → anon public. ' +
        'This key is safe to expose in frontend code and is used for Edge Function authentication.'
      );
    }

    this.projectKey = config.projectKey;
    this.apiKey = config.apiKey;
    this.apiBaseUrl = config.apiBaseUrl || DEFAULT_API_BASE_URL;
    this.maxBatchSize = config.maxBatchSize || SDK_DEFAULTS.MAX_BATCH_SIZE;
    this.maxBatchWaitMs = config.maxBatchWaitMs || SDK_DEFAULTS.MAX_BATCH_WAIT_MS;
    this.maxRetries = config.maxRetries || SDK_DEFAULTS.MAX_RETRIES;
    this.debug = config.debug || false;
    this.blockPII = config.blockPII || false;
  }

  /**
   * Initialize the SDK
   * Loads session ID and queued events from storage
   */
  public init(): void {
    if (this.isInitialized) {
      this.log('SDK already initialized');
      return;
    }

    // Load or create session ID
    this.sessionId = this.getOrCreateSessionId();
    
    // Load queued events from storage
    this.loadQueueFromStorage();
    
    // Setup auto-flush timer
    this.scheduleFlush();
    
    // Setup beforeunload handler to flush on page close
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flush();
      });
    }

    this.isInitialized = true;
    this.log('SDK initialized', { sessionId: this.sessionId });
  }

  /**
   * Track an event
   */
  public track(payload: Omit<TrackPayload, 'projectKey' | 'sessionId'>): void {
    if (!this.isInitialized) {
      console.warn('[ProductDrivers] SDK not initialized. Call init() first.');
      return;
    }

    // Check for PII if blockPII is enabled
    if (this.blockPII) {
      const violations = scanForPII(payload);
      if (violations.length > 0) {
        console.error(
          `[ProductDrivers] Event blocked: PII detected in fields: ${violations.join(', ')}. ` +
          'Remove sensitive data or disable blockPII option.'
        );
        if (this.debug) {
          console.warn('[ProductDrivers] Blocked payload:', payload);
        }
        return;
      }
    }

    // Add to queue with session ID and timestamp
    const queuedEvent: QueuedEvent = {
      payload: {
        ...payload,
        sessionId: this.sessionId!,
        ts: payload.ts || Date.now(),
      },
      retryCount: 0,
      timestamp: Date.now(),
    };

    this.eventQueue.push(queuedEvent);
    this.saveQueueToStorage();
    
    this.log('Event queued', payload);

    // Flush if batch size reached
    if (this.eventQueue.length >= this.maxBatchSize) {
      this.flush();
    }
  }

  /**
   * Identify a user (link session to user ID)
   */
  public identify(userId: string, traits?: Record<string, unknown>): void {
    if (!this.isInitialized) {
      console.warn('[ProductDrivers] SDK not initialized. Call init() first.');
      return;
    }

    // Check for PII in traits if blockPII is enabled
    if (this.blockPII && traits) {
      const violations = scanForPII(traits);
      if (violations.length > 0) {
        console.error(
          `[ProductDrivers] Identify blocked: PII detected in traits: ${violations.join(', ')}. ` +
          'Remove sensitive data or disable blockPII option.'
        );
        if (this.debug) {
          console.warn('[ProductDrivers] Blocked traits:', traits);
        }
        return;
      }
    }

    const payload: Omit<IdentifyPayload, 'projectKey'> = {
      userId,
      sessionId: this.sessionId!,
      traits,
    };

    this.sendIdentify(payload);
    this.log('Identify called', { userId });
  }

  /**
   * Manually flush queued events
   */
  public async flush(): Promise<void> {
    if (this.isFlushing || this.eventQueue.length === 0) {
      return;
    }

    this.isFlushing = true;
    this.log('Flushing events', { count: this.eventQueue.length });

    // Take events from queue
    const eventsToSend = this.eventQueue.splice(0, this.maxBatchSize);
    this.saveQueueToStorage();

    try {
      const response = await this.sendBatch(eventsToSend);
      
      if (response.success) {
        this.log('Batch sent successfully', { count: eventsToSend.length });
      } else {
        // Put events back in queue for retry
        this.requeueEvents(eventsToSend);
      }
    } catch (error) {
      this.log('Batch send failed', error);
      // Put events back in queue for retry
      this.requeueEvents(eventsToSend);
    } finally {
      this.isFlushing = false;
      
      // Reschedule flush if more events in queue
      if (this.eventQueue.length > 0) {
        this.scheduleFlush();
      }
    }
  }

  /**
   * Get or create session ID
   */
  private getOrCreateSessionId(): string {
    if (typeof window === 'undefined' || !window.localStorage) {
      // Fallback for non-browser environments
      return this.generateUUID();
    }

    const stored = localStorage.getItem(SDK_DEFAULTS.SESSION_STORAGE_KEY);
    if (stored) {
      return stored;
    }

    const newSessionId = this.generateUUID();
    localStorage.setItem(SDK_DEFAULTS.SESSION_STORAGE_KEY, newSessionId);
    return newSessionId;
  }

  /**
   * Load queued events from localStorage
   */
  private loadQueueFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      const stored = localStorage.getItem(SDK_DEFAULTS.QUEUE_STORAGE_KEY);
      if (stored) {
        this.eventQueue = JSON.parse(stored);
        this.log('Loaded queued events from storage', { count: this.eventQueue.length });
      }
    } catch (error) {
      this.log('Failed to load queue from storage', error);
    }
  }

  /**
   * Save queued events to localStorage
   */
  private saveQueueToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    try {
      localStorage.setItem(SDK_DEFAULTS.QUEUE_STORAGE_KEY, JSON.stringify(this.eventQueue));
    } catch (error) {
      this.log('Failed to save queue to storage', error);
    }
  }

  /**
   * Send batch of events to API
   */
  private async sendBatch(events: QueuedEvent[]): Promise<{ success: boolean }> {
    const url = `${this.apiBaseUrl}${API_ENDPOINTS.TRACK}`;
    
    const payload = {
      projectKey: this.projectKey,
      events: events.map(e => e.payload),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Send identify request
   */
  private async sendIdentify(payload: Omit<IdentifyPayload, 'projectKey'>): Promise<void> {
    const url = `${this.apiBaseUrl}${API_ENDPOINTS.IDENTIFY}`;
    
    const fullPayload = {
      projectKey: this.projectKey,
      ...payload,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(fullPayload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      this.log('Identify sent successfully');
    } catch (error) {
      this.log('Identify failed', error);
      // Silent failure - not critical
    }
  }

  /**
   * Requeue failed events (with retry limit)
   */
  private requeueEvents(events: QueuedEvent[]): void {
    for (const event of events) {
      if (event.retryCount < this.maxRetries) {
        event.retryCount++;
        this.eventQueue.unshift(event);
      } else {
        this.log('Event dropped after max retries', event);
      }
    }
    this.saveQueueToStorage();
  }

  /**
   * Schedule automatic flush
   */
  private scheduleFlush(): void {
    if (this.flushTimer !== null) {
      return;
    }

    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, this.maxBatchWaitMs);
  }

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    
    // Fallback UUID generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Debug logging
   */
  private log(message: string, data?: unknown): void {
    if (this.debug) {
      console.log(`[ProductDrivers] ${message}`, data || '');
    }
  }
}

/**
 * Global SDK instance
 */
let sdkInstance: ProductDriversClient | null = null;

/**
 * Initialize the SDK
 */
export function init(config: SDKConfig): void {
  sdkInstance = new ProductDriversClient(config);
  sdkInstance.init();
}

/**
 * Track an event
 */
export function track(payload: Omit<TrackPayload, 'projectKey' | 'sessionId'>): void {
  if (!sdkInstance) {
    console.error('[ProductDrivers] SDK not initialized. Call init() first.');
    return;
  }
  sdkInstance.track(payload);
}

/**
 * Identify a user
 */
export function identify(userId: string, traits?: Record<string, unknown>): void {
  if (!sdkInstance) {
    console.error('[ProductDrivers] SDK not initialized. Call init() first.');
    return;
  }
  sdkInstance.identify(userId, traits);
}

/**
 * Manually flush queued events
 */
export function flush(): Promise<void> {
  if (!sdkInstance) {
    console.error('[ProductDrivers] SDK not initialized. Call init() first.');
    return Promise.resolve();
  }
  return sdkInstance.flush();
}

/**
 * Export types for consumers
 */
export type {
  SDKConfig,
  TrackPayload,
  IdentifyPayload,
  JourneyEventPayload,
  FeatureEventPayload,
  SatisfactionEventPayload,
  CustomEventPayload,
  UserBehaviorEventPayload,
};

/**
 * Export EventType enum
 */
export { EventType } from '@productdrivers/core';

