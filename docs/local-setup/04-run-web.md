# Step 4 — Run the web apps (Next.js)

There are four web apps. They're all **Next.js** and all talk to the API you started in Step 3. The only gotcha:
**Next.js defaults to port 3000, which the API already uses** — so we give each web app its own `-p` port.

Prerequisite: the **API (Step 3.1) is running on :3000**. (web-admin additionally needs **admin-api on :4001**.)

Each app: create its `.env.local`, then `pnpm dev -p <port>` in its own terminal (`nvm use` first).

> Why `.env.local`? Next.js reads `.env.local` for local overrides. `NEXT_PUBLIC_*` values are baked into the
> browser bundle (safe — they're just the API URL, no secrets).

---

## 4.1 web-storefront — public marketplace — port 3001

```bash
echo 'NEXT_PUBLIC_API_URL=http://localhost:3000' > apps/web-storefront/.env.local
nvm use
cd apps/web-storefront
pnpm dev -p 3001
```
Open <http://localhost:3001> → you should see the public marketplace (browse listings from the demo seed).

---

## 4.2 web-tenant — seller / tenant-admin console — port 3002

```bash
echo 'NEXT_PUBLIC_API_URL=http://localhost:3000' > apps/web-tenant/.env.local
nvm use
cd apps/web-tenant
pnpm dev -p 3002
```
Open <http://localhost:3002> → login with a demo seller (phone OTP — see Step 6.3 for how to read the OTP locally).

---

## 4.3 web-partner — financial/logistics partner portal — port 3003

```bash
echo 'NEXT_PUBLIC_API_URL=http://localhost:3000' > apps/web-partner/.env.local
nvm use
cd apps/web-partner
pnpm dev -p 3003
```
Open <http://localhost:3003>.

---

## 4.4 web-admin — platform god-mode console — port 3004 (needs admin-api on 4001)

This one talks to **admin-api** (Step 3.4), not the tenant API.
```bash
echo 'NEXT_PUBLIC_ADMIN_API_URL=http://localhost:4001' > apps/web-admin/.env.local
nvm use
cd apps/web-admin
pnpm dev -p 3004
```
Open <http://localhost:3004>. If pages error with "failed to fetch", confirm admin-api (3.4) is running on 4001.

---

## 4.5 First-load notes (normal, not errors)

- The **first** page load compiles on-demand and is slow (Next.js dev). Subsequent loads are fast.
- Pages that need login will redirect you to `/login`. That's expected — see **Step 6.3** for the local OTP login
  flow (you read the OTP from the API logs / dev response, no real SMS is sent locally).
- Empty lists are fine if you didn't run `pnpm seed:demo`. Re-run it (Step 2.5) to get demo content.

Web apps up? Continue to **`05-run-mobile.md`** (or jump to **`06-test-and-smoke.md`** if you don't need mobile).
