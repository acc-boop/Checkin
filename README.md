# ◎ Accountable — Production Deployment Guide

## Architecture

```
Browser → Render (static site + Express) → Supabase (PostgreSQL)
```

- **Frontend**: React 18 + Vite (builds to static files)
- **Server**: Express serves the static build + handles SPA routing
- **Database**: Supabase (PostgreSQL with a simple key-value table)
- **Hosting**: Render (auto-deploys from GitHub)

---

## Step 1 — Supabase Setup

1. Go to [supabase.com](https://supabase.com) and create a **new project**
2. Pick a name (e.g. `accountable`), set a database password, choose a region close to your users
3. Wait for the project to finish provisioning (~2 min)

### Create the database table

4. In your Supabase dashboard, go to **SQL Editor** → **New Query**
5. Paste the contents of `supabase-setup.sql` and click **Run**
6. You should see the `kv_store` table appear under **Table Editor**

### Get your credentials

7. Go to **Settings** → **API**
8. Copy these two values (you'll need them in Step 3):
   - **Project URL** → e.g. `https://abcdefg.supabase.co`
   - **anon / public** key → starts with `eyJ...`

---

## Step 2 — GitHub Setup

1. Create a new repository on [github.com](https://github.com) (e.g. `accountable`)
2. Push this project:

```bash
cd accountable
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/accountable.git
git push -u origin main
```

---

## Step 3 — Render Setup

1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your GitHub repo (`accountable`)
3. Configure:
   - **Name**: `accountable`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Add **Environment Variables**:
   - `VITE_SUPABASE_URL` → your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon key
5. Click **Create Web Service**

Render will build and deploy. Your app will be live at `https://accountable-xxxx.onrender.com`.

> **Important**: The `VITE_` prefix is required — Vite embeds these at build time.

---

## Step 4 — Verify

1. Open your Render URL
2. You should see the CEO setup screen
3. Create your account — data is now stored in Supabase
4. Check Supabase **Table Editor** → `kv_store` to confirm rows are being written

---

## Local Development

```bash
# 1. Copy env file and fill in your Supabase credentials
cp .env.example .env

# 2. Install dependencies
npm install

# 3. Start dev server
npm run dev
```

App runs at `http://localhost:3000`

---

## Custom Domain (Optional)

In Render dashboard → your service → **Settings** → **Custom Domains**.
Add your domain and update DNS as instructed.

---

## Updating

Push to `main` on GitHub → Render auto-deploys within ~2 minutes.

```bash
git add .
git commit -m "Update"
git push
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank screen | Check browser console for Supabase errors. Verify env vars are set in Render. |
| "Missing Supabase credentials" | Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. Redeploy after adding. |
| Data not saving | Check that `kv_store` table exists and RLS policy is created. Run `supabase-setup.sql` again. |
| 404 on refresh | The Express server handles SPA routing — make sure `npm start` is the start command. |
| Build fails on Render | Ensure Node 20 is selected. Check build logs for missing deps. |

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
