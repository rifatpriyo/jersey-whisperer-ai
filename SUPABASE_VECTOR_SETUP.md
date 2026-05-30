# Supabase Vector Setup

## 1. Create a Supabase project

Create a new Supabase project from the Supabase dashboard.

## 2. Open the SQL editor

In the Supabase dashboard:

1. Open `SQL Editor`
2. Copy the contents of `supabase/schema.sql`
3. Run the script

The script creates:

- `products`
- `trend_signals`
- `forecast_scores`
- `chat_logs`
- `product_embeddings`
- `trend_embeddings`
- `pgvector` search functions

## 3. Add environment variables locally

Add these to `.env.local`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 4. Add the same variables to Vercel

In the Vercel project settings, add:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 5. Build locally

```bash
npm run build
```

## 6. Run locally with Vercel

```bash
npx vercel dev
```

## 7. Deploy

```bash
npx vercel --prod
```

## Notes

- The app keeps `localStorage` fallback even when Supabase is not configured.
- For the preliminary demo, vector records use deterministic placeholder 384-d embeddings.
- Production should replace the demo embedding generator with a real embedding model output.
- Production should also replace the permissive anon RLS policies with merchant-authenticated access control.
