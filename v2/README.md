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
- The image is shown as a single complete picture; the old numbered building markers and building-detail prototype are removed from this view.
- Hun, Seljuk and Göktürk choices currently switch the interface accent palette and persist the selected faction. They still share the uploaded village image until separate faction artwork is added.
