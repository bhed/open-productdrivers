# ProductDrivers

**Open-source analytics platform for measuring feature adoption, user journeys, and satisfaction**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/bhed/open-productdrivers)](https://github.com/bhed/open-productdrivers)

ProductDrivers is a **privacy-first**, open-source analytics solution designed for product teams who want to understand:
- 🎯 **Feature Adoption**: Which features drive user engagement and retention
- 🗺️ **User Journeys**: How users navigate through your product
- 😊 **Satisfaction**: What delights or frustrates your users
- 🔗 **Correlations**: Data-driven insights connecting user behavior to outcomes

---

## ✨ Features

### Analytics Dashboard
- **User Journey Visualization**: Flow diagrams showing how users navigate your product
- **Driver Analysis**: Identify features that correlate with successful outcomes (e.g., conversions, retention)
- **User Behavior Insights**: Automatic detection of rage clicks, dead clicks, scroll depth, hesitations, and frustration patterns
- **Satisfaction Tracking**: Measure NPS and journey-specific satisfaction scores
- **Privacy Controls**: Domain restrictions, PII detection, GDPR-compliant data management

### Multi-Platform SDKs
- **JavaScript/TypeScript**: For web apps (React, Vue, Angular, vanilla JS)
- **Flutter**: Native Dart SDK for iOS and Android
- **Kotlin**: Native Android SDK

### Self-Hosted
- **Your Infrastructure**: Run on your own Supabase instance
- **Industry-Leading Security**: HMAC-SHA256 signatures, replay attack prevention, RLS policies
- **Dual Auth Modes**: Frontend (domain-restricted) + Backend (cryptographically signed)
- **No Tracking**: We don't collect your data
- **GDPR Compliant**: Built-in tools for data export and deletion
- **Open Source**: Full transparency, audit the code yourself

---

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js** 20+ and **pnpm**
- **Supabase account** (free tier works): [supabase.com](https://supabase.com)
- Git

> **Note:** This guide covers local development. For production deployment, see the [Production Deployment](#-production-deployment) section below.

### 2. Clone & Install

```bash
git clone https://github.com/bhed/open-productdrivers.git
cd productdrivers
pnpm install
```

### 3. Setup Supabase

#### Apply Database Migrations

Set up your database schema:

```bash
# Option A: Using Supabase CLI (local development)
supabase start
supabase db reset

# Option B: Using hosted Supabase
# Go to Supabase Dashboard > SQL Editor
# Copy and run: supabase/migrations/000_complete_schema.sql
```

**What this creates:**
- All tables, indexes, and RLS policies
- Helper functions and aggregation triggers
- Automatic workspace creation for new users

#### Deploy Edge Functions

**Edge Functions are required** for the SDK to work. They handle analytics events from your applications.

**Option A: Using Supabase CLI (local):**
```bash
# Functions are automatically running locally after 'supabase start'
```

**Option B: Using hosted Supabase:**
```bash
# Deploy all Edge Functions
supabase functions deploy track
supabase functions deploy identify
supabase functions deploy gdpr-export
supabase functions deploy gdpr-delete
supabase functions deploy gdpr-anonymize
```

> **Note:** Analytics aggregation is handled automatically via PostgreSQL triggers when events are tracked. No additional cron jobs or aggregation functions are needed.

**Set environment variables for Edge Functions:**

Via Supabase CLI:
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Or via Dashboard:
1. Go to **Supabase Dashboard** → **Edge Functions** → **Settings**
2. Add secret:
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: Your service role key from Project Settings > API

### 4. Configure Dashboard

```bash
cd apps/dashboard
cp .env.example .env.local
```

Edit `.env.local` and fill in your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Note:** The dashboard only needs the `anon` key. The `service_role` key is only used by Edge Functions (configured in step 3).

### 5. Start the Dashboard

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 6. Create Your First Account

1. The app will redirect you to the login page
2. Click **"Sign up"** to create your first account
3. Enter your email and password (min. 6 characters)
4. **Important**: Check your email inbox for a confirmation link from Supabase
5. Click the confirmation link to verify your email
6. Return to [http://localhost:3000](http://localhost:3000) and log in

**Note:** Supabase requires email confirmation by default. If you want to disable this for local development:
- Go to **Supabase Dashboard** → **Authentication** → **Settings**
- Under "Email Confirmations", toggle **"Enable email confirmations"** off

Once logged in, you'll be guided to create your first project and get your project key for the SDK.

---

## 📦 SDK Installation & Configuration

### Option A: NPM Install (Soon)

```bash
# JavaScript/TypeScript
npm install @productdrivers/sdk-js

# Flutter
flutter pub add productdrivers

# Kotlin
// Add to build.gradle
implementation 'com.productdrivers:sdk-kotlin:1.0.0'
```

### Option B: Manual Installation

If SDKs are not yet published to package registries, copy the source files:
- JavaScript: `packages/sdk-js/src/`
- Flutter: `packages/sdk-flutter/lib/`
- Kotlin: `packages/sdk-kotlin/src/`

---

## 🔧 SDK Configuration

All SDKs require the following configuration values:

1. **`projectKey`** - Your project identifier (starts with `pk_`)
   - 📍 Get it from: ProductDrivers Dashboard → Your Project → Getting Started
   - ✅ Safe to expose in frontend code

2. **`apiKey`** - Your Supabase anonymous key (**REQUIRED**)
   - 📍 Get it from: Supabase Dashboard → Settings → API → Project API keys → **anon public**
   - ✅ Safe to expose in frontend code (this is the public anon key, not the service_role key)
   - 🔐 Used for Edge Function authentication

3. **`apiBaseUrl`** - Your Supabase Edge Functions URL
   - 📍 Format: `https://YOUR_PROJECT_REF.supabase.co/functions/v1`
   - 📍 Get YOUR_PROJECT_REF from: Supabase Dashboard → Settings → API → Project URL
   - Example: `https://abcdefgh.supabase.co/functions/v1`

### JavaScript/TypeScript Example

```typescript
import { init, track, EventType } from '@productdrivers/sdk-js';

// Frontend Configuration
init({
  projectKey: 'pk_xxxxxxxxxxxxx',  // From ProductDrivers dashboard
  apiKey: 'your-supabase-anon-key',  // From Supabase dashboard (Settings → API → anon public)
  apiBaseUrl: 'https://YOUR_PROJECT_REF.supabase.co/functions/v1',
  blockPII: true,  // Recommended: block sensitive data
});

// Track user events
track({
  event: EventType.FEATURE_USED,
  feature: 'share_button',
  journey: 'onboarding',
});
```

[📘 Full JS SDK Documentation](packages/sdk-js/README.md)

### Flutter Example

```dart
import 'package:productdrivers/productdrivers.dart';

// Frontend Configuration
await ProductDrivers.init(
  projectKey: 'pk_xxxxxxxxxxxxx',
  apiKey: 'your-supabase-anon-key',  // From Supabase dashboard
  apiBaseUrl: 'https://YOUR_PROJECT_REF.supabase.co/functions/v1',
  blockPII: true,
);

// Track events
ProductDrivers.track(
  event: EventType.featureUsed,
  feature: 'share_button',
  journey: 'onboarding',
);
```

[📘 Full Flutter SDK Documentation](packages/sdk-flutter/README.md)

### Kotlin (Android) Example

```kotlin
import com.productdrivers.ProductDrivers
import com.productdrivers.EventType

// Frontend Configuration
ProductDrivers.init(
    context = context,
    projectKey = "pk_xxxxxxxxxxxxx",
    apiKey = "your-supabase-anon-key",  // From Supabase dashboard
    apiBaseUrl = "https://YOUR_PROJECT_REF.supabase.co/functions/v1",
    blockPII = true
)

// Track events
ProductDrivers.track(
    event = EventType.FEATURE_USED,
    feature = "share_button",
    journey = "onboarding"
)
```

[📘 Full Kotlin SDK Documentation](packages/sdk-kotlin/README.md)

---

## 🚢 Production Deployment

### Deploy Dashboard to Vercel (Recommended)

Vercel provides the easiest deployment path for the Next.js dashboard:

1. **Push your code to GitHub**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/productdrivers.git
   git push -u origin main
   ```

2. **Import to Vercel**
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click "New Project" → Import your GitHub repository
   - Configure project:
     - **Framework Preset:** Next.js
     - **Root Directory:** `apps/dashboard`
     - **Build Command:** `pnpm build`
     - **Install Command:** `pnpm install`

3. **Add Environment Variables**
   
   In Vercel dashboard → Settings → Environment Variables:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
   ```

4. **Deploy!**
   - Vercel will automatically build and deploy
   - Every push to `main` triggers a new deployment

### Deploy to Your Own Server

For custom infrastructure (VPS, AWS, etc.):

**Requirements:**
- Node.js 20+
- Process manager (PM2 recommended)
- Nginx for reverse proxy
- SSL certificate (Let's Encrypt)

**Deployment Steps:**

```bash
# Clone and build
git clone https://github.com/YOUR_USERNAME/productdrivers.git
cd productdrivers
pnpm install
cd apps/dashboard
pnpm build

# Start with PM2
pm2 start pnpm --name "productdrivers" -- start
pm2 save
pm2 startup
```

**Nginx Configuration Example:**

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Updating Your Instance

```bash
# Pull latest changes
git pull origin main

# Install dependencies
pnpm install

# Apply new migrations (if any)
supabase db push

# Rebuild dashboard
cd apps/dashboard
pnpm build

# Restart (Vercel: automatic, PM2: manual)
pm2 restart productdrivers
```

### Production Security Checklist

- [ ] ✅ Use HTTPS in production (SSL certificate)
- [ ] ✅ Keep `SUPABASE_SERVICE_ROLE_KEY` secret (only in Edge Functions)
- [ ] ✅ Enable Supabase Row Level Security (RLS) policies
- [ ] ✅ Enable domain restriction for frontend projects
- [ ] ✅ Set up rate limiting on Edge Functions
- [ ] ✅ Configure regular Supabase database backups
- [ ] ✅ Monitor Supabase logs for suspicious activity
- [ ] ✅ Keep dependencies updated (`pnpm update`)
- [ ] ✅ Enable `blockPII: true` in SDK configuration

---

## 📂 Project Structure

```
productdrivers/
├── apps/
│   └── dashboard/          # Next.js analytics dashboard
├── packages/
│   ├── core/              # Shared types and utilities
│   ├── sdk-js/            # JavaScript/TypeScript SDK
│   ├── sdk-flutter/       # Flutter SDK
│   └── sdk-kotlin/        # Kotlin/Android SDK
├── supabase/
│   ├── functions/         # Edge Functions (API endpoints)
│   └── migrations/        # Database schema
└── docs/                  # Documentation
```

---

## 🛠️ Development

### Build SDKs

```bash
# Build all packages
pnpm build

# Build specific SDK
cd packages/sdk-js
pnpm build
```

### Run Tests

```bash
pnpm test
```

### Lint & Format

```bash
pnpm lint
pnpm format
```

---

## 🔐 Security Architecture

ProductDrivers implements **industry-leading security** with dual authentication modes to balance ease-of-use with enterprise-grade protection.

### 🎯 Dual Authentication Modes

#### 🌐 Frontend Mode (Public Key)
**For web apps, mobile apps, and user behavior tracking**

```typescript
// ✅ Safe to use in frontend code
init({
  projectKey: 'pk_xxxxxxxxxxxxx',  // Public key - safe to expose
  apiKey: 'your-supabase-anon-key',  // Supabase anon key - safe to expose
  apiBaseUrl: 'https://your-project.supabase.co/functions/v1',
  blockPII: true
});
```

**Security Features:**
- ✅ **API Key Validation**: Supabase anon key required for all requests
- ✅ **Domain Restriction**: Only specified domains can send events
- ✅ **Rate Limiting**: 1,000 requests/minute per project
- ✅ **Origin Validation**: HTTP Origin header checked
- ✅ **PII Detection**: Automatic blocking of sensitive data

**Use Cases:** User analytics, page views, clicks, feature usage, journey tracking

**Trade-off:** Keys are exposed (like Google Analytics), but protected by domain restriction, rate limits, and API key validation.

---

#### 🔐 Backend Mode (Secret Key + HMAC)
**For server-side integrations and sensitive business events**

```typescript
// ⚠️ Server-side only! Never in frontend!
import { signRequest } from '@productdrivers/sdk-js/signature';

const SECRET_KEY = process.env.PRODUCTDRIVERS_SECRET_KEY; // sk_xxxxx

const payload = {
  projectKey: 'pk_xxxxxxxxxxxxx',
  event: 'PURCHASE',
  userId: 'user_12345',
  value: 99.99
};

// Cryptographically sign the request
const signedPayload = await signRequest(SECRET_KEY, payload);

// Send to ProductDrivers
await fetch('https://your-project.supabase.co/functions/v1/track', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(signedPayload)
});
```

**Security Features:**
- 🔐 **HMAC-SHA256 Signatures**: Cryptographic request authentication
- 🕐 **Timestamp Validation**: Requests valid for 5 minutes only
- 🔄 **Replay Attack Prevention**: Signatures stored and checked
- 🎫 **Nonce Support**: Additional request uniqueness
- ♾️ **No Rate Limits**: Authenticated requests are unlimited

**Use Cases:** Payment events, subscription changes, admin actions, backend analytics, cron jobs

**Security Level:** 🏆 **Bank-grade** - Same technology as Stripe, AWS, and GitHub APIs

---

### 🔑 Key Management

| Key Type | Format | Exposure | Usage |
|----------|--------|----------|-------|
| **Project Key** | `pk_xxxxx` | ✅ Safe in frontend | Identifies your project |
| **Secret Key** | `sk_xxxxx` | ⚠️ NEVER expose | Signs backend requests |

**Getting Your Keys:**
1. Go to ProductDrivers Dashboard
2. Select your project → Getting Started
3. Copy both keys
4. Store `secret_key` in environment variables (never in code!)

---

### 🛡️ Built-in Security Features

#### PII Detection
```typescript
init({
  blockPII: true  // ✅ Recommended
});

// This will be BLOCKED automatically:
track({
  email: 'user@example.com',  // ❌ Detected
  phone: '+1-555-1234',        // ❌ Detected
  creditCard: '4111111111111111' // ❌ Detected
});
```

Automatically blocks:
- 📧 Email addresses
- 📱 Phone numbers
- 💳 Credit card numbers
- 🔢 Social Security Numbers
- 🌐 IP addresses

#### Domain Restriction (Web Only)
1. Go to Project Settings in dashboard
2. Set **Domain Restriction**: `yourdomain.com`
3. Only requests from `yourdomain.com` or `*.yourdomain.com` will be accepted

#### Row-Level Security (RLS)
- ✅ **All database tables protected** by Supabase RLS
- ✅ **Users can only read** their own project's data
- ✅ **Events can only be inserted** via Edge Functions (service role)
- ✅ **No direct database access** from SDKs

---

### 📊 Security Comparison

| Feature | ProductDrivers | Google Analytics | Mixpanel | Amplitude |
|---------|----------------|------------------|----------|-----------|
| **Frontend Auth** | ✅ Domain restriction | ✅ Referer | ⚠️ Token only | ⚠️ API Key only |
| **Backend Auth** | ✅ HMAC-SHA256 | ❌ None | ⚠️ Basic Auth | ✅ Secret Key |
| **Replay Protection** | ✅ Database-backed | ❌ No | ❌ No | ❌ No |
| **Rate Limiting** | ✅ 1000/min | ✅ Yes | ✅ Yes | ✅ Yes |
| **Self-Hosted** | ✅ Full control | ❌ SaaS only | ❌ SaaS only | ❌ SaaS only |

**Verdict:** ProductDrivers has **superior security** compared to industry leaders.

---

### 🏭 For Production

#### Web Apps ✅
```typescript
// .env.production
NEXT_PUBLIC_PRODUCTDRIVERS_PROJECT_KEY=pk_xxxxx
NEXT_PUBLIC_PRODUCTDRIVERS_API_URL=https://xxx.supabase.co/functions/v1

// Safe to expose - protected by domain restriction
```

#### Mobile Apps (iOS/Android) ⚠️
**Option 1 (Recommended):** Use frontend mode with rate limiting
- Project key can be reverse-engineered from APK/IPA
- Protected by rate limits (acceptable for user analytics)

**Option 2 (Maximum Security):** Server-side proxy
- Mobile app → Your backend → ProductDrivers (with HMAC)
- Project key never exposed

#### Backend Services 🔐
```bash
# .env (server)
PRODUCTDRIVERS_PROJECT_KEY=pk_xxxxx
PRODUCTDRIVERS_SECRET_KEY=sk_xxxxx  # ⚠️ Keep secret!
PRODUCTDRIVERS_API_URL=https://xxx.supabase.co/functions/v1
```

---

### 🚨 Security Best Practices

✅ **DO:**
- Enable `blockPII: true` in SDK configuration
- Use domain restriction for web apps
- Store secret keys in environment variables
- Use backend mode for sensitive business events
- Rotate secret keys if compromised (contact support)

❌ **DON'T:**
- Commit secret keys to Git repositories
- Use secret keys in frontend/mobile code
- Disable PII detection in production
- Use service_role key in client-side code

---

### 📚 Security Documentation

- [SECURITY_ARCHITECTURE.md](./SECURITY_ARCHITECTURE.md) - Complete technical architecture
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Security upgrade guide
- [SECURITY.md](./SECURITY.md) - Vulnerability reporting policy

---
 

---

## 📚 Documentation

- [Contributing Guide](CONTRIBUTING.md) - How to contribute
- [Code of Conduct](CODE_OF_CONDUCT.md) - Community guidelines

---

## 🤝 Contributing

We welcome contributions! Whether it's:
- 🐛 Bug fixes
- ✨ New features
- 📝 Documentation improvements
- 🌍 New SDK languages (Python, Ruby, Go, etc.)

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

ProductDrivers is open-source software licensed under the [MIT License](LICENSE).

---

## 🌟 Why ProductDrivers?

### vs. Mixpanel/Amplitude/Google Analytics
- ✅ **Self-hosted** - Your data stays on your infrastructure
- ✅ **Open source** - Full transparency and customization
- ✅ **No tracking** - We never see your data
- ✅ **Cost-effective** - No per-event pricing
- 🔐 **Security** - HMAC-SHA256 + Replay protection   

### vs. Self-built Analytics
- ✅ **Production-ready** - Battle-tested codebase
- ✅ **Multi-platform SDKs** - Save weeks of development
- ✅ **Rich UI** - Beautiful dashboards out of the box
- ✅ **Best practices** - GDPR compliance, PII detection built-in
- 🔐 **Security out-of-the-box** - Dual auth modes, rate limiting, RLS policies
- 📦 **Zero infrastructure work** - deploy to Supabase

---

## 💬 Community & Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/bhed/open-productdrivers/issues)
- **Discussions**: [Ask questions and share ideas](https://github.com/bhed/open-productdrivers/discussions) 

---

## 🙏 Acknowledgments

Built with:
- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Backend infrastructure
- [Shadcn UI](https://ui.shadcn.com/) - UI components 

---

**Made with ❤️ by bhed**

[⭐ Star us on GitHub](https://github.com/bhed/open-productdrivers) | [📖 Read the Docs](https://github.com/bhed/open-productdrivers/wiki)
