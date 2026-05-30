# Final Deployment Checklist

## 1. Kill port 3000 if needed

```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

## 2. Run local dev

```powershell
npm run dev:3000
```

If port 3000 is busy:

```powershell
npm run dev:5173
```

## 3. Build

```powershell
npm run build
```

## 4. Commit and push

```powershell
git status
git add .
git commit -m "Final JerseyBecho AI deployment build"
git push origin main
```

## 5. Deploy

```powershell
npx vercel --prod
```

## 6. Vercel settings

Framework Preset: Vite

Build Command: `npm run build`

Output Directory: `dist/client`

Install Command: `npm install`

## 7. Required Vercel environment variables

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
GEMINI_API_KEY
GROQ_API_KEY
```

`GROQ_API_KEY` is required only if the Groq endpoint is used.

## 8. Test URLs

```text
/
/inventory
/ai-advisor
/forecast
/query-sim
```
