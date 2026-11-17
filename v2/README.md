# Umaykut Online 2 V2

## Local development
- Node.js 20+
- Set DATABASE_URL to the Render PostgreSQL internal connection URL.
- Set SESSION_SECRET to a random secret of at least 32 characters.
- Migrations in `migrations/` are applied automatically at startup and tracked in `umaykut_v2.schema_migrations`.
- The isolated `umaykut_v2` schema keeps V2 accounts and game state separate from the legacy application's public-schema tables.
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
- The initial 1,800-worker pool is split between available workers and workers assigned to grain, wood and stone. Players can send workers to a region or recall them later. No production rates or resource yields are assumed yet.
- Worker assignments are saved in this browser's local storage, so they survive refreshes on the same device/browser. They are not yet synced across devices or accounts and are not yet stored in PostgreSQL.
- Distribution ratios and production rates remain undecided; no suggested 700/600/500 split or production coefficients are treated as approved game rules.

## Player game-state sync
- `GET /api/game/state` and `PUT /api/game/state` require a valid V2 bearer session.
- The selected faction and the 1,800-worker distribution across grain, wood and stone are stored per player in PostgreSQL.
- Existing browser-only worker assignments are imported once when a player first synchronizes. Later changes are saved to the player's account and are available across devices.
- This persistence step does not yet generate resources, charge construction costs, or change army counts; those gameplay systems are the next implementation stages.

## Buildings and upgrade costs
- Every account starts with a level-1 central building and eight available construction slots.
- A new building costs 30 wood, 20 stone and 5 iron.
- The next upgrade costs the base amount multiplied by the target level: level 2 costs 60 wood, 40 stone and 10 iron; level 3 costs 90 wood, 60 stone and 15 iron, continuing through level 10.
- Resource deductions and building levels are committed together in a database transaction; the server validates balances and prevents concurrent overspending.

## Expanded shared world map
- Each player has persistent world coordinates in PostgreSQL.
- The shared map contains 96 persistent randomized mine deposits (iron, stone and gold), each with a yield level from 4 to 9.
- Other founded player villages are returned with their world coordinates and shown as clickable map markers.
- The world map is a large two-axis scrollable canvas for mobile and desktop.
- The reconnaissance troop is displayed to players as Casus; the existing internal unit and mission identifiers remain stable for saved data compatibility.
