# CILRMNG Membership Registry — Deployment & Reuse Guide

This package contains the complete, self-contained source code of the
Chartered Institute of Loan & Risk Management of Nigeria membership registry.
Anyone with this file can run the app on any computer or host it online —
making the app fully **reusable and portable**.

---

## What's inside

| Folder / file        | Purpose                                                   |
|----------------------|-----------------------------------------------------------|
| `src/`               | The whole application (pages, admin, guest portal, APIs)  |
| `public/`            | Institute crest, offline service worker, PWA manifest     |
| `scripts/seed.mjs`   | Loads the sample register (29 rows) on first run          |
| `drizzle.config.json`| Database connection for schema pushes                     |
| `package.json`       | All dependencies — installed with one command             |

---

## 1. Run on any computer (offline office use)

Requirements: **Node.js 20+** and **PostgreSQL 14+** (both free).

```bash
# 1. Unzip, then inside the folder:
npm install

# 2. Create a database and point the app at it (edit .env):
#    DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/cilrm_registry

# 3. Create the tables:
npx drizzle-kit push

# 4. (Optional) load the sample register:
node scripts/seed.mjs

# 5. Build and start:
npm run build
npm start
```

Open `http://localhost:3000` — the first visitor completes the **one-time
root admin sign-up** at `/setup`. Other computers on the same office network
can use `http://<that-computer's-IP>:3000`.

## 2. Host online with a permanent custom link

The code deploys unchanged to any Node.js host. Easiest path:

1. **Vercel** (free): import this folder as a project, add a free
   **Neon.tech** PostgreSQL database, set `DATABASE_URL` in project settings.
2. Add your domain, e.g. **registry.cilrmng.org** (one CNAME record).
3. Run `npx drizzle-kit push` once against the database.

Your links then never change:
- Guest portal → `https://registry.cilrmng.org/guest`
- Admin sign-in → `https://registry.cilrmng.org/login`

Alternatives: Railway, Render, Fly.io, or any Nigerian VPS with
`node >= 20` + Postgres.

## 3. Moving your data between installations

- **Take data out:** Admin → Sync/Upload → *Vault & backups* → download any
  snapshot as **CSV** or **JSON** (works on this install too).
- **Bring data in:** Admin → Sync/Upload → upload that CSV — columns map
  automatically; duplicates are ignored.

So: install anywhere → upload your latest CSV → the registry is live with
all records. The app file + a CSV backup on a flash drive = a complete,
restorable copy of the institute's registry.

## Key built-in features

- One-time root sign-up (`/setup`); root is permanent and can never be removed
- Admins sign in with any personal/office email; 30-day rolling sessions
- Excel/CSV/paste import, up to 100,000 rows; duplicate-proof (name,
  registration number, phone, e-mail)
- Guest portal: search, view, print (A4 + crest watermark), download — read-only
- Reusable Guest Portal Links + direct record links (permanent until revoked)
- Live counters of admins & guests online; works offline after first sync
- Automatic vault snapshots + 30-day activity-log retention

Support contact configured in the app: Settings → Organisation.
