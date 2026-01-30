# Configuration Reference

Complete reference for all configuration options in the Azeroth Management Portal.

## Table of Contents

- [Environment Variables](#environment-variables)
- [Database Configuration](#database-configuration)
- [Realm Configuration](#realm-configuration)
- [Public Configuration](#public-configuration)
- [Adding a New Realm](#adding-a-new-realm)

## Environment Variables

All configuration is done via environment variables. This makes the application portable and Kubernetes-friendly.

### Configuration Files

| File           | Purpose                         | Git       |
| -------------- | ------------------------------- | --------- |
| `.env.example` | Template with all options       | Committed |
| `.env.local`   | Local development configuration | Ignored   |
| `.env`         | Production configuration        | Ignored   |

For local development, copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

For Kubernetes deployments, set environment variables via ConfigMaps and Secrets.

## Database Configuration

### Auth Database

The auth database (acore_auth) is shared across all realms:

| Variable                | Description       | Default     |
| ----------------------- | ----------------- | ----------- |
| `NUXT_DB_AUTH_HOST`     | Database hostname | `localhost` |
| `NUXT_DB_AUTH_PORT`     | Database port     | `3306`      |
| `NUXT_DB_AUTH_USER`     | Database username | `acore`     |
| `NUXT_DB_AUTH_PASSWORD` | Database password | `acore`     |

### Realm Databases

Each realm has its own database configuration. You can configure up to 10 realms (0-9):

| Variable                        | Description             | Default     |
| ------------------------------- | ----------------------- | ----------- |
| `NUXT_DB_REALM_{n}_ID`          | Unique realm identifier | (required)  |
| `NUXT_DB_REALM_{n}_NAME`        | Display name            | (required)  |
| `NUXT_DB_REALM_{n}_DESCRIPTION` | Short description       | `""`        |
| `NUXT_DB_REALM_{n}_HOST`        | Database hostname       | `localhost` |
| `NUXT_DB_REALM_{n}_PORT`        | Database port           | `3306`      |
| `NUXT_DB_REALM_{n}_USER`        | Database username       | `acore`     |
| `NUXT_DB_REALM_{n}_PASSWORD`    | Database password       | `acore`     |

Where `{n}` is 0, 1, 2, etc.

### Example: Single Realm

```bash
# Auth Database
NUXT_DB_AUTH_HOST=localhost
NUXT_DB_AUTH_PORT=3306
NUXT_DB_AUTH_USER=acore
NUXT_DB_AUTH_PASSWORD=acore

# Realm 0
NUXT_DB_REALM_0_ID=1
NUXT_DB_REALM_0_NAME=Azeroth WotLK
NUXT_DB_REALM_0_DESCRIPTION=Classical WOTLK with PlayerBots
NUXT_DB_REALM_0_HOST=localhost
NUXT_DB_REALM_0_PORT=3306
NUXT_DB_REALM_0_USER=acore
NUXT_DB_REALM_0_PASSWORD=acore
```

### Example: Multiple Realms

```bash
# Auth Database
NUXT_DB_AUTH_HOST=db-auth.example.com
NUXT_DB_AUTH_PORT=3306
NUXT_DB_AUTH_USER=portal
NUXT_DB_AUTH_PASSWORD=secretpassword

# Realm 0 - Blizzlike
NUXT_DB_REALM_0_ID=1
NUXT_DB_REALM_0_NAME=Azeroth WotLK
NUXT_DB_REALM_0_DESCRIPTION=Blizzlike Experience
NUXT_DB_REALM_0_HOST=db-realm1.example.com
NUXT_DB_REALM_0_PORT=3306
NUXT_DB_REALM_0_USER=portal
NUXT_DB_REALM_0_PASSWORD=secretpassword

# Realm 1 - Individual Progression
NUXT_DB_REALM_1_ID=2
NUXT_DB_REALM_1_NAME=Individual IP
NUXT_DB_REALM_1_DESCRIPTION=Individual Progression Realm
NUXT_DB_REALM_1_HOST=db-realm2.example.com
NUXT_DB_REALM_1_PORT=3306
NUXT_DB_REALM_1_USER=portal
NUXT_DB_REALM_1_PASSWORD=secretpassword

# Realm 2 - Boosted
NUXT_DB_REALM_2_ID=3
NUXT_DB_REALM_2_NAME=Individual IP Boosted
NUXT_DB_REALM_2_DESCRIPTION=Individual Progression with Boosted Rates
NUXT_DB_REALM_2_HOST=db-realm3.example.com
NUXT_DB_REALM_2_PORT=3306
NUXT_DB_REALM_2_USER=portal
NUXT_DB_REALM_2_PASSWORD=secretpassword
```

## Realm Configuration

Realms are dynamically configured via environment variables at runtime. The realm ID is used as the key for database pool management and API queries.

### Realm Type Definition

```typescript
type RealmId = string; // Dynamic - any string identifier

type RealmConfig = {
	id: string; // Unique identifier (from NUXT_DB_REALM_*_ID)
	name: string; // Display name
	description: string; // Short description
	dbHost: string; // Database hostname
	dbPort: number; // Database port
	dbUser: string; // Database username
	dbPassword: string; // Database password
};
```

### How Realm Loading Works

At runtime, the server reads `NUXT_DB_REALM_0_*` through `NUXT_DB_REALM_9_*` environment variables and creates realm configurations. Only realms with both `ID` and `NAME` set are loaded.

Startup logs show which realms were detected:

```
[Config] Loaded 3 realm(s) from environment variables
  [0] 1: "Azeroth WotLK" @ db-realm1:3306
  [1] 2: "Individual IP" @ db-realm2:3306
  [2] 3: "Individual IP Boosted" @ db-realm3:3306
```

## Public Configuration

These settings are accessible in the browser via `useRuntimeConfig().public`:

| Variable                    | Description                 | Default                 |
| --------------------------- | --------------------------- | ----------------------- |
| `NUXT_PUBLIC_AUTH_MODE`     | Authentication mode         | `mock`                  |
| `NUXT_PUBLIC_MOCK_USER`     | Mock username               | `admin`                 |
| `NUXT_PUBLIC_MOCK_EMAIL`    | Mock email                  | `admin@localhost`       |
| `NUXT_PUBLIC_MOCK_GM_LEVEL` | Mock GM level               | `3`                     |
| `NUXT_PUBLIC_DIRECTUS_URL`  | Directus CMS URL (optional) | `http://localhost:8055` |
| `NUXT_PUBLIC_APP_BASE_URL`  | Application base URL        | `http://localhost:3000` |
| `NUXT_PUBLIC_DEBUG_MODE`    | Enable debug logging        | `false`                 |

### Auth Modes

| Mode          | Description                    | Use Case                     |
| ------------- | ------------------------------ | ---------------------------- |
| `mock`        | Simulates authentication       | Local development            |
| `oauth-proxy` | Reads headers from OAuth-Proxy | Kubernetes with oauth2-proxy |
| `header`      | Generic header-based auth      | Nginx basic auth, custom     |
| `direct`      | Direct WoW account login       | Simple deployments           |

## Adding a New Realm

Adding a new realm is simple - just add environment variables:

1. **Add realm environment variables**:

   ```bash
   # In .env.local or Kubernetes ConfigMap
   NUXT_DB_REALM_3_ID=4
   NUXT_DB_REALM_3_NAME=New Realm
   NUXT_DB_REALM_3_DESCRIPTION=My new realm
   NUXT_DB_REALM_3_HOST=db-realm4.example.com
   NUXT_DB_REALM_3_PORT=3306
   NUXT_DB_REALM_3_USER=portal
   NUXT_DB_REALM_3_PASSWORD=secretpassword
   ```

2. **Restart the application** - realms are loaded at startup.

3. **Verify** - Check the startup logs or call `/api/realms` to confirm the realm is loaded.

## Kubernetes Configuration

### ConfigMap for Non-Sensitive Settings

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: azeroth-portal-env
  namespace: wow
data:
  NUXT_DB_AUTH_HOST: "wow-acore-auth-db"
  NUXT_DB_AUTH_PORT: "3306"
  NUXT_DB_AUTH_USER: "acore"
  NUXT_DB_REALM_0_ID: "1"
  NUXT_DB_REALM_0_NAME: "Azeroth WotLK"
  NUXT_DB_REALM_0_DESCRIPTION: "Blizzlike"
  NUXT_DB_REALM_0_HOST: "wow-acore-blizzlike-db"
  NUXT_DB_REALM_0_PORT: "3306"
  NUXT_DB_REALM_0_USER: "acore"
  NUXT_PUBLIC_AUTH_MODE: "oauth-proxy"
  NUXT_PUBLIC_APP_BASE_URL: "https://wow.example.com"
```

### Secret for Passwords

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: azeroth-portal-secrets
  namespace: wow
type: Opaque
stringData:
  NUXT_DB_AUTH_PASSWORD: "your-auth-password"
  NUXT_DB_REALM_0_PASSWORD: "your-realm-password"
```

### Deployment Reference

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: azeroth-portal
spec:
  template:
    spec:
      containers:
        - name: azeroth-portal
          envFrom:
            - configMapRef:
                name: azeroth-portal-env
          env:
            - name: NUXT_DB_AUTH_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: azeroth-portal-secrets
                  key: NUXT_DB_AUTH_PASSWORD
            - name: NUXT_DB_REALM_0_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: azeroth-portal-secrets
                  key: NUXT_DB_REALM_0_PASSWORD
```

## Runtime Variables

These are additional runtime configuration options:

| Variable     | Description          | Default            |
| ------------ | -------------------- | ------------------ |
| `HOST`       | Server bind address  | `localhost`        |
| `NITRO_PORT` | Server port          | `3000`             |
| `DB_PATH`    | SQLite database path | `data/mappings.db` |
| `NODE_ENV`   | Environment mode     | `development`      |

## Eluna Features Configuration

Some features require the Eluna Lua engine to be installed on your AzerothCore game server. These features use queue tables that are processed by an Eluna worker script running on the game server.

### Required Eluna Script

Copy this script to your AzerothCore `lua_scripts` directory:

| Script           | Purpose                                             |
| ---------------- | --------------------------------------------------- |
| `web_worker.lua` | Unified worker for money, mail items, and bag items |

This script is located in `data/eluna/` in this repository.

The unified script uses a **single polling timer** to efficiently process all queue types:

- `web_money_requests` - Money additions/deductions
- `web_item_requests` - Item delivery via mail
- `web_bag_requests` - Direct-to-bag item delivery

### Features Requiring Eluna

| Feature     | Description                        | Queue Tables Used                    |
| ----------- | ---------------------------------- | ------------------------------------ |
| **Shop**    | In-game item purchases with gold   | money + item/bag (based on delivery) |
| **GM Mail** | Send items to players via GM panel | item                                 |

### Delivery Methods

The shop supports two delivery methods, both powered by Eluna:

| Method   | Description                                  | Player Status                         |
| -------- | -------------------------------------------- | ------------------------------------- |
| **mail** | Items sent via in-game mail using `SendMail` | Online/Offline                        |
| **bag**  | Items added directly to bags using `AddItem` | Queued if offline, delivered on login |

### Environment Variables

| Variable                     | Description                      | Default |
| ---------------------------- | -------------------------------- | ------- |
| `NUXT_ELUNA_ENABLED`         | Master switch for Eluna features | `true`  |
| `NUXT_ELUNA_SHOP_ENABLED`    | Enable shop (requires Eluna)     | `true`  |
| `NUXT_ELUNA_GM_MAIL_ENABLED` | Enable GM Mail (requires Eluna)  | `true`  |

### Why Eluna is Required

The AzerothCore world server maintains an internal counter for `item_instance` GUIDs. When the server starts, it reads the highest GUID from the database and allocates new GUIDs from there.

**Problem**: If you insert items directly into `item_instance` via SQL while the server is running, the server doesn't know about these new GUIDs. When it tries to create new items, it may reuse GUIDs that were already assigned by your SQL inserts, causing item duplication or loss.

**Solution**: The Eluna worker script uses the server's native APIs (`SendMail`, `Player:AddItem()`) which properly allocate GUIDs through the server's internal systems, ensuring no GUID conflicts.

### Disabling Eluna Features

If your server doesn't have Eluna installed, disable these features to prevent errors:

```bash
# Disable all Eluna-dependent features
NUXT_ELUNA_ENABLED=false

# Or disable individual features
NUXT_ELUNA_SHOP_ENABLED=false
NUXT_ELUNA_GM_MAIL_ENABLED=false
```

When disabled, the shop and GM mail endpoints will return 503 errors with a message explaining that Eluna is required.
