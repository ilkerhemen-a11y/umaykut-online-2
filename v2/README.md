# Umaykut Online 2 V2

## Local development
- Node.js 20+
- Set DATABASE_URL to the Render PostgreSQL internal connection URL.
- Set SESSION_SECRET to a random secret of at least 32 characters.
- Apply `migrations/001_accounts.sql` once using a trusted PostgreSQL connection.
- The migration creates the isolated `umaykut_v2` schema. V2 account tables do not share the legacy application's public-schema table names.
- Run `npm install`, `npm test`, then `npm start`.

## Render configuration (V2 service only)
- Root directory: `v2`
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/health`
- Environment variables: `DATABASE_URL` (secret, internal URL), `SESSION_SECRET` (secret, 32+ random characters), `NODE_ENV=production`.
- `/ready` performs a real database query and returns 503 until the database is reachable.

The existing production service is not modified by this V2 branch. Never add database credentials to GitHub.

## Village image status
- The village screen displays the uploaded photo at `../public/assets/IMG-20261117-WA0073.jpg`, served at `/assets/IMG-20261117-WA0073.jpg`.
- The image is shown as a single complete picture with nine compact numbered overlays: 1 for the central building and 2–9 for the surrounding buildings. The labels are positioned proportionally so they remain aligned on mobile screens.
- Göktürk is the default starting faction and is the faction associated with this uploaded village artwork.
- Hun, Seljuk and Göktürk choices switch the interface accent palette and persist the selected faction. Separate Hun and Seljuk village artwork can be connected when those image files are added.

## Map interface prototype
- The bottom navigation switches between the village and a shared 2D world map.
- The map currently shows the player's city and three selectable resource areas: grain, wood and stone.
- The initial worker pool is 1,800, with zero workers assigned.
- Selecting a resource and assigning workers updates a temporary in-browser preview only. It is not persisted and does not change server-side production or the PostgreSQL database yet.
- Distribution ratios and production rates remain undecided; no suggested 700/600/500 split or production coefficients are treated as approved game rules.
