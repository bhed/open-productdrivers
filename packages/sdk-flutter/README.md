# ProductDrivers SDK for Flutter

Analytics SDK for Flutter applications (iOS & Android).

## Installation

### Local Testing

In your `pubspec.yaml`:

```yaml
dependencies:
  productdrivers:
    path: ../path/to/productdrivers/packages/sdk-flutter
```

## Usage

### Initialize

```dart
import 'package:productdrivers/productdrivers.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await ProductDrivers.init(
    projectKey: 'YOUR_PROJECT_KEY',
    apiBaseUrl: 'https://your-project.supabase.co/functions/v1',
    debug: kDebugMode,
  );
  
  runApp(MyApp());
}
```

### Track Events

```dart
// Track feature usage
ProductDrivers.track(
  event: EventType.featureUsed,
  feature: 'search_button',
  journey: 'product_discovery',
);

// Track journey steps
ProductDrivers.track(
  event: EventType.stepView,
  journey: 'checkout',
  step: 'payment',
);

// Track satisfaction
ProductDrivers.track(
  event: EventType.journeySatisfaction,
  journey: 'checkout',
  value: 8,
);

// Custom event with metadata
ProductDrivers.track(
  event: EventType.custom,
  feature: 'share',
  meta: {
    'platform': 'twitter',
    'content_type': 'product',
  },
);
```

### Identify Users

```dart
await ProductDrivers.identify(
  'user_123',
  traits: {
    'email': 'user@example.com',
    'plan': 'premium',
    'registered_at': DateTime.now().toIso8601String(),
  },
);
```

### Manual Flush

```dart
await ProductDrivers.flush();
```

## Features

- ✅ Auto session management
- ✅ Event batching (50 events or 30s)
- ✅ Offline queue with SharedPreferences
- ✅ Retry logic
- ✅ Cross-platform (iOS & Android)
- ✅ Null-safety
- ✅ PII detection and blocking

## Privacy & Security

### PII Detection

ProductDrivers includes automatic PII (Personally Identifiable Information) detection to prevent accidental tracking of sensitive data.

**Enable PII blocking:**

```dart
await ProductDrivers.init(
  projectKey: 'YOUR_KEY',
  apiBaseUrl: 'https://your-project.supabase.co/functions/v1',
  blockPII: true, // Blocks events containing PII
);
```

**Detected patterns:**
- Email addresses
- Phone numbers
- Credit card numbers
- Social Security Numbers (SSN)
- IP addresses

Events containing PII will be blocked and logged in debug mode.

## Requirements

- Flutter SDK 3.0+
- Dart 3.0+

## License

MIT

