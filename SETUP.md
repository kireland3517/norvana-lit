# NORVANA Literature Order System — Setup Guide

## Overview

| Page | URL | Who uses it |
|---|---|---|
| Order Form | `/` | Group contacts |
| Admin Dashboard | `/admin.html` | Lit Chair |
| Catalog Manager | `/admin-catalog.html` | Lit Chair |

---

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **New Project**, give it a name like `norvana-lit`
3. Set a database password (save it somewhere safe)
4. Once the project loads, go to **SQL Editor**
5. Open `supabase/schema.sql` from this repo and paste the entire contents into the editor
6. Click **Run** — this creates all tables and seeds the groups + catalog items
7. Go to **Project Settings → API**
   - Copy your **Project URL** → this is `SUPABASE_URL`
   - Copy your **service_role** key (not the anon key) → this is `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2: Set Up Gmail for Email Sending

1. Use a Gmail account (create a dedicated one like `norvana.lit@gmail.com` if desired)
2. Make sure **2-Step Verification** is enabled on that account
3. Go to: Google Account → Security → 2-Step Verification → **App passwords**
4. Create an app password (select "Mail" + "Other", name it "NORVANA")
5. Copy the 16-character password → this is `GMAIL_APP_PASSWORD`

---

## Step 3: Deploy to Vercel

1. Create a [GitHub](https://github.com) account if you don't have one
2. Create a new repository and push this project folder to it:
   ```bash
   cd norvana-lit
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/norvana-lit.git
   git push -u origin main
   ```
3. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account
4. Click **Add New Project** → import your `norvana-lit` repo
5. Before deploying, click **Environment Variables** and add all 6 variables:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key |
| `GMAIL_USER` | your.gmail@gmail.com |
| `GMAIL_APP_PASSWORD` | The 16-char app password |
| `LIT_CHAIR_EMAIL` | Email address for the Lit Chair |
| `ADMIN_PASSWORD` | Any strong password you choose |

6. Click **Deploy** — Vercel will give you a free URL like `norvana-lit.vercel.app`

---

## Step 4: Test It

1. Visit your Vercel URL — you should see the order form
2. Select a group, fill in contact info, add items, and submit
3. Check that both confirmation and alert emails arrive
4. Visit `/admin.html`, enter the admin password
5. Find the pending order, adjust quantities, click "Mark Ready"
6. Check that the "order ready" email arrives at the group contact's email

---

## Local Development (optional)

```bash
# Install dependencies
npm install

# Install Vercel CLI
npm install -g vercel

# Run locally (reads .env.local automatically)
vercel dev
```

The app will run at `http://localhost:3000`.

---

## Notes

- **Cycle logic**: The system automatically detects the current service cycle based on the first Thursday of each month. No manual cycle setup is needed — cycles are created automatically when the first order of a new cycle is submitted.
- **Item 3124**: Appears twice — `3124` is the 5-pack pamphlet ($2.80) in Pamphlets, and `3124SO` is the single-copy Special Order ($0.56). Both are in the catalog.
- **Admin password**: Stored in browser `sessionStorage` — it clears when the tab is closed. The Lit Chair will need to re-enter it each browser session.
- **Email failures**: If an email fails to send, the order is still saved in the database. The Lit Chair can always find it in the admin dashboard.
