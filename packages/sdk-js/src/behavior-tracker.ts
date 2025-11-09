/**
 * Automatic Behavior Tracking Module
 * Detects and tracks user behaviors without explicit calls
 */

interface BehaviorEvent {
  behaviorType: string;
  elementSelector?: string;
  elementText?: string;
  value?: number;
  metadata?: Record<string, unknown>;
}

interface TrackerConfig {
  enableRageClickDetection: boolean;
  enableDeadClickDetection: boolean;
  enableScrollTracking: boolean;
  enableFormTracking: boolean;
  enableMouseTracking: boolean;
  enableVisibilityTracking: boolean;
  enableNetworkTracking: boolean;
  rageClickThreshold: number; // clicks in timeWindow
  rageClickTimeWindow: number; // milliseconds
  scrollSampleRate: number; // how often to sample scroll (ms)
  idleTimeout: number; // ms before considering idle
}

export class BehaviorTracker {
  private config: TrackerConfig;
  private onBehavior: (event: BehaviorEvent) => void;
  
  // State tracking
  private clickCounts: Map<string, { count: number; lastClick: number }> = new Map();
  private scrollDepth: number = 0;
  private maxScrollDepth: number = 0;
  private lastScrollTime: number = 0;
  private lastScrollY: number = 0;
  private rapidScrollCount: number = 0;
  private lastActivityTime: number = Date.now();
  private isIdle: boolean = false;
  private tabHiddenCount: number = 0;
  private backButtonCount: number = 0;
  
  // Form tracking
  private formFields: Map<string, {startTime: number; changes: number}> = new Map();
  
  constructor(config: Partial<TrackerConfig>, onBehavior: (event: BehaviorEvent) => void) {
    this.config = {
      enableRageClickDetection: true,
      enableDeadClickDetection: true,
      enableScrollTracking: true,
      enableFormTracking: true,
      enableMouseTracking: false, // Can be expensive
      enableVisibilityTracking: true,
      enableNetworkTracking: true,
      rageClickThreshold: 3,
      rageClickTimeWindow: 1000,
      scrollSampleRate: 500,
      idleTimeout: 30000,
      ...config
    };
    
    this.onBehavior = onBehavior;
    this.init();
  }

  private init() {
    if (this.config.enableRageClickDetection || this.config.enableDeadClickDetection) {
      this.initClickTracking();
    }
    
    if (this.config.enableScrollTracking) {
      this.initScrollTracking();
    }
    
    if (this.config.enableFormTracking) {
      this.initFormTracking();
    }
    
    if (this.config.enableVisibilityTracking) {
      this.initVisibilityTracking();
    }
    
    if (this.config.enableNetworkTracking) {
      this.initNetworkTracking();
    }
    
    this.initIdleTracking();
    this.initNavigationTracking();
  }

  // ============ CLICK TRACKING ============
  
  private initClickTracking() {
    document.addEventListener('click', (e) => {
      this.lastActivityTime = Date.now();
      this.isIdle = false;
      
      const target = e.target as HTMLElement;
      const selector = this.getElementSelector(target);
      const text = target.textContent?.trim().substring(0, 50);
      
      if (this.config.enableRageClickDetection) {
        this.detectRageClick(selector, text);
      }
      
      if (this.config.enableDeadClickDetection) {
        this.detectDeadClick(target, selector, text);
      }
    }, true);
  }

  private detectRageClick(selector: string, text?: string) {
    const now = Date.now();
    const key = selector;
    
    if (!this.clickCounts.has(key)) {
      this.clickCounts.set(key, { count: 0, lastClick: now });
    }
    
    const clickData = this.clickCounts.get(key)!;
    const timeSinceLastClick = now - clickData.lastClick;
    
    if (timeSinceLastClick < this.config.rageClickTimeWindow) {
      clickData.count++;
      
      if (clickData.count >= this.config.rageClickThreshold) {
        this.onBehavior({
          behaviorType: 'rage_click',
          elementSelector: selector,
          elementText: text,
          value: clickData.count,
          metadata: {
            timeSinceFirst: now - (clickData.lastClick - (clickData.count - 1) * 200),
          }
        });
        
        clickData.count = 0; // Reset after detection
      }
    } else {
      clickData.count = 1;
    }
    
    clickData.lastClick = now;
  }

