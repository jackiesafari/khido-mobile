# Deploy Khido API to Railway

Follow these steps to deploy your API so the app works for real users (including App Store).

---

## Prerequisites

- GitHub account (your project pushed to a repo)
- Railway account (free at [railway.app](https://railway.app))
- OpenAI API key

---

## Step 1: Push Your Code to GitHub

If you haven't already:

```bash
cd "/Users/jackiebrain/Desktop/khiddo 2026"
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/khido.git
git branch -M main
git push -u origin main
```

---

## Step 2: Create a Railway Project

1. Go to [railway.app](https://railway.app) and sign in (GitHub login works).
2. Click **New Project**.
3. Choose **Deploy from GitHub repo**.
4. Select your `khido` repository (or connect GitHub if needed).
5. Railway will create a new service.

---

## Step 3: Configure the Service

1. Click on the new service.
2. Go to **Settings**.
3. Set **Root Directory** to `api` (so Railway uses the `api/` folder).
4. Under **Variables**, add:
   - `OPENAI_API_KEY` = your OpenAI API key (the same one in your .env)
5. Railway will auto-detect Node.js and run `npm start` from the `api` folder.

---

## Step 4: Deploy

1. Click **Deploy** (or push a new commit to trigger a deploy).
2. Once deployed, go to **Settings** → **Networking** → **Generate Domain**.
3. Copy the URL (e.g. `https://khido-mobile-production.up.railway.app`).

---

## Step 5: Point the App to Railway

Add this to your **.env** file:

```
EXPO_PUBLIC_CHAT_API_URL=https://YOUR-RAILWAY-URL.up.railway.app
EXPO_PUBLIC_AUTH_BRIDGE_URL=https://YOUR-RAILWAY-URL.up.railway.app/auth/callback
```

Replace with your actual Railway URL (no trailing slash). Use the **exact** subdomain (e.g. `khido-mobile-production`) that Railway assigned.

---

## Step 5b: Configure Supabase for Magic Links

For email magic links to redirect back into the app, configure Supabase:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **URL Configuration**.
2. Under **Redirect URLs**, add:
   ```
   https://khido-mobile-production.up.railway.app/auth/callback
   ```
   (Replace with your actual Railway URL if different. Or use a wildcard: `https://*.up.railway.app/auth/callback`.)
3. **Important:** Set **Site URL** to your auth callback, NOT the API root:
   ```
   https://khido-mobile-production.up.railway.app/auth/callback
   ```
   If Site URL is set to the API root (`https://...railway.app/`), users will land on a JSON page instead of being redirected back to the app. The auth callback page is what forwards them into Khido.

---

## Step 6: Rebuild the App for Production

When building for the App Store (or testing a production build):

```bash
# Make sure .env has EXPO_PUBLIC_CHAT_API_URL set
npx expo prebuild
# or with EAS Build:
eas build --platform ios --profile production
```

The app will use your Railway URL when not in development mode.

---

## Summary

| Step | Action |
|------|--------|
| 1 | Push code to GitHub |
| 2 | Create Railway project from repo |
| 3 | Set Root Directory = `api`, add OPENAI_API_KEY variable |
| 4 | Deploy, generate domain, copy URL |
| 5 | Add EXPO_PUBLIC_CHAT_API_URL to .env with your Railway URL |
| 6 | Rebuild app for production |

---

## Local Development

Nothing changes locally. Run:

```bash
npm run dev
```

The app will still use `localhost:3001` in development.
