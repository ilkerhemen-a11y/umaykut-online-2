# Umaykut Online 2 V2
## Local development
- Node.js 20+
- Set DATABASE_URL to the Render PostgreSQL internal connection URL.
- Set SESSION_SECRET to a random secret of at least 32 characters.
- Apply migrations/001_accounts.sql once using a trusted PostgreSQL connection.
- Run npm install, npm test, then npm start.
## Render configuration (V2 service only)
- Root directory: v2
- Build command: npm install
- Start command: npm start
- Health check path: /health
- Environment variables: DATABASE_URL (secret, internal URL), SESSION_SECRET (secret, 32+ random characters), NODE_ENV=production.
The existing production service is not modified by this V2 branch. Never add database credentials to GitHub.
