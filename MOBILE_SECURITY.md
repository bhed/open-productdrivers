# Mobile App Security Guide

When using ProductDrivers in mobile applications (Flutter, Kotlin/Android, Swift/iOS), you need to handle the project key carefully since mobile apps are distributed to end users who could potentially extract and misuse it.

## ⚠️ The Problem

Unlike web apps where domain restrictions can help (browsers send `Origin` headers), **mobile apps don't send origin headers** and bundle all their code into downloadable binaries. This means:

- Anyone can decompile your app and extract the project key
- "Pranksters" or malicious users could send fake events to your project
- Simple code obfuscation is not sufficient protection

## ✅ Recommended Solution: Server-Side Proxy

The most secure approach is to **proxy all ProductDrivers API calls through your own backend**.

### Architecture

```
Mobile App → Your Backend (Authenticated) → ProductDrivers Edge Functions
```

### Implementation Steps

#### 1. Create a Backend Endpoint

**Example (Node.js/Express):**

```javascript
// server.js
const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

// Middleware: Verify user authentication
function authenticateUser(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  // Verify JWT token, session, etc.
  if (!isValidToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  req.userId = getUserIdFromToken(token);
  next();
}

// Proxy endpoint for tracking events
app.post('/api/analytics/track', authenticateUser, async (req, res) => {
  const { event, journey, step, feature, value, meta } = req.body;
  
  // Validate and sanitize
  if (!event || !['JOURNEY_STEP', 'FEATURE_USED', 'JOURNEY_SATISFACTION'].includes(event)) {
    return res.status(400).json({ error: 'Invalid event type' });
  }
  
  // Add server-side data
  const payload = {
    projectKey: process.env.PRODUCTDRIVERS_PROJECT_KEY, // Secret, not exposed to mobile
    userId: req.userId, // From authenticated session
    event,
    journey,
    step,
    feature,
    value,
    meta: {
      ...meta,
      serverVerified: true,
      timestamp: Date.now(),
    },
  };
  
  // Forward to ProductDrivers
  const response = await fetch('https://your-supabase.supabase.co/functions/v1/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
  if (response.ok) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Tracking failed' });
  }
});

app.listen(3000);
```

#### 2. Update Mobile SDK Calls

Instead of calling ProductDrivers directly, call your backend:

**Flutter Example:**

```dart
class AnalyticsService {
  static const baseUrl = 'https://your-backend.com/api/analytics';
  
  static Future<void> track({
    required String event,
    String? journey,
    String? step,
    String? feature,
    dynamic value,
    Map<String, dynamic>? meta,
  }) async {
    final token = await AuthService.getToken(); // Your auth token
    
    final response = await http.post(
      Uri.parse('$baseUrl/track'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: json.encode({
        'event': event,
        'journey': journey,
        'step': step,
        'feature': feature,
        'value': value,
        'meta': meta,
      }),
    );
    
    if (response.statusCode != 200) {
      print('Analytics tracking failed');
    }
  }
}

// Usage
AnalyticsService.track(
  event: 'JOURNEY_STEP',
  journey: 'onboarding',
  step: 'welcome',
);
```

**Kotlin Example:**

```kotlin
object AnalyticsService {
    private const val BASE_URL = "https://your-backend.com/api/analytics"
    
    suspend fun track(
        event: String,
        journey: String? = null,
        step: String? = null,
        feature: String? = null,
        value: Any? = null,
        meta: Map<String, Any>? = null
    ) {
        val token = AuthService.getToken() // Your auth token
        
        val payload = JSONObject().apply {
            put("event", event)
            journey?.let { put("journey", it) }
            step?.let { put("step", it) }
            feature?.let { put("feature", it) }
            value?.let { put("value", it) }
            meta?.let { put("meta", JSONObject(it)) }
        }
        
        val request = Request.Builder()
            .url("$BASE_URL/track")
            .addHeader("Content-Type", "application/json")
            .addHeader("Authorization", "Bearer $token")
            .post(payload.toString().toRequestBody("application/json".toMediaType()))
            .build()
        
        val response = OkHttpClient().newCall(request).execute()
        if (!response.isSuccessful) {
            Log.e("Analytics", "Tracking failed")
        }
    }
}

// Usage
AnalyticsService.track(
    event = "JOURNEY_STEP",
    journey = "onboarding",
    step = "welcome"
)
```

