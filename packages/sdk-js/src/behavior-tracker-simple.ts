/**
 * Simplified Automatic Behavior Tracker
 * Tracks user behaviors as standard events
 */

import { EventType } from '@productdrivers/core';

export interface BehaviorTrackerConfig {
  enableRageClicks?: boolean;
  enableDeadClicks?: boolean;
  enableScrollTracking?: boolean;
  enableTimeTracking?: boolean;
  rageClickThreshold?: number;
  timeTrackingInterval?: number;
}

interface BehaviorEventPayload {
  event: EventType;
  behaviorType: string;
  elementSelector?: string;
  elementText?: string;
  pageUrl?: string;
  value?: number;
  meta?: Record<string, unknown>;
}

export class BehaviorTracker {
  private config: Required<BehaviorTrackerConfig>;
  private track: (payload: BehaviorEventPayload) => void;
  
  // State
  private clickTimes: number[] = [];
  private lastClickTarget: string = '';
  private scrollDepthReported: Set<number> = new Set();
  private pageLoadTime: number = Date.now();
  private lastActivityTime: number = Date.now();
  private timeTrackingTimer?: NodeJS.Timeout;

  constructor(
    config: BehaviorTrackerConfig,
    trackFn: (payload: BehaviorEventPayload) => void
  ) {
    this.config = {
      enableRageClicks: config.enableRageClicks ?? true,
      enableDeadClicks: config.enableDeadClicks ?? true,
      enableScrollTracking: config.enableScrollTracking ?? true,
      enableTimeTracking: config.enableTimeTracking ?? true,
      rageClickThreshold: config.rageClickThreshold ?? 3,
      timeTrackingInterval: config.timeTrackingInterval ?? 15000,
    };
    
    this.track = trackFn;
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    // Rage clicks & Dead clicks
    if (this.config.enableRageClicks || this.config.enableDeadClicks) {
      document.addEventListener('click', this.handleClick);
    }

    // Scroll tracking
    if (this.config.enableScrollTracking) {
      window.addEventListener('scroll', this.handleScroll, { passive: true });
    }

    // Time tracking
    if (this.config.enableTimeTracking) {
      this.startTimeTracking();
      window.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    // Activity tracking
    window.addEventListener('mousemove', this.updateActivity);
    window.addEventListener('keydown', this.updateActivity);
  }

  private handleClick = (e: MouseEvent) => {
    const now = Date.now();
    const target = e.target as HTMLElement;
    const targetStr = this.getElementIdentifier(target);

    // Rage click detection
    if (this.config.enableRageClicks) {
      this.clickTimes.push(now);
      this.clickTimes = this.clickTimes.filter(t => now - t < 1000); // Keep last 1s

      if (this.clickTimes.length >= this.config.rageClickThreshold) {
        this.track({
          event: EventType.USER_BEHAVIOR,
          behaviorType: 'rage_click',
          elementSelector: targetStr,
          pageUrl: window.location.pathname,
          value: this.clickTimes.length,
          meta: {
            x: e.clientX,
            y: e.clientY,
          },
        });
        this.clickTimes = []; // Reset after tracking
      }
    }

    // Dead click detection (clicks on non-interactive elements)
    if (this.config.enableDeadClicks) {
      const isInteractive = target.tagName === 'A' || 
                            target.tagName === 'BUTTON' ||
                            target.onclick !== null ||
                            target.getAttribute('role') === 'button' ||
                            target.hasAttribute('data-clickable');

      if (!isInteractive) {
        this.track({
          event: EventType.USER_BEHAVIOR,
          behaviorType: 'dead_click',
          elementSelector: targetStr,
          elementText: target.textContent?.trim().substring(0, 50),
          pageUrl: window.location.pathname,
          meta: {
            tagName: target.tagName,
            x: e.clientX,
            y: e.clientY,
          },
        });
      }
    }

    this.updateActivity();
  };

  private handleScroll = () => {
    if (!this.config.enableScrollTracking) return;

    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;

    // Track at 25%, 50%, 75%, 100%
    [25, 50, 75, 100].forEach(threshold => {
      if (scrollPercent >= threshold && !this.scrollDepthReported.has(threshold)) {
        this.scrollDepthReported.add(threshold);
        this.track({
          event: EventType.USER_BEHAVIOR,
          behaviorType: 'scroll_depth',
          pageUrl: window.location.pathname,
          value: threshold,
        });
      }
    });

    this.updateActivity();
  };

  private handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      this.trackTimeSpent();
    } else {
      this.pageLoadTime = Date.now();
      this.startTimeTracking();
    }
  };

  private startTimeTracking() {
    if (this.timeTrackingTimer) {
      clearInterval(this.timeTrackingTimer);
    }

    this.timeTrackingTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        this.trackTimeSpent();
        this.pageLoadTime = Date.now(); // Reset for next interval
      }
    }, this.config.timeTrackingInterval);
  }

  private trackTimeSpent() {
    const timeSpent = Date.now() - this.pageLoadTime;
    const timeSpentSeconds = Math.round(timeSpent / 1000);

    if (timeSpentSeconds > 0) {
      this.track({
        event: EventType.USER_BEHAVIOR,
        behaviorType: 'time_spent',
        pageUrl: window.location.pathname,
        value: timeSpentSeconds,
      });
    }
  }

  private updateActivity = () => {
    this.lastActivityTime = Date.now();
  };

  private getElementIdentifier(element: HTMLElement): string {
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ')[0]}`;
    return element.tagName.toLowerCase();
  }

  public destroy() {
    if (typeof window === 'undefined') return;

    document.removeEventListener('click', this.handleClick);
    window.removeEventListener('scroll', this.handleScroll);
    window.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('mousemove', this.updateActivity);
    window.removeEventListener('keydown', this.updateActivity);

    if (this.timeTrackingTimer) {
      clearInterval(this.timeTrackingTimer);
    }
  }
}

