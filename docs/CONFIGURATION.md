# Configuration

All configuration is via environment variables in `solution/.env`. Copy `solution/.env.example` to start.

---

## Environment Variables

### `ANTHROPIC_API_KEY` *(required)*

Your Anthropic API key. Get one at [console.anthropic.com](https://console.anthropic.com).

The key is used server-side only — never sent to the client. If missing, the app starts but every chat request fails with an auth error from the Anthropic API.

---

### `DATABASE_URL` *(required)*

Your Neon pooled Postgres connection string. Use the pooler URL for Vercel/serverless deployments.

Example:

```env
DATABASE_URL=postgres://user:password@ep-example-pooler.region.aws.neon.tech/dbname?sslmode=require
```

The app uses this database for chat history and rate limiting. Schema creation is lazy and idempotent: the first database access creates the `chats`, `messages`, and `rate_limit` tables if they do not already exist. The canonical schema is also checked in at `solution/db/schema.sql`.

---

### `DEFAULT_MODEL`

**Type:** string  
**Default:** `claude-sonnet-4-6`  
**Options:** `claude-sonnet-4-6` | `claude-haiku-4-5`

The model used for all chat requests. When `MODEL_SWITCHING_ALLOWED=false`, this is the only model that will ever be used. When switching is allowed, this is the model pre-selected in the UI.

The model name is validated at runtime against the allowlist in `lib/anthropic.ts`. An unrecognised value falls back to `claude-sonnet-4-6`.

**Tradeoff:** Haiku is ~10x cheaper and faster; Sonnet produces significantly better artifact HTML and more accurate citations. For a demo where response quality is the point, Sonnet is recommended.

---

### `MODEL_SWITCHING_ALLOWED`

**Type:** `"true"` | `"false"`  
**Default:** `false` (if unset, treated as false)

When `true`, a model toggle appears in the header and users can switch between Sonnet and Haiku mid-conversation. The selected model is sent with each request and validated server-side.

When `false`, the header shows a read-only model badge instead. The model used is always `DEFAULT_MODEL`.

**Recommendation:** Set to `true` for local development and reviewer demos. Leave `false` for a hosted public deployment where cost predictability matters.

---

### `RATE_LIMIT_REQUESTS`

**Type:** integer  
**Default:** `10`

Maximum number of chat requests allowed per client per window. Applies per unique `SHA256(ip:fingerprint)`.

When the limit is reached:
- The API returns HTTP 429 with `reset_at` (Unix ms timestamp)
- The UI shows a countdown badge and disables the input
- The rate limit info (used / limit / reset_at) is also returned as response headers on every successful request so the UI can update proactively

---

### `RATE_LIMIT_WINDOW_MINUTES`

**Type:** integer  
**Default:** `60`

Rolling window duration in minutes. The window slides — it's not a fixed hourly bucket. Each request expires individually `RATE_LIMIT_WINDOW_MINUTES` after it was made.

---

## Common Configurations

### Local development (permissive)

```env
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgres://...
DEFAULT_MODEL=claude-sonnet-4-6
MODEL_SWITCHING_ALLOWED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_MINUTES=60
```

### Hosted reviewer demo

```env
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgres://...
DEFAULT_MODEL=claude-sonnet-4-6
MODEL_SWITCHING_ALLOWED=false
RATE_LIMIT_REQUESTS=15
RATE_LIMIT_WINDOW_MINUTES=60
```

### Cost-optimised demo

```env
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgres://...
DEFAULT_MODEL=claude-haiku-4-5
MODEL_SWITCHING_ALLOWED=false
RATE_LIMIT_REQUESTS=20
RATE_LIMIT_WINDOW_MINUTES=60
```

---

## Vercel + Neon

In Vercel, set the project root directory to `solution` and configure these environment variables for Production and Preview:

- `ANTHROPIC_API_KEY`
- `DATABASE_URL`
- `DEFAULT_MODEL`
- `MODEL_SWITCHING_ALLOWED`
- `RATE_LIMIT_REQUESTS`
- `RATE_LIMIT_WINDOW_MINUTES`

Use Neon's pooled connection string for `DATABASE_URL`. If you connect Neon through the Vercel integration, confirm the injected variable name is exactly `DATABASE_URL`.
