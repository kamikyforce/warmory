# warmane-armory-bot

Discord interactions bot that renders Warmane‑style cards and UwU Logs scoreboards.

## Features
- Slash commands
  - `/armory` — Warmane Armory style equipment card
  - `/talents` — Warmane talents card (trees + glyphs)
  - `/uwulogs` — UwU Logs scoreboard (ICC bosses, ranks, points, DPS)
- Canvas renderer using Cloudflare Browser binding (Puppeteer API)
- Data caching on Cloudflare D1 (armory + item lookups)
- Robust fallbacks:
  - UwU canvas auto‑retries on 429 and falls back to a text embed when rate‑limited
  - UwU scraper normalizes character/server and retries if the API returns 422
  - Spec can be number (1–3) or string alias by class (e.g., `destro`, `ret`, `frost`)

## Prereqs
- Node 18+ locally (for helper scripts)
- Cloudflare account with:
  - D1 database bound as `DB`
  - Browser binding bound as `MYBROWSER`

## Config
`wrangler.toml` (key parts):

```toml
name = "warmane-armory-bot"
main = "src/worker.js"
compatibility_flags = ["nodejs_compat"]

[vars]
DISCORD_APPLICATION_ID = "1411387481890226207"
REALM_DEFAULT = "Icecrown"

[[d1_databases]]
binding = "DB"
database_name = "warmane-armory-db"

[browser]
binding = "MYBROWSER"
```

`.env` (local helper scripts):
```
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=1411387481890226207
GUILD_ID=your_test_guild_id    # optional, for guild-scoped register
```

Set Discord public key secret in the worker (once):
```
npx wrangler secret put DISCORD_PUBLIC_KEY
```
Paste the app’s Public Key from the Discord Developer Portal.

## Install the app in a server
- Slash only:
  - https://discord.com/oauth2/authorize?client_id=1411387481890226207&scope=applications.commands
- Slash + bot user:
  - https://discord.com/oauth2/authorize?client_id=1411387481890226207&scope=applications.commands%20bot&permissions=0

## Register slash commands
Guild‑scoped (instant):
```
# .env must contain GUILD_ID
node scripts/register-commands.js
```
Global (propagates gradually):
```
# temporarily unset GUILD_ID for this run
GUILD_ID= node scripts/register-commands.js
```
Clear commands:
```
node clear-commands.js
```

Verify (optional):
```
curl -H "Authorization: Bot $DISCORD_TOKEN" \
  https://discord.com/api/v10/applications/$DISCORD_CLIENT_ID/guilds/$GUILD_ID/commands
```

## Local dev
```
npm start               # wrangler dev
# or for real Discord callbacks use a public URL:
npx wrangler dev --remote
```
Set the “Interactions Endpoint URL” in the Discord app to the dev URL if you want live callbacks from Discord in dev. Using a separate “Dev” application is recommended.

## Deploy
```
npx wrangler deploy
```
Make sure the worker name in `wrangler.toml` is `warmane-armory-bot`.

## Usage
Examples:
```
/armory  character: Muus  realm: Icecrown
/talents character: Muus  realm: Icecrown
/uwulogs name: Muus server: Icecrown spec: frost
/uwulogs name: Trycker server: Icecrown spec: destro
/uwulogs name: Trycker server: Icecrown spec: 3
```
Spec aliases by class (WotLK 3.3.5a order):
- Death Knight: `blood`, `frost`, `unholy`
- Druid: `balance`, `feral` (or `feral combat`), `resto`
- Hunter: `bm`, `mm`, `surv`
- Mage: `arcane`, `fire`, `frost`
- Paladin: `holy`, `prot`, `ret`
- Priest: `disc`, `holy`, `shadow`
- Rogue: `assass`, `combat`, `sub`
- Shaman: `ele`, `enh`, `resto`
- Warlock: `aff`, `demo`, `destro`
- Warrior: `arms`, `fury`, `prot`

If a spec string is provided, the command fetches once to detect the class, maps to 1–3 for that class, and refetches for exact spec.

## Logs & troubleshooting
Tail deployed logs:
```
npx wrangler tail warmane-armory-bot --format pretty
npx wrangler tail warmane-armory-bot --format pretty --status error
```
Common cases:
- 429 on canvas: renderer auto‑retries with backoff and falls back to a text embed
- 422 from UwU `/character`: scraper normalizes name/server and retries (spec 1 as last resort)
- Slash UI shows old types (e.g., “spec must be integer”): re‑register commands for that guild and restart Discord
- 401 when registering: wrong `DISCORD_TOKEN` or mismatched application; reset token in the Portal and update `.env`

## Structure
- Commands:
  - `src/commands/armory.js`
  - `src/commands/talents.js`
  - `src/commands/uwulogs.js`
- Renderers:
  - `src/render/armoryCard.js`
  - `src/render/talentsCard.js`
  - `src/render/uwulogsCard.js`
- Scrapers:
  - `src/scrape/warmane.js`
  - `src/scrape/uwulogs.js`
- Worker entry: `src/worker.js`
- Scripts: `scripts/register-commands.js`, `clear-commands.js`

## Security
- Never commit tokens. `.env` is git‑ignored.
- Rotate Discord bot token if it’s exposed.
- Keep the public key in Worker secret `DISCORD_PUBLIC_KEY`.

## License
MIT

