# Satisfaction Components Guide

Pre-built React components for tracking user satisfaction with different rating scales.

## Installation

```bash
npm install @productdrivers/sdk-js
```

## Available Components

### 1. Binary Rating (Like/Dislike)

Simple thumbs up/down rating.

```tsx
import { BinaryRating } from '@productdrivers/sdk-js/satisfaction-components';
import { track, EventType } from '@productdrivers/sdk-js';

<BinaryRating
  journey="checkout"
  onRate={(value) => {
    // value: 2 = like, 1 = dislike
    track({
      event: EventType.JOURNEY_SATISFACTION,
      journey: 'checkout',
      value
    });
  }}
/>
```

### 2. Sentiment Rating (3-Point)

Happy/Neutral/Unhappy faces.

```tsx
import { SentimentRating } from '@productdrivers/sdk-js/satisfaction-components';

<SentimentRating
  journey="onboarding"
  onRate={(value) => {
    // value: 1 = unhappy, 2 = neutral, 3 = happy
    track({
      event: EventType.JOURNEY_SATISFACTION,
      journey: 'onboarding',
      value
    });
  }}
/>
```

### 3. Star Rating (5-Star)

Classic 5-star rating with optional feedback.

```tsx
import { StarRating } from '@productdrivers/sdk-js/satisfaction-components';

<StarRating
  journey="product_view"
  showFeedback={true}
  onRate={(value, feedback) => {
    // value: 1-5 stars
    track({
      event: EventType.JOURNEY_SATISFACTION,
      journey: 'product_view',
      value,
      feedback
    });
  }}
/>
```

### 4. NPS Rating (10-Point)

Net Promoter Score scale with optional feedback.

```tsx
import { NPSRating } from '@productdrivers/sdk-js/satisfaction-components';

<NPSRating
  journey="overall_experience"
  showFeedback={true}
  onRate={(value, feedback) => {
    // value: 1-10
    track({
      event: EventType.JOURNEY_SATISFACTION,
      journey: 'overall_experience',
      value,
      feedback
    });
  }}
/>
```

## Props

All components accept:

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `journey` | string | ✅ | Journey identifier |
| `onRate` | function | ✅ | Callback with `(value, feedback?)` |
| `showFeedback` | boolean | ❌ | Show feedback textarea (StarRating & NPSRating only) |

## Styling

Components use Tailwind CSS classes. You can:

1. **Use as-is** if you have Tailwind configured
2. **Wrap in your own container** with custom styles
3. **Copy and customize** the component code to match your design system

## Complete Example

```tsx
import { init, track, EventType } from '@productdrivers/sdk-js';
import { StarRating } from '@productdrivers/sdk-js/satisfaction-components';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    init({ projectKey: 'YOUR_PROJECT_KEY' });
  }, []);

  return (
    <div className="max-w-md mx-auto mt-10">
      <StarRating
        journey="checkout"
        showFeedback={true}
        onRate={(value, feedback) => {
          track({
            event: EventType.JOURNEY_SATISFACTION,
            journey: 'checkout',
            value,
            feedback
          });
          
          console.log('Rating submitted:', value, feedback);
        }}
      />
    </div>
  );
}
```

## When to Show

### Trigger Options

1. **After journey completion**
```tsx
if (checkoutComplete) {
  setShowRating(true);
}
```

2. **On specific events**
```tsx
onPurchaseSuccess={() => {
  track({ event: EventType.JOURNEY_COMPLETE, journey: 'checkout' });
  setShowRating(true);
}}
```

3. **With delay**
```tsx
useEffect(() => {
  const timer = setTimeout(() => setShowRating(true), 5000);
  return () => clearTimeout(timer);
}, []);
```

4. **Modal/Overlay**
```tsx
<Modal open={showRating}>
  <StarRating journey="checkout" onRate={handleRate} />
</Modal>
```

## Best Practices

✅ **Do:**
- Show after key moments (purchase, onboarding complete, etc.)
- Use consistent scales within the same journey
- Keep feedback optional
- Thank users after submission

❌ **Don't:**
- Show too frequently (once per session max)
- Block critical flows
- Make it mandatory
- Ask before the journey is complete

## License

MIT