### Benefits

✅ **Project key stays secret** on your backend  
✅ **User authentication** required before tracking  
✅ **Server-side validation** of event data  
✅ **Rate limiting** at your backend level  
✅ **Additional context** (verified user ID, server timestamp)  
✅ **Audit trail** of who sent what

---

## Alternative: App Attestation (Advanced)

For native mobile apps, you can also use platform-specific attestation to verify app authenticity:

### Android: Play Integrity API

```kotlin
// Verify the app is genuine and from Play Store
val integrityManager = IntegrityManagerFactory.create(context)
val integrityTokenResponse = integrityManager
    .requestIntegrityToken(
        IntegrityTokenRequest.builder()
            .setCloudProjectNumber(PROJECT_NUMBER)
            .build()
    )
    .await()

// Send integrity token with events
// Backend validates token with Google's API
```

### iOS: App Attest

```swift
// Generate and attest app key
let service = DCAppAttestService.shared
if service.isSupported {
    let keyId = try await service.generateKey()
    let attestation = try await service.attestKey(keyId, clientDataHash: hash)
    // Send attestation to backend for validation
}
```

**Note:** These require backend validation and are more complex to implement.

---

## Other Security Measures

### 1. Rate Limiting

Implement rate limiting on your backend:

```javascript
const rateLimit = require('express-rate-limit');

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Max 100 events per minute per user
  keyGenerator: (req) => req.userId,
});

app.use('/api/analytics', analyticsLimiter);
```

### 2. Event Validation

Validate event schemas:

```javascript
const Joi = require('joi');

const trackSchema = Joi.object({
  event: Joi.string().valid('JOURNEY_STEP', 'FEATURE_USED', 'JOURNEY_SATISFACTION').required(),
  journey: Joi.string().max(100),
  step: Joi.string().max(100),
  feature: Joi.string().max(100),
  value: Joi.number(),
  meta: Joi.object(),
});

app.post('/api/analytics/track', authenticateUser, (req, res) => {
  const { error } = trackSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  // ... forward to ProductDrivers
});
```

### 3. Anomaly Detection

Monitor for suspicious patterns:

```javascript
// Example: Check for spam (too many events in short time)
async function checkForSpam(userId) {
  const recentEvents = await db.query(
    'SELECT COUNT(*) FROM events WHERE user_id = ? AND created_at > NOW() - INTERVAL 1 MINUTE',
    [userId]
  );
  
  if (recentEvents > 50) {
    throw new Error('Rate limit exceeded');
  }
}
```

### 4. Code Obfuscation (Defense in Depth)

While not sufficient alone, obfuscation adds a layer:

- **Flutter:** Use `--obfuscate --split-debug-info` flags
- **Android:** ProGuard/R8 obfuscation
- **iOS:** Strip symbols and use code obfuscation tools

---

## ❌ What NOT to Do

### Don't Rely on Client-Side "Security"

```dart
// ❌ BAD: Hardcoding key in mobile app (even if obfuscated)
const projectKey = 'pk_abc123';
ProductDrivers.init(projectKey);
```

```kotlin
// ❌ BAD: Storing key in SharedPreferences or BuildConfig
val projectKey = BuildConfig.PROJECT_KEY
ProductDrivers.init(context, projectKey)
```

### Don't Skip Authentication

```javascript
// ❌ BAD: Proxy without authentication
app.post('/api/analytics/track', (req, res) => {
  // Anyone can call this!
  forwardToProductDrivers(req.body);
});
```

---

## Summary

| Method | Security | Complexity | Recommended |
|--------|----------|------------|-------------|
| **Server-Side Proxy** | ⭐⭐⭐⭐⭐ | Medium | ✅ **Yes** |
| App Attestation | ⭐⭐⭐⭐ | High | Optional (extra layer) |
| Code Obfuscation | ⭐⭐ | Low | ⚠️ Not sufficient alone |
| Domain Restriction | ❌ N/A | N/A | ❌ Doesn't work for mobile |

**Best Practice:** Use a **server-side proxy** with **user authentication** and **rate limiting**. This is the industry standard for mobile analytics and protects your project from abuse while maintaining data integrity.

---

## Questions?

- Check the [main documentation](/docs)
- Review [GDPR compliance guide](PRIVACY_AND_GDPR_ANALYSIS.md)
- See [production deployment guide](README.md#-production-deployment)
