# Configuration Reference

Complete reference for all configuration options in the Azeroth Management Portal.

## Table of Contents

- [Configuration Files](#configuration-files)
- [Credentials Configuration](#credentials-configuration)
- [Realm Configuration](#realm-configuration)
- [Runtime Configuration](#runtime-configuration)
- [Environment Variables](#environment-variables)

## Configuration Files

### File Overview

| File                       | Purpose                                     | Location               |
| -------------------------- | ------------------------------------------- | ---------------------- |
| `.db.{env}.json`           | Database credentials & environment settings | Project root           |
| `shared/utils/config/*.ts` | Realm definitions                           | `shared/utils/config/` |
| `nuxt.config.ts`           | Nuxt framework configuration                | Project root           |

### Credential File Loading

The application loads credentials at startup based on `NODE_ENV`:

```
NODE_ENV=development  →  .db.local.json
NODE_ENV=staging      →  .db.staging.enc.json (SOPS decrypted)
NODE_ENV=production   →  .db.production.enc.json (SOPS decrypted)
```

Startup logs show which file was loaded:

```
[✓] Loaded credentials from .db.local.json
# or
[✓] Decrypted credentials from .db.production.enc.json
```

## Credentials Configuration

### Full Schema

```json
{
	"databases": {
		"auth-db": {
			"host": "string",
			"port": "number",
			"user": "string",
			"password": "string"
		},
		"blizzlike-db": {
			/* same structure */
		},
		"ip-db": {
			/* same structure */
		},
		"ip-boosted-db": {
			/* same structure */
		}
	},
	"env": {
		"authMode": "mock | oauth-proxy | keycloak",
		"mockUser": "string",
		"mockEmail": "string",
		"mockGMLevel": "number",
		"keycloakUrl": "string",
		"keycloakRealm": "string",
		"directusUrl": "string",
		"appBaseUrl": "string"
	}
}
```

### Database Configuration

| Property   | Type   | Required | Description                  |
| ---------- | ------ | -------- | ---------------------------- |
| `host`     | string | Yes      | Database hostname or IP      |
| `port`     | number | Yes      | Database port (usually 3306) |
| `user`     | string | Yes      | Database username            |
| `password` | string | Yes      | Database password            |

### Database Keys

| Key             | Description                  | AzerothCore Database          |
| --------------- | ---------------------------- | ----------------------------- |
| `auth-db`       | Authentication database      | `acore_auth`                  |
| `blizzlike-db`  | Default/blizzlike realm      | `acore_characters`            |
| `ip-db`         | Individual Progression realm | `acore_characters` (separate) |
| `ip-boosted-db` | Boosted IP realm             | `acore_characters` (separate) |

### Environment Settings

| Property        | Type   | Default                   | Description                 |
| --------------- | ------ | ------------------------- | --------------------------- |
| `authMode`      | string | `"mock"`                  | Authentication mode         |
| `mockUser`      | string | `"admin"`                 | Username for mock auth      |
| `mockEmail`     | string | `"admin@localhost"`       | Email for mock auth         |
| `mockGMLevel`   | number | `3`                       | GM level for mock auth      |
| `keycloakUrl`   | string | `"http://localhost:8080"` | Keycloak server URL         |
| `keycloakRealm` | string | `"wow"`                   | Keycloak realm name         |
| `directusUrl`   | string | `"http://localhost:8055"` | Directus CMS URL (optional) |
| `appBaseUrl`    | string | `"http://localhost:3000"` | Application base URL        |

### Auth Modes

| Mode          | Description                    | Use Case                     |
| ------------- | ------------------------------ | ---------------------------- |
| `mock`        | Simulates authentication       | Local development            |
| `oauth-proxy` | Reads headers from OAuth-Proxy | Kubernetes with oauth2-proxy |
| `keycloak`    | Direct Keycloak integration    | Staging environments         |

## Realm Configuration

Realms are defined in TypeScript files under `shared/utils/config/`.

### Realm Type Definition

```typescript
type RealmId = "wotlk" | "wotlk-ip" | "wotlk-ip-boosted";

type RealmConfig = {
	id: RealmId; // Unique identifier
	realmId: number; // Numeric ID from realmlist table
	name: string; // Display name
	description: string; // Short description
	version: string; // Game version (e.g., "WOTLK")
	worldPort: number; // World server port
	soapPort: number; // SOAP port for commands
	database: string; // Character database name
	databaseHost: string; // Database hostname
	databaseKey: string; // Key in credentials file
};
```

### Example Configuration

```typescript
// shared/utils/config/local.ts
export const realms: Record<RealmId, RealmConfig> = {
	wotlk: {
		id: "wotlk",
		realmId: 1,
		name: "Azeroth WoTLK",
		description: "Classical WOTLK with PlayerBots",
		version: "WOTLK",
		worldPort: 8085,
		soapPort: 7878,
		database: "acore_characters",
		databaseHost: "localhost",
		databaseKey: "blizzlike-db",
	},
	"wotlk-ip": {
		id: "wotlk-ip",
		realmId: 2,
		name: "Azeroth IP",
		description: "Individual Progression Mode",
		version: "WOTLK",
		worldPort: 8086,
		soapPort: 7879,
		database: "acore_characters",
		databaseHost: "localhost",
		databaseKey: "ip-db",
	},
	"wotlk-ip-boosted": {
		id: "wotlk-ip-boosted",
		realmId: 3,
		name: "Azeroth IP Boosted",
		description: "Individual Progression with boosted rates",
		version: "WOTLK",
		worldPort: 8087,
		soapPort: 7880,
		database: "acore_characters",
		databaseHost: "localhost",
		databaseKey: "ip-boosted-db",
	},
};

export const authServerConfig = {
	host: "localhost",
	port: 3724,
};
```

### Adding a New Realm

1. **Update the RealmId type** in `app/types/index.ts`:

   ```typescript
   export type RealmId = "wotlk" | "wotlk-ip" | "wotlk-ip-boosted" | "new-realm";
   ```

2. **Add realm to config files**:
   - `shared/utils/config/local.ts`
   - `shared/utils/config/production.ts`

3. **Add database credentials** to `.db.*.json`:
   ```json
   {
   	"databases": {
   		"new-realm-db": {
   			"host": "localhost",
   			"port": 3306,
   			"user": "portal",
   			"password": "password"
   		}
   	}
   }
   ```

## Runtime Configuration

Runtime config is set in `nuxt.config.ts` and loaded from credentials files.

### Server-Only Configuration

These values are only accessible server-side:

```typescript
// Access in API routes
const config = useRuntimeConfig();
config.db.authUser; // Auth database user
config.db.authPassword; // Auth database password
config.db.authHost; // Auth database host
config.db.authPort; // Auth database port
// ... similar for other databases
```

### Public Configuration

These values are accessible client-side:

```typescript
// Access anywhere
const config = useRuntimeConfig();
config.public.authMode; // 'mock' | 'oauth-proxy' | 'keycloak'
config.public.mockUser; // Mock username
config.public.keycloakUrl; // Keycloak URL
config.public.keycloakRealm; // Keycloak realm
config.public.appBaseUrl; // Application URL
config.public.publicPath; // Path for public files
```

## Environment Variables

### Build-time Variables

| Variable   | Description       | Default       |
| ---------- | ----------------- | ------------- |
| `NODE_ENV` | Build environment | `development` |

### Runtime Variables

| Variable            | Description          | Default            |
| ------------------- | -------------------- | ------------------ |
| `HOST`              | Server bind address  | `localhost`        |
| `PORT`              | Server port          | `3000`             |
| `SOPS_AGE_KEY_FILE` | Path to age key      | -                  |
| `PUBLIC_PATH`       | Public file storage  | `data/public`      |
| `DB_PATH`           | SQLite database path | `data/mappings.db` |

### SOPS Variables

For decrypting encrypted credentials:

| Variable                | Description                  |
| ----------------------- | ---------------------------- |
| `SOPS_AGE_KEY_FILE`     | Path to age private key file |
| `SOPS_AGE_KEY`          | Age private key (inline)     |
| `AWS_PROFILE`           | AWS profile for KMS          |
| `AWS_ACCESS_KEY_ID`     | AWS access key for KMS       |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key for KMS       |

### Example Startup Commands

```bash
# Local development
NODE_ENV=development pnpm dev

# Staging with age key
NODE_ENV=staging SOPS_AGE_KEY_FILE=~/.age/keys.txt pnpm dev

# Production with environment variable
NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=3000 \
  SOPS_AGE_KEY_FILE=/secrets/age.key \
  node .output/server/index.mjs
```
