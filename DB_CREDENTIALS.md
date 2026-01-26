# Database Credentials Management

This document explains how database credentials are securely handled in this project.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Shared Config (app + server)                               │
│  shared/utils/config/{local,staging,production}.ts          │
│  - Realms (WOTLK, IP, IP Boosted)                           │
│  - Database hosts and ports                                 │
│  - Database names                                           │
│  ⚠️  NO credentials here                                     │
└─────────────────────────────────────────────────────────────┘
                           ⬇
┌─────────────────────────────────────────────────────────────┐
│  Credentials Files (server-side only, loaded at startup)    │
│  .db.local.env       (plaintext, in .gitignore)             │
│  .db.staging.enc.env (SOPS-encrypted)                       │
│  .db.production.enc.env (SOPS-encrypted)                    │
│  ✓ Contains: DB_*_USER, DB_*_PASSWORD                       │
└─────────────────────────────────────────────────────────────┘
                           ⬇
┌─────────────────────────────────────────────────────────────┐
│  Nuxt Initialization (nuxt.config.ts)                       │
│  1. Load .db.<env>.env file                                 │
│  2. Parse into process.env                                  │
│  3. Inject into runtimeConfig.db (server-only)              │
│  ✓ Browser NEVER sees runtimeConfig.db (non-public)         │
└─────────────────────────────────────────────────────────────┘
                           ⬇
