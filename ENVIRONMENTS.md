# Environment Setup Guide

This project supports multiple environments: **local development**, **staging**, and **production**.

## Quick Start (Local Development)

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm or yarn

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Local Databases

```bash
npm run db:up
```

This starts 4 MySQL containers:

- **Auth DB**: `localhost:3306` (accounts & characters)
- **WOTLK DB**: `localhost:3307` (classical realm)
- **IP DB**: `localhost:3308` (IP progression realm)
- **IP Boosted DB**: `localhost:3309` (boosted realm)

**Credentials:**

- Username: `wow_dev`
- Password: `dev_password`
- Root password: `root_password`

### 3. Start Development Server

```bash
npm run dev:local
```

Visit `http://localhost:3000`

**Local Dev Features:**

- ✅ Mocked authentication (auto-logs in as `admin`)
- ✅ SQLite database for account mappings (`data/mappings.db`)
- ✅ Debug mode enabled
- ✅ Hot reload on file changes

---

## Environment Configurations

### Local Development (`.env.local`)

```
NODE_ENV=development
NUXT_PUBLIC_AUTH_MODE=mock
NUXT_PUBLIC_MOCK_USER=admin
NUXT_PUBLIC_DB_HOST=localhost
NUXT_PUBLIC_DB_PORT=3306
```

**Use when:** Developing locally with mocked auth

**Run with:**

```bash
npm run dev:local
```

---

### Staging (`.env.staging`)

```
NODE_ENV=staging
NUXT_PUBLIC_AUTH_MODE=keycloak
NUXT_PUBLIC_KEYCLOAK_URL=https://keycloak-staging.example.com
NUXT_PUBLIC_DB_HOST=wow-acore-db-staging
```

**Use when:** Testing against staging Kubernetes cluster

**Setup:**

1. Update `NUXT_PUBLIC_KEYCLOAK_URL` to your staging Keycloak
2. Ensure VPN/network access to staging databases
3. Run:

```bash
npm run dev:staging
```

Or build for staging:

```bash
npm run build:staging
npm run preview:staging
```

---

### Production (`.env.production`)

```
NODE_ENV=production
NUXT_PUBLIC_AUTH_MODE=oauth-proxy
NUXT_PUBLIC_DB_HOST=wow-acore-db
```

**Use when:** Deployed on Kubernetes with oauth-proxy

**Build for production:**

```bash
npm run build:production
```

---

## Database Management

### View Database Logs

```bash
npm run db:logs
```

### Stop Databases

```bash
npm run db:down
```

### Reset Databases (delete all data)

```bash
npm run db:down
npm run db:up
```

### Tunnel Production Databases Locally

If you have SSH access to your cluster, tunnel the databases:

```bash
# Auth database
ssh -L 3306:wow-acore-auth-db:3306 user@cluster-bastion

# In another terminal, WOTLK
ssh -L 3307:wow-acore-db:3306 user@cluster-bastion

# In another terminal, IP
ssh -L 3308:wow-acore-db-ip:3306 user@cluster-bastion
```

Then use these in `.env.local`:

```
NUXT_PUBLIC_DB_HOST=localhost
NUXT_PUBLIC_DB_PORT=3306
NUXT_PUBLIC_AUTH_DB_HOST=localhost
NUXT_PUBLIC_AUTH_DB_PORT=3306
```

---

## Authentication Modes

### Mock (Local Development)

- Auto-authenticates as configured user
- No external services needed
- Perfect for UI development

```env
NUXT_PUBLIC_AUTH_MODE=mock
NUXT_PUBLIC_MOCK_USER=admin
NUXT_PUBLIC_MOCK_EMAIL=admin@localhost
```

### Keycloak (Staging)

- Reads from Keycloak instance
- Requires valid credentials
- Supports OIDC flow

```env
NUXT_PUBLIC_AUTH_MODE=keycloak
NUXT_PUBLIC_KEYCLOAK_URL=https://keycloak-staging.example.com
NUXT_PUBLIC_KEYCLOAK_REALM=wow-staging
```

### OAuth-Proxy (Production)

- Headers set by reverse proxy (`X-Remote-User`, `X-Auth-Request-Email`)
- Keycloak validates auth before request reaches app
- No auth logic needed in frontend

```env
NUXT_PUBLIC_AUTH_MODE=oauth-proxy
```

---

## Feature Flags

### Debug Mode

```env
NUXT_PUBLIC_DEBUG_MODE=true
```

Enables:

- Verbose logging
- Error details in UI
- DevTools

### Mock Accounts

```env
NUXT_PUBLIC_MOCK_ACCOUNTS=true
```

Returns fake account data in development (useful for UI testing without real databases).

---

## Deployment

### Docker Build (Multi-Environment)

```dockerfile
# Build for staging
docker build --build-arg NODE_ENV=staging -t wow-frontend:staging .

# Build for production
docker build --build-arg NODE_ENV=production -t wow-frontend:latest .
```

### Kubernetes Deployment

Update your deployment manifests to pass environment:

```yaml
env:
  - name: NODE_ENV
    value: production
  - name: NUXT_PUBLIC_AUTH_MODE
    value: oauth-proxy
  - name: NUXT_PUBLIC_KEYCLOAK_URL
    value: https://keycloak.example.com
```

---

## Troubleshooting

### "Database connection refused"

1. Check if containers are running: `docker ps`
2. Restart: `npm run db:down && npm run db:up`
3. Check logs: `npm run db:logs`

### "Not authenticated" (local dev)

1. Clear browser cache
2. Restart dev server: `npm run dev:local`
3. Check `.env.local` has `NUXT_PUBLIC_AUTH_MODE=mock`

### Port already in use

Change ports in `docker-compose.local.yml` and `.env.local`

### oauth-proxy headers not received (staging)

Ensure request goes through oauth-proxy. Headers format:

- `X-Remote-User: username`
- `X-Auth-Request-Email: user@example.com`

---

## File Structure

```
.
├── .env.local           # Local development config
├── .env.staging         # Staging config
├── .env.production      # Production config
├── nuxt.config.ts       # Loads runtimeConfig from env
├── docker-compose.local.yml  # Local MySQL services
├── server/
│   └── api/
│       └── auth/
│           └── me.get.ts    # Auth mode-aware endpoint
└── app/
    └── stores/
        └── auth.ts      # Uses runtimeConfig for mock auth
```

---

## Environment Variables Reference

| Variable                   | Local                   | Staging       | Prod          | Description       |
| -------------------------- | ----------------------- | ------------- | ------------- | ----------------- |
| `NODE_ENV`                 | `development`           | `staging`     | `production`  | Build environment |
| `NUXT_PUBLIC_AUTH_MODE`    | `mock`                  | `keycloak`    | `oauth-proxy` | Auth method       |
| `NUXT_PUBLIC_DB_HOST`      | `localhost`             | cluster DNS   | cluster DNS   | Database host     |
| `NUXT_PUBLIC_DEBUG_MODE`   | `true`                  | `false`       | `false`       | Debug logging     |
| `NUXT_PUBLIC_KEYCLOAK_URL` | `http://localhost:8080` | HTTPS staging | N/A           | Keycloak endpoint |
