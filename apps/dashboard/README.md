# ProductDrivers Dashboard

Next.js dashboard for the ProductDrivers analytics platform.

> **📖 For initial setup and configuration**, see the [main README](../../README.md) in the repository root.

## Features

- 🔐 Supabase authentication with RLS
- 📊 Real-time analytics dashboards
- 📈 Journey funnel visualization  
- 💚 Satisfaction drivers analysis
- 💬 Survey response management
- ⚙️ Project settings
- 🎨 Modern UI with Tailwind CSS v4 and shadcn/ui

## Quick Start

After following the setup in the main README:

```bash
# From repository root
cd apps/dashboard

# Start dev server (or use 'pnpm dev' from root)
pnpm dev
```

The dashboard will be available at `http://localhost:3000`.

## Environment Configuration

See [`.env.example`](./.env.example) for the complete list of required environment variables.

**Required:**
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

The dashboard uses **only** the anon key (protected by RLS). The service role key is configured separately for Edge Functions.

## Project Structure

```
app/
├── page.tsx           # Root - redirects to /login
├── layout.tsx         # Root layout
├── login/             # Login page
├── signup/            # Signup page
├── app/               # Authenticated app routes
│   ├── layout.tsx     # App layout with sidebar
│   ├── page.tsx       # Overview dashboard
│   ├── projects/
│   │   ├── [id]/      # Project-specific pages
│   │   │   ├── getting-started/  # SDK setup guide
│   │   │   ├── journeys/         # Journey analytics
│   │   │   ├── drivers/          # Driver analysis
│   │   │   ├── feedback/         # Survey responses
│   │   │   ├── events/           # Events list
│   │   │   ├── user-behavior/    # Behavior tracking
│   │   │   └── settings/         # Project settings
│   │   └── new/       # Create new project
│   └── settings/      # Account & workspace settings
├── api/
│   ├── auth/          # Auth API routes
│   ├── projects/      # Projects API
│   └── sdk/           # SDK download endpoints
├── components/        # Reusable UI components
└── lib/
    ├── supabase/      # Supabase client & server utilities
    ├── export.ts      # Data export utilities
    └── utils.ts       # Shared utilities
```

## Routes

### Public Routes
- `/` - Redirects to `/login`
- `/login` - Sign in page
- `/signup` - Create account 

### Protected Routes (require authentication)
- `/app` - Overview dashboard with project stats
- `/app/projects/new` - Create a new project
- `/app/projects/[id]/getting-started` - SDK integration guide
- `/app/projects/[id]/overview` - Project overview
- `/app/projects/[id]/journeys` - Journey analytics & funnels
- `/app/projects/[id]/drivers` - Feature correlation analysis
- `/app/projects/[id]/feedback` - Survey responses
- `/app/projects/[id]/events` - Events list
- `/app/projects/[id]/user-behavior` - User behavior tracking
- `/app/projects/[id]/settings` - Project configuration
- `/app/settings` - Account & workspace settings

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy!

```bash
# Or use Vercel CLI
vercel
```

### Other Platforms

Build the production bundle:

```bash
pnpm build
```

Then deploy the `.next` folder to your hosting provider.

## Environment Variables Reference

### Required

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
  - Found in: Project Settings > API > Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key
  - Found in: Project Settings > API > Project API keys > anon public
  - Safe to expose in frontend code (protected by RLS)

### Optional

- `NEXT_PUBLIC_APP_URL` - Your dashboard URL (default: http://localhost:3000)
  - Used for redirects and absolute URLs

### Not Needed

- `SUPABASE_SERVICE_ROLE_KEY` - **NOT required for the dashboard**
  - Only used by Edge Functions in `supabase/functions/`
  - Configure this in Supabase Edge Functions settings, not here

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: TailwindCSS v4 shadcn
- **Auth**: Supabase Auth
- **Database**: Supabase (Postgres)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Date Handling**: date-fns

## Development Tips

### Supabase Local Development

```bash
# Start Supabase locally
supabase start

# Apply migrations
supabase db push

# Update types
supabase gen types typescript --local > types/database.ts
```

### Type Safety

This project uses TypeScript strict mode. Make sure to run type checks:

```bash
pnpm type-check
```

## License

MIT