  private detectDeadClick(element: HTMLElement, selector: string, text?: string) {
    // Dead click = click that does nothing (no handler, no navigation)
    const hasClickHandler = element.onclick !== null || 
                           element.hasAttribute('onclick') ||
                           element.getAttribute('role') === 'button';
    
    const isInteractive = element.tagName === 'A' || 
                         element.tagName === 'BUTTON' ||
                         element.tagName === 'INPUT' ||
                         element.tagName === 'SELECT' ||
                         element.tagName === 'TEXTAREA';
    
    if (!hasClickHandler && !isInteractive && element.tagName !== 'BODY' && element.tagName !== 'HTML') {
      // Wait a bit to see if anything happened
      setTimeout(() => {
        this.onBehavior({
          behaviorType: 'dead_click',
          elementSelector: selector,
          elementText: text,
          metadata: {
            tagName: element.tagName,
            className: element.className,
          }
        });
      }, 100);
    }
  }

  // ============ SCROLL TRACKING ============

  private initScrollTracking() {
    let scrollTimeout: ReturnType<typeof setTimeout> | undefined;
    
    window.addEventListener('scroll', () => {
      this.lastActivityTime = Date.now();
      this.isIdle = false;
      
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.trackScroll();
      }, this.config.scrollSampleRate);
    }, { passive: true });
  }

  private trackScroll() {
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    
    const scrollDepth = Math.round((scrollY + windowHeight) / docHeight * 100);
    this.scrollDepth = scrollDepth;
    
    // Track max scroll depth
    if (scrollDepth > this.maxScrollDepth) {
      this.maxScrollDepth = scrollDepth;
      
      // Report milestones
      if (scrollDepth >= 25 && this.maxScrollDepth < 25) {
        this.onBehavior({ behaviorType: 'scroll_depth', value: 25 });
      }
      if (scrollDepth >= 50 && this.maxScrollDepth < 50) {
        this.onBehavior({ behaviorType: 'scroll_depth', value: 50 });
      }
      if (scrollDepth >= 75 && this.maxScrollDepth < 75) {
        this.onBehavior({ behaviorType: 'scroll_depth', value: 75 });
      }
      if (scrollDepth >= 100) {
        this.onBehavior({ behaviorType: 'scroll_depth', value: 100 });
      }
    }
    
    // Detect rapid scrolling (scanning behavior)
    const now = Date.now();
    const timeDiff = now - this.lastScrollTime;
    const scrollDiff = Math.abs(scrollY - this.lastScrollY);
    
    if (timeDiff > 0) {
      const scrollSpeed = scrollDiff / timeDiff * 1000; // px/second
      
      if (scrollSpeed > 3000) { // Very fast scrolling
        this.rapidScrollCount++;
        
        if (this.rapidScrollCount % 3 === 0) { // Report every 3 rapid scrolls
          this.onBehavior({
            behaviorType: 'rapid_scroll',
            value: scrollSpeed,
            metadata: { consecutiveRapidScrolls: this.rapidScrollCount }
          });
        }
      } else {
        this.rapidScrollCount = 0;
      }
    }
    
    this.lastScrollTime = now;
    this.lastScrollY = scrollY;
  }

  // ============ FORM TRACKING ============
  
  private initFormTracking() {
    // Track form field interactions
    document.addEventListener('focus', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        const selector = this.getElementSelector(target);
        this.formFields.set(selector, {
          startTime: Date.now(),
          changes: 0
        });
      }
    }, true);
    
    document.addEventListener('blur', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        const selector = this.getElementSelector(target);
        const fieldData = this.formFields.get(selector);
        
        if (fieldData) {
          const duration = Date.now() - fieldData.startTime;
          const input = target as HTMLInputElement;
          
          // Form abandonment (focused but no input)
          if (fieldData.changes === 0 && duration > 2000) {
            this.onBehavior({
              behaviorType: 'form_abandonment',
              elementSelector: selector,
              value: duration / 1000,
              metadata: {
                fieldType: input.type,
                fieldName: input.name
              }
            });
          }
          
          // Long form fill time
          if (duration > 30000) {
            this.onBehavior({
              behaviorType: 'long_form_fill',
              elementSelector: selector,
              value: duration / 1000,
              metadata: {
                changes: fieldData.changes
              }
            });
          }
          
          this.formFields.delete(selector);
        }
      }
    }, true);
    
    // Track changes
    document.addEventListener('input', (e) => {
      const target = e.target as HTMLElement;
      const selector = this.getElementSelector(target);
      const fieldData = this.formFields.get(selector);
      
      if (fieldData) {
        fieldData.changes++;
      }
    }, true);
    
    // Copy/paste detection
    document.addEventListener('paste', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        this.onBehavior({
          behaviorType: 'paste',
          elementSelector: this.getElementSelector(target),
          metadata: {
            fieldType: (target as HTMLInputElement).type
          }
        });
      }
    });
  }

  // ============ VISIBILITY TRACKING ============
  
  private initVisibilityTracking() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.tabHiddenCount++;
        this.onBehavior({
          behaviorType: 'tab_hidden',
          value: this.tabHiddenCount
        });
      } else {
        this.onBehavior({
          behaviorType: 'tab_visible',
          value: this.tabHiddenCount
        });
      }
    });
  }

  // ============ NETWORK TRACKING ============
  
  private initNetworkTracking() {
    // Track failed requests
    if (window.PerformanceObserver) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'resource') {
              const resourceEntry = entry as PerformanceResourceTiming;
              
              // Slow load detection (>3s)
              if (resourceEntry.duration > 3000) {
                this.onBehavior({
                  behaviorType: 'slow_load',
                  value: resourceEntry.duration,
                  metadata: {
                    resource: resourceEntry.name,
                    type: resourceEntry.initiatorType
                  }
                });
              }
            }
          }
        });
        
        observer.observe({ entryTypes: ['resource'] });
      } catch {
        // PerformanceObserver not supported
      }
    }
    
    // Detect network errors
    window.addEventListener('error', (e) => {
      const target = e.target as HTMLElement & { src?: string };
      if (target && target.src) {
        this.onBehavior({
          behaviorType: 'network_error',
          metadata: {
            resource: target.src
          }
        });
      }
    }, true);
  }

  // ============ IDLE TRACKING ============
  
  private initIdleTracking() {
    setInterval(() => {
      const now = Date.now();
      const idleTime = now - this.lastActivityTime;
      
      if (idleTime > this.config.idleTimeout && !this.isIdle) {
        this.isIdle = true;
        this.onBehavior({
          behaviorType: 'user_idle',
          value: idleTime / 1000
        });
      }
    }, 5000);
  }

  // ============ NAVIGATION TRACKING ============
  
  private initNavigationTracking() {
    // Back button detection
    window.addEventListener('popstate', () => {
      this.backButtonCount++;
      this.onBehavior({
        behaviorType: 'back_button',
        value: this.backButtonCount
      });
    });
    
    // Orientation change (mobile)
    window.addEventListener('orientationchange', () => {
      this.onBehavior({
        behaviorType: 'orientation_change',
        metadata: {
          orientation: (window as Window & { orientation?: number | string }).orientation || screen.orientation?.type
        }
      });
    });
  }

  // ============ UTILITIES ============
  
  private getElementSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`;
    }
    
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c).slice(0, 2).join('.');
      return `${element.tagName.toLowerCase()}.${classes}`;
    }
    
    return element.tagName.toLowerCase();
  }

  // Public method to get current stats
  public getStats() {
    return {
      maxScrollDepth: this.maxScrollDepth,
      rapidScrollCount: this.rapidScrollCount,
      tabHiddenCount: this.tabHiddenCount,
      backButtonCount: this.backButtonCount,
      isIdle: this.isIdle,
      idleTime: this.isIdle ? Date.now() - this.lastActivityTime : 0
    };
  }

  // Cleanup
  public destroy() {
    // Remove all listeners (implement if needed)
  }
}

