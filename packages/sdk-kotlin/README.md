# ProductDrivers SDK for Kotlin/Android

Analytics SDK for Android applications.

## Installation

### Local Testing (Gradle)

Add to your `settings.gradle.kts`:

```kotlin
includeBuild("../path/to/productdrivers/packages/sdk-kotlin")
```

Add to your `build.gradle.kts`:

```kotlin
dependencies {
    implementation("com.productdrivers:sdk-kotlin:0.1.0")
}
```

### Maven Local (for testing)

In this directory:

```bash
./gradlew publishToMavenLocal
```

In your app's `build.gradle.kts`:

```kotlin
repositories {
    mavenLocal()
}

dependencies {
    implementation("com.productdrivers:sdk-kotlin:0.1.0")
}
```

## Usage

### Initialize

```kotlin
import com.productdrivers.ProductDrivers
import com.productdrivers.EventType

class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        
        ProductDrivers.init(
            context = this,
            projectKey = "YOUR_PROJECT_KEY",
            debug = BuildConfig.DEBUG
        )
    }
}
```

### Track Events

```kotlin
// Track feature usage
ProductDrivers.track(
    event = EventType.FEATURE_USED,
    feature = "search_button",
    journey = "product_discovery"
)

// Track journey steps
ProductDrivers.track(
    event = EventType.STEP_VIEW,
    journey = "checkout",
    step = "payment"
)

// Track satisfaction
ProductDrivers.track(
    event = EventType.JOURNEY_SATISFACTION,
    journey = "checkout",
    value = 8
)
```

### Identify Users

```kotlin
ProductDrivers.identify(
    userId = "user_123",
    traits = mapOf(
        "email" to "user@example.com",
        "plan" to "premium"
    )
)
```

### Manual Flush

```kotlin
ProductDrivers.flush()
```

## Features

- ✅ Auto session management
- ✅ Event batching (50 events or 30s)
- ✅ Offline queue with SharedPreferences
- ✅ Retry logic with exponential backoff
- ✅ Thread-safe operations
- ✅ Coroutines support
- ✅ PII detection and blocking

## Privacy & Security

### PII Detection

ProductDrivers includes automatic PII (Personally Identifiable Information) detection to prevent accidental tracking of sensitive data.

**Enable PII blocking:**

```kotlin
ProductDrivers.init(
    context = this,
    projectKey = "YOUR_KEY",
    apiBaseUrl = "https://your-project.supabase.co/functions/v1",
    blockPII = true, // Blocks events containing PII
    debug = BuildConfig.DEBUG
)
```

**Detected patterns:**
- Email addresses
- Phone numbers
- Credit card numbers
- Social Security Numbers (SSN)
- IP addresses

Events containing PII will be blocked and logged in debug mode.

## Requirements

- Android SDK 21+
- Kotlin 1.9+

## License

MIT

