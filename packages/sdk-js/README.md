# @productdrivers/sdk-js

JavaScript/TypeScript SDK for ProductDrivers analytics.

## Features

- ✅ Auto session management
- ✅ Event batching & offline queue
- ✅ localStorage persistence
- ✅ Retry logic with exponential backoff
- ✅ Type-safe API
- ✅ Zero dependencies (except @productdrivers/core)

## Installation

```bash
npm install @productdrivers/sdk-js
# or
yarn add @productdrivers/sdk-js
# or
pnpm add @productdrivers/sdk-js
```

## Quick Start

```typescript
import { init, track, identify, EventType } from '@productdrivers/sdk-js';

// 1. Initialize (once, at app startup)
init({
  projectKey: 'YOUR_PROJECT_KEY',  // From ProductDrivers dashboard
  apiKey: 'YOUR_SUPABASE_ANON_KEY',  // From Supabase dashboard (Settings → API → anon public)
  apiBaseUrl: 'https://YOUR_PROJECT.supabase.co/functions/v1',  // Your Supabase Edge Functions URL
  debug: true  // Optional: enable console logging
});

// 2. Track events
track({
  event: EventType.STEP_VIEW,
  journey: 'checkout',
  step: 'payment'
});

track({
  event: EventType.FEATURE_USED,
  feature: 'help_tooltip',
  journey: 'checkout'
});

track({
  event: EventType.JOURNEY_SATISFACTION,
  journey: 'checkout',
  value: 8 // 1-10 scale
});

// 3. Identify users (optional)
identify('user_123', {
  email: 'user@example.com',
  plan: 'premium'
});
```

## API Reference

### `init(config: SDKConfig)`

Initialize the SDK. Must be called before tracking events.

**Config Options:**
- `projectKey` (required): Your ProductDrivers project key (starts with `pk_`)
- `apiKey` (required): Your Supabase anonymous key (get from Supabase Dashboard → Settings → API → anon public)
- `apiBaseUrl` (required): Your Supabase Edge Functions URL (format: `https://YOUR_PROJECT.supabase.co/functions/v1`)
- `maxBatchSize` (optional): Max events before auto-flush (default: 50)
- `maxBatchWaitMs` (optional): Max time before auto-flush (default: 30000)
- `maxRetries` (optional): Max retry attempts (default: 3)
- `debug` (optional): Enable debug logging (default: false)
- `blockPII` (optional): Enable PII detection and blocking (default: false)

### `track(payload: TrackPayload)`

Track an event.

**Example:**
```typescript
track({
  event: 'FEATURE_USED',
  feature: 'search_filter',
  journey: 'product_discovery',
  value: 1
});
```

### `identify(userId: string, traits?: Record<string, any>)`

Link a session to a user ID and update user traits.

**Example:**
```typescript
identify('user_123', {
  email: 'user@example.com',
  name: 'John Doe',
  plan: 'premium'
});
```

### `flush(): Promise<void>`

Manually flush queued events (normally done automatically).

**Example:**
```typescript
await flush();
```

## Event Types

```typescript
import { EventType } from '@productdrivers/sdk-js';

EventType.JOURNEY_START      // User starts a journey
EventType.JOURNEY_COMPLETE   // User completes a journey
EventType.STEP_VIEW          // User views a step
EventType.FEATURE_USED       // User uses a feature
EventType.JOURNEY_SATISFACTION // User rates satisfaction
EventType.CUSTOM             // Custom event
```

## React Usage

```tsx
import { useEffect } from 'react';
import { init, track } from '@productdrivers/sdk-js';

function App() {
  useEffect(() => {
    init({
      projectKey: 'YOUR_PROJECT_KEY',
      apiKey: process.env.REACT_APP_SUPABASE_ANON_KEY!,
      apiBaseUrl: process.env.REACT_APP_SUPABASE_URL! + '/functions/v1',
    });
  }, []);

  const handleCheckout = () => {
    track({
      event: 'JOURNEY_START',
      journey: 'checkout'
    });
  };

  return <button onClick={handleCheckout}>Checkout</button>;
}
```

## Next.js Usage

```typescript
// app/layout.tsx or pages/_app.tsx
import { init } from '@productdrivers/sdk-js';

init({
  projectKey: process.env.NEXT_PUBLIC_PRODUCTDRIVERS_KEY!,
  apiKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  apiBaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL! + '/functions/v1',
});

export default function RootLayout({ children }) {
  return <html><body>{children}</body></html>;
}
```

## Survey Widget (Optional)

Display in-app satisfaction surveys:

```tsx
import { SurveyWidget } from '@productdrivers/sdk-js/survey-widget';

function MyApp() {
  return (
    <>
      <YourApp />
      <SurveyWidget 
        projectKey="YOUR_KEY"
        journey="checkout"
        question="How was your checkout experience?"
        onSubmit={(score, feedback) => {
          console.log('Survey submitted:', score, feedback);
        }}
      />
    </>
  );
}
```

## Offline Support

Events are automatically queued in localStorage when offline and sent when connection is restored.

## Privacy & Security

### PII Detection

ProductDrivers includes automatic PII (Personally Identifiable Information) detection to prevent accidental tracking of sensitive data.

**Enable PII blocking:**

```typescript
init({
  projectKey: 'YOUR_KEY',
  apiKey: 'YOUR_SUPABASE_ANON_KEY',
  apiBaseUrl: 'https://your-project.supabase.co/functions/v1',
  blockPII: true, // Blocks events containing PII
});
```

**Detected patterns:**
- Email addresses
- Phone numbers
- Credit card numbers
- Social Security Numbers (SSN)
- IP addresses

Events containing PII will be blocked and logged in debug mode.

### General Privacy

- No cookies
- No third-party tracking
- No automatic PII collection
- Full control over what data is sent

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm type-check
```

## License

MIT

