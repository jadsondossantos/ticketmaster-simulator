# Admin UI (ticketmaster-simulator)

React + TypeScript + Vite. This app is the **admin interface** for the simulator: it talks to the Fastify API under `/admin/*` using the `x-admin-key` header.

The API serves this UI as static files from **`ui/dist`** (same origin as the backend), so relative paths like `/admin/events` work without a separate API base URL.

## Prerequisites

- Node.js with **npm** (or **pnpm** if you use the repo lockfile)

## Install dependencies

```bash
cd ui
npm install
```

## Build (production assets)

From the `ui` directory:

```bash
npm run build
```

This runs `tsc -b` then `vite build` and writes output to **`ui/dist/`**.

To ship the full simulator (API + embedded UI), from the **repository root**:

```bash
cd ui && npm install && npm run build
cd ..
npm install
npm run build
npm start
```

Default server URL: `http://127.0.0.1:3100` (set `PORT` to change). Open that URL in a browser; the admin UI loads from `ui/dist`.

## Development

- **`npm run dev`** — Vite dev server with HMR (default port **5173**).  
  Requests go to the Vite origin, so **`/admin/*` calls will not reach Fastify** unless you add a dev proxy in `vite.config.ts` or run the UI built into `ui/dist` via the Node server as above.

- **`npm run preview`** — Serves the last **`npm run build`** output locally (useful to sanity-check the bundle; still a different origin than the API unless proxied).

- **`npm run lint`** — ESLint.

## Environment

The UI prompts for an **admin key** in the app (stored only in memory). It must match the server’s `ADMIN_API_KEY` (default `dev-admin-key`).
