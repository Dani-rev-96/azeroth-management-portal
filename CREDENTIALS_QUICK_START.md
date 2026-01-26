## Database Credentials Architecture - Quick Reference

### Problem Solved

✅ Shared config (app can read realms/hosts) but credentials server-only  
✅ SOPS-encrypted `.enc.env` files for staging/production  
✅ Plaintext `.local.env` for local development  
✅ Credentials accessed via `useRuntimeConfig()` in API routes  
✅ Browser never sees sensitive data

### How It Works

#### 1. Config Files (Shared, No Credentials)

```
shared/utils/config/
├── local.ts       → { realms, authServerConfig, databaseConfigs (no user/password) }
├── staging.ts     → { realms, authServerConfig, databaseConfigs (no user/password) }
└── production.ts  → { realms, authServerConfig, databaseConfigs (no user/password) }
```

Used by: **both app and server**  
Safe to share: **YES** - no sensitive data

#### 2. Credential Files

```
.db.local.json              → plaintext (in .gitignore)
.db.staging.enc.json        → SOPS encrypted ✓ safe to commit
.db.production.enc.json     → SOPS encrypted ✓ safe to commit
```

Structure:

```json
{
  "databases": {
    "auth-db": {
      "user": "wow_dev",
      "password": "secure_password"
    },
    "blizzlike-db": {
      "user": "wow_dev",
      "password": "secure_password"
    },
    "ip-db": {
      "user": "wow_dev",
      "password": "secure_password"
    },
    "ip-boosted-db": {
      "user": "wow_dev",
      "password": "secure_password"
    }
  }
}
```

#### 3. Nuxt Initialization (nuxt.config.ts)

```typescript
// At startup, before config export:
const credentials = loadDbCredentials()  // Auto-detects and decrypts with SOPS if needed

// Then in runtimeConfig (SERVER-ONLY):
runtimeConfig: {
  db: {
    authUser: credentials?.databases['auth-db']?.user,
    authPassword: credentials?.databases['auth-db']?.password,
    // ... other credentials
  },
  public: { /* browser-safe stuff */ }
}
```

The loader automatically:

- ✅ Tries plaintext `.db.<env>.json` first (local dev)
- ✅ Falls back to `.db.<env>.enc.json` and decrypts with SOPS (staging/prod)
- ✅ Provides helpful error messages if setup incomplete
- ✅ `db.*` is server-only, never reaches browser

#### 4. API Route Usage

```typescript
// server/api/accounts/index.get.ts
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(); // Server-side only

  // Access credentials safely
  const user = config.db.authUser;
  const password = config.db.authPassword;

  // Get shared config
  const serverConfig = await useServerConfig();
  const host = serverConfig.databaseConfigs["auth-db"].host;

  // Connect and query
  const connection = await mysql.createConnection({
    host,
    port: 3306,
    user,
    password,
    database: "acore_auth",
  });
});
```

Credentials are **never** exposed to the client

### Local Development

1. Create `.db.local.json` in project root:

   ```json
   {
     "databases": {
       "auth-db": { "user": "wow_dev", "password": "dev_password" },
       "blizzlike-db": { "user": "wow_dev", "password": "dev_password" },
       "ip-db": { "user": "wow_dev", "password": "dev_password" },
       "ip-boosted-db": { "user": "wow_dev", "password": "dev_password" }
     }
   }
   ```

2. This file is **NOT committed** (in .gitignore, only `.enc.json` files are committed)

3. When you run Nuxt, `nuxt.config.ts` loads and parses it automatically

### Staging/Production (Encrypted)

1. Create plaintext `.db.staging.json`:

   ```json
   {
     "databases": {
       "auth-db": { "user": "staging_user", "password": "secure_password" },
       "blizzlike-db": {
         "user": "staging_user",
         "password": "secure_password"
       },
       "ip-db": { "user": "staging_user", "password": "secure_password" },
       "ip-boosted-db": {
         "user": "staging_user",
         "password": "secure_password"
       }
     }
   }
   ```

2. Encrypt with SOPS:

   ```bash
   sops -e .db.staging.json > .db.staging.enc.json
   rm .db.staging.json
   ```

3. Commit `.db.staging.enc.json` to git (it's encrypted!)

4. On startup, Nuxt auto-decrypts with SOPS (no manual decryption needed!):

   ```bash
   # Local dev (uses plaintext .db.local.json)
   npm run dev:local

   # Staging (auto-decrypts .db.staging.enc.json)
   SOPS_AGE_KEY_FILE=~/.age/keys.txt NODE_ENV=staging npm run dev:staging

   # Production (auto-decrypts .db.production.enc.json)
   NODE_ENV=production npm start
   ```

### Data Flow

```
Browser                          Server
  ↓                                ↓
  X                      .db.<env>.json OR .db.<env>.enc.json
  X                              ↓
  X                      (SOPS auto-decrypts if .enc)
  X                              ↓
  X                      Parse JSON
  X                              ↓
  X                      runtimeConfig.db
  X                              ↓
  X                      API Route ✓ Can use
  X                              ↓
  X← Response (no creds) ←————— Database Query
```

### Testing

Check credentials are loaded:

```bash
# Just run - the loader logs automatically
npm run dev
```

Should print in startup logs:

```
[✓] Loaded database credentials from .db.local.json
```

### Security Checklist

- [ ] `.db.local.json` is in `.gitignore` ✓
- [ ] `.db.*.enc.json` files are committed ✓
- [ ] Credentials are in `runtimeConfig.db` (not `.public`) ✓
- [ ] API routes use `useRuntimeConfig().db.*` ✓
- [ ] No credentials in `shared/utils/config/*.ts` ✓
- [ ] SOPS keys are in `.sops.yaml` ✓

### Files Changed/Created

| File                              | Purpose                                        |
| --------------------------------- | ---------------------------------------------- |
| `.db.local.json`                  | Local dev credentials (plaintext)              |
| `.db.staging.enc.json`            | Staging credentials (encrypted)                |
| `.db.production.enc.json`         | Production credentials (encrypted)             |
| `nuxt.config.ts`                  | Loads .db files and injects into runtimeConfig |
| `shared/utils/config/*.ts`        | Public config (no credentials)                 |
| `server/api/test-db-creds.get.ts` | Example usage                                  |
| `server/utils/db-credentials.ts`  | Optional helper                                |
| `DB_CREDENTIALS.md`               | Full documentation                             |

See [DB_CREDENTIALS.md](DB_CREDENTIALS.md) for detailed docs