┌─────────────────────────────────────────────────────────────┐
│  API Routes (server/api/*)                                  │
│  Access via: const config = useRuntimeConfig()              │
│  Use: config.db.authUser, config.db.authPassword, etc      │
│  ✓ Server-side only, never sent to client                   │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
wow-frontend/
├── .db.local.json              # Local dev credentials (plaintext)
├── .db.staging.enc.json        # Staging credentials (SOPS encrypted)
├── .db.production.enc.json     # Production credentials (SOPS encrypted)
│
├── nuxt.config.ts             # Loads .db.<env>.env at startup
│
├── shared/utils/config/
│   ├── local.ts               # No credentials
│   ├── staging.ts             # No credentials
│   └── production.ts          # No credentials
│
└── server/
    ├── api/
    │   ├── test-db-creds.get.ts  # Example usage
    │   └── accounts/
    │       └── index.get.ts       # Your API routes
    │
    └── utils/
        └── db-credentials.ts      # Helper function (optional)
```

## Setup

### 1. Local Development

Create `.db.local.json` with your local database credentials:

```json
{
  "databases": {
    "auth-db": {
      "user": "wow_dev",
      "password": "dev_password"
    },
    "blizzlike-db": {
      "user": "wow_dev",
      "password": "dev_password"
    },
    "ip-db": {
      "user": "wow_dev",
      "password": "dev_password"
    },
    "ip-boosted-db": {
      "user": "wow_dev",
      "password": "dev_password"
    }
  }
}
```

This file is in `.gitignore` and should NOT be committed.

Start the app:

```bash
npm run dev:local
```

Nuxt will automatically load and parse `.db.local.json`.

### 2. Staging/Production (SOPS Encrypted)

Create plaintext versions, then encrypt with SOPS:

```bash
# Create plaintext
cat > .db.staging.json << 'EOF'
{
  "databases": {
    "auth-db": { "user": "staging_user", "password": "..." },
    "blizzlike-db": { "user": "staging_user", "password": "..." },
    "ip-db": { "user": "staging_user", "password": "..." },
    "ip-boosted-db": { "user": "staging_user", "password": "..." }
  }
}
EOF

# Encrypt with SOPS
sops -e .db.staging.json > .db.staging.enc.json

# Delete plaintext (optional, but recommended)
rm .db.staging.json

# Repeat for production
```

The encrypted `.enc.json` files ARE committed to version control.

### Starting with Encrypted Credentials

Nuxt automatically detects and decrypts SOPS files at startup. No manual decryption needed!

```bash
# Local development (auto-loads .db.local.json)
npm run dev:local

# Staging (auto-decrypts .db.staging.enc.json with SOPS)
SOPS_AGE_KEY_FILE=~/.age/keys.txt NODE_ENV=staging npm run dev:staging

# Production (auto-decrypts .db.production.enc.json)
NODE_ENV=production npm start
```

The loader tries files in this order:

1. `.db.<env>.json` (plaintext - local dev)
2. `.db.<env>.enc.json` (encrypted - staging/prod)

## Usage in API Routes

Access credentials in any API route via `useRuntimeConfig()`:

```typescript
// server/api/accounts/index.get.ts
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();

  // Get credentials (server-side only)
  const user = config.db.authUser; // e.g., "wow_dev"
  const password = config.db.authPassword; // e.g., "dev_password"

  // Get config from shared files (available on both server and client)
  const serverConfig = await useServerConfig();
  const host = serverConfig.databaseConfigs["auth-db"].host;

  // Connect to database
  const connection = await mysql.createConnection({
    host,
    port: 3306,
    user,
    password,
    database: "acore_auth",
  });

  // ... your queries
});
```

## Environment Variables

The `.db.<env>.json` file structure uses nested objects instead of env vars. Access them by key path:

| Path                                  | Used For                         | Example       |
| ------------------------------------- | -------------------------------- | ------------- |
| `databases['auth-db'].user`           | Auth database user               | `wow_dev`     |
| `databases['auth-db'].password`       | Auth database password           | `secure_pass` |
| `databases['blizzlike-db'].user`      | Blizzlike world DB user          | `wow_dev`     |
| `databases['blizzlike-db'].password`  | Blizzlike world DB password      | `secure_pass` |
| `databases['ip-db'].user`             | IP progression world DB user     | `wow_dev`     |
| `databases['ip-db'].password`         | IP progression world DB password | `secure_pass` |
| `databases['ip-boosted-db'].user`     | IP boosted world DB user         | `wow_dev`     |
| `databases['ip-boosted-db'].password` | IP boosted world DB password     | `secure_pass` |

## Security

### ✅ Safe

- Credentials are loaded server-side only during Nuxt initialization
- `runtimeConfig.db` (without `.public`) is never sent to the browser
- Plaintext `.db.local.json` is in `.gitignore`
- Encrypted `.db.*.enc.json` files are safe to commit
- Shared config files have no sensitive data

### ❌ NOT Safe

- Don't check in plaintext credential files (except `.local.env` which is ignored)
- Don't expose credentials via `runtimeConfig.public.*`
- Don't log credentials in browser console
- Don't add credentials to client-side composables

## Encryption (SOPS)

### Install SOPS

```bash
# macOS
brew install sops age

# Linux (Ubuntu/Debian)
sudo apt-get install sops age

# Or download from: https://github.com/mozilla/sops/releases
```

### Generate Age Key (First Time Only)

```bash
age-keygen -o ~/.age/keys.txt
# Save the output: age1xxxx... (this is your public key)
```

### Add Public Key to `.sops.yaml`

```yaml
creation_rules:
  - path_regex: ^\.db\..*\.enc\.env$
    key_groups:
      - age:
          - "age1xxxxxxxxxxxxxxxxxxxx" # Your public key from above
```

### Encrypt a File

```bash
# Encrypt and create .enc file
sops -e .db.staging.json > .db.staging.enc.json

# Or edit encrypted file (SOPS handles encrypt/decrypt)
sops .db.staging.enc.json
```

### Decrypt for Viewing

```bash
sops -d .db.staging.enc.json
```

### Decrypt for Build/Deployment

On your CI/CD or deployment server, decrypt before starting Nuxt:

```bash
# Decrypt for build
sops -d .db.production.enc.json > .db.production.json

# Start Nuxt (it will load .db.production.json)
npm run build
npm run start
```

Then set `NODE_ENV=production` before running.

## Troubleshooting

### "sops: command not found"

SOPS must be installed on the system where you run Nuxt:

```bash
# macOS
brew install sops age

# Linux (Ubuntu/Debian)
sudo apt-get install sops age

# Or install from: https://github.com/mozilla/sops/releases
```

### Credentials not loaded

Check the startup logs for the error message:

```bash
npm run dev:local
# Should print: [✓] Loaded credentials from .db.local.json
# OR: [✓] Decrypted credentials from .db.staging.enc.json
```

If decryption fails, check your SOPS setup:

```bash
# Local (age)
export SOPS_AGE_KEY_FILE=~/.age/keys.txt
sops -d .db.staging.enc.json

# AWS (KMS)
export AWS_PROFILE=myprofile
sops -d .db.production.enc.json
```

### "SOPS failed to decrypt"

1. Verify age key exists:

   ```bash
   cat ~/.age/keys.txt
   ```

2. Check `.sops.yaml` has your public key:

   ```bash
   cat .sops.yaml
   ```

3. Verify file is SOPS-encrypted (not plaintext):
   ```bash
   head -c 20 .db.staging.enc.json
   # Should show binary/SOPS format, not JSON
   ```

### SOPS decryption fails

1. Verify age key location:

   ```bash
   export SOPS_AGE_KEY_FILE=~/.age/keys.txt
   sops -d .db.staging.enc.env
   ```

2. Check key is in `.sops.yaml`:
   ```bash
   cat .sops.yaml
   ```

### Credentials showing as empty

Check that JSON file was parsed correctly:

```bash
# View the file to ensure it's valid JSON
cat .db.local.json | jq .
```

## References

- [SOPS Documentation](https://github.com/mozilla/sops)
- [age Encryption](https://github.com/FiloSottile/age)
- [Nuxt runtimeConfig](https://nuxt.com/docs/guide/going-further/runtime-config)
- [dotenv Package](https://www.npmjs.com/package/dotenv)
