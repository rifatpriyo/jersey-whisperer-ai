# Final Deployment Checklist

## Vercel Deployment Only

1. Run the production build.

```powershell
npm run build
```

2. Confirm the static client entry exists.

```powershell
Test-Path dist/client/index.html
```

3. Check git status.

```powershell
git status
```

4. Stage changes.

```powershell
git add .
```

5. Commit the deployment fix.

```powershell
git commit -m "Final Vercel deployment fix"
```

6. Push to GitHub.

```powershell
git push origin main
```

7. In Vercel project settings, use:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist/client
Install Command: npm install
```

8. Add Vercel environment variables.

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
GEMINI_API_KEY
GROQ_API_KEY
```

9. Deploy to production.

```powershell
npx vercel --prod
```

10. Test production routes.

```text
/
/inventory
/ai-advisor
/forecast
/query-sim
```

## Netlify Deployment

Build command: `npm run build`

Publish directory: `dist/client`

Environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
GEMINI_API_KEY
GROQ_API_KEY
```

`GROQ_API_KEY` is required only if used.

Test after deploy:

```text
/
/inventory
/ai-advisor
/forecast
/query-sim
```
