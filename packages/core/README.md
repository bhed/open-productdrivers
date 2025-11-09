# @productdrivers/core

Shared types, schemas, and constants for the ProductDrivers analytics platform.

## Installation

```bash
npm install @productdrivers/core
# or
yarn add @productdrivers/core
# or
pnpm add @productdrivers/core
```

## Usage

### Types

```typescript
import type {
  TrackPayload,
  IdentifyPayload,
  EventType,
  JourneyEventPayload,
  FeatureEventPayload,
  SatisfactionEventPayload,
} from '@productdrivers/core';

const event: FeatureEventPayload = {
  projectKey: 'proj_xxx',
  event: 'FEATURE_USED',
  feature: 'help_tooltip',
  journey: 'checkout',
};
```

### Schemas (Zod)

```typescript
import { trackPayloadSchema, validateTrackPayload } from '@productdrivers/core';

const result = validateTrackPayload(data);

if (result.success) {
  // data is valid
  console.log(result.data);
} else {
  // validation errors
  console.error(result.error);
}
```

### Constants

```typescript
import { API_ENDPOINTS, SDK_DEFAULTS, LIMITS } from '@productdrivers/core';

console.log(API_ENDPOINTS.TRACK); // '/v1/track'
console.log(SDK_DEFAULTS.MAX_BATCH_SIZE); // 50
console.log(LIMITS.MAX_JOURNEY_LENGTH); // 100
```

## Event Types

- `JOURNEY_START` - User starts a journey
- `JOURNEY_COMPLETE` - User completes a journey
- `STEP_VIEW` - User views a step within a journey
- `FEATURE_USED` - User interacts with a feature
- `JOURNEY_SATISFACTION` - User rates their satisfaction
- `CUSTOM` - Custom event type

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Type check
pnpm type-check

# Watch mode
pnpm dev
```

## License

MIT

