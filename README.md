# Purifies Vendor App

Vendor/shop owner dashboard for managing orders, inventory, and subscriptions.

## Setup

```bash
npm install
cp .env.example .env
# Fill in Firebase values in .env
npm run dev
```

## Scripts

- `npm run dev` — local dev server (port 3002)
- `npm run build` — production build
- `npm run preview` — preview production build

## Deploy (Netlify)

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- Add Firebase `VITE_*` environment variables in Netlify site settings.
