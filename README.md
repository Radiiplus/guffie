![Guffi Icon](./public/icons/icon-512x512.png)

# Guffi Frontend

Guffi is a real-time social web app focused on fast, expressive community interaction.  
This frontend powers:

- Public and anonymous posting
- Image-based posts and profiles
- Threaded comments and replies
- Global real-time chat
- Follow system and profile stats
- In-app + push notifications
- PWA install flow

## Tech Stack

- React + TypeScript
- Vite
- GraphQL (HTTP + WebSocket subscriptions)
- Tailwind CSS
- Framer Motion

## Project Structure

- `src/pages` — route pages (`home`, `create`, `chat`, `profile`, `settings`, etc.)
- `src/components` — reusable UI and feature components
- `src/lib` — API client, config, session, GraphQL client, app utilities
- `public` — manifest, service worker, and app icons

## Prerequisites

- Node.js 18+
- Running Guffi backend (GraphQL + WS)

## Environment Variables

Create/update `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000
VITE_GRAPHQL_URL=http://localhost:4000/graphql
VITE_WS_URL=ws://localhost:4000/graphql
VITE_IMAGE_URL=http://localhost:4000/img
VITE_VAPID_PUBLIC_KEY=your_public_vapid_key
```

## Run Locally

```bash
npm install
npm run dev
```

Frontend default dev URL: `http://localhost:5173`

## Scripts

- `npm run dev` — start Vite dev server
- `npm run build` — type-check and build production assets
- `npm run preview` — preview production build
- `npm run lint` — run ESLint

## PWA Notes

- Manifest: `public/manifest.json`
- Service Worker: `public/sw.js`
- Install prompt is triggered from the app when `beforeinstallprompt` is available.

## Backend Integration

This app expects the backend GraphQL schema and resolvers in this repository to be running and in sync.  
If GraphQL field errors appear, confirm frontend queries match `backend/src/lib/graph/schema.graphql`.

