## 🚀 Starting the App with Credentials

### The Simple Way (Recommended)

Just set the environment and run. Nuxt handles everything automatically!

```bash
# Local development (plaintext credentials)
npm run dev:local

# Staging (auto-decrypts encrypted credentials via SOPS)
SOPS_AGE_KEY_FILE=~/.age/keys.txt NODE_ENV=staging npm run dev:staging

# Production (auto-decrypts encrypted credentials)
NODE_ENV=production npm start
```

### What Happens Automatically

1. **Nuxt starts** → calls `loadDbCredentials()` in `nuxt.config.ts`
2. **Loader checks** for `.db.<env>.json` first (plaintext)
3. **If not found** → checks for `.db.<env>.enc.json` and decrypts with SOPS
4. **Credentials injected** into `runtimeConfig.db` (server-only)
5. **API routes access** via `useRuntimeConfig().db.*`
6. **Browser never sees** credentials (not in public config)

### Startup Output

You should see:

```
[✓] Loaded credentials from .db.local.json
# OR
[✓] Decrypted credentials from .db.staging.enc.json
# OR
[✓] Decrypted credentials from .db.production.enc.json
```

### Local Development Setup

**First time only:**

```bash
# 1. Create credentials file
cat > .db.local.json << 'EOF'
{
  "databases": {
    "auth-db": { "user": "wow_dev", "password": "dev_password" },
    "blizzlike-db": { "user": "wow_dev", "password": "dev_password" },
    "ip-db": { "user": "wow_dev", "password": "dev_password" },
    "ip-boosted-db": { "user": "wow_dev", "password": "dev_password" }
  }
}
EOF

# 2. Start the app
npm run dev:local
```

The file is in `.gitignore`, so it won't be committed.

### Staging/Production Setup

**Before first deployment:**

```bash
# 1. Create plaintext credentials
cat > .db.staging.json << 'EOF'
{
  "databases": {
    "auth-db": { "user": "staging_user", "password": "YOUR_PASSWORD" },
    "blizzlike-db": { "user": "staging_user", "password": "YOUR_PASSWORD" },
    "ip-db": { "user": "staging_user", "password": "YOUR_PASSWORD" },
    "ip-boosted-db": { "user": "staging_user", "password": "YOUR_PASSWORD" }
  }
}
EOF

# 2. Encrypt with SOPS
sops -e .db.staging.json > .db.staging.enc.json

# 3. Delete plaintext (encrypted version is enough)
rm .db.staging.json

# 4. Commit encrypted file
git add .db.staging.enc.json
git commit -m "Add encrypted staging credentials"

# 5. Repeat for production
```

**Then on deployment:**

```bash
# With age key
SOPS_AGE_KEY_FILE=~/.age/keys.txt NODE_ENV=staging npm start

# Or with AWS KMS
AWS_PROFILE=myprofile NODE_ENV=staging npm start
```

### Troubleshooting Startup

**"Command not found: sops"**

```bash
brew install sops age  # macOS
# or sudo apt-get install sops age  # Linux
```

**"Decryption failed" on startup**

```bash
# Check age key is accessible
export SOPS_AGE_KEY_FILE=~/.age/keys.txt
sops -d .db.staging.enc.json  # Should print JSON
```

**"No credentials file found"**

```bash
# Create the file for your environment
npm run dev:local  # Creates .db.local.json, or
SOPS_AGE_KEY_FILE=~/.age/keys.txt NODE_ENV=staging npm start  # Uses .db.staging.enc.json
```

### Files Overview

| File                      | Purpose                            | Committed? | Notes                            |
| ------------------------- | ---------------------------------- | ---------- | -------------------------------- |
| `.db.local.json`          | Dev credentials (plaintext)        | ❌ No      | In `.gitignore`, create manually |
| `.db.staging.enc.json`    | Staging credentials (encrypted)    | ✅ Yes     | Safe to commit, auto-decrypted   |
| `.db.production.enc.json` | Production credentials (encrypted) | ✅ Yes     | Safe to commit, auto-decrypted   |

### How Credentials Flow to API Routes

```
Browser                Server at Startup
  ↓                           ↓
  🚫                  loadDbCredentials()
  🚫                          ↓
  🚫              Try .db.<env>.json
  🚫              OR .db.<env>.enc.json
  🚫                          ↓
  🚫              Parse JSON (decrypt if .enc)
  🚫                          ↓
  🚫              runtimeConfig.db = { authUser, authPassword, ... }
  🚫                          ↓
  🚫              API Route can read:
  🚫              config.db.authUser
  🚫              config.db.authPassword
  🚫                          ↓
  ✅ Response    (no secrets in response)
  ← ← ← ← ← ← ← ← ← ← ← ← ← ← ←
```

### Environment Variables Needed

**Local development:**

```bash
# None! Just create .db.local.json
```

**Staging/Production:**

```bash
# Age encryption (if using age)
export SOPS_AGE_KEY_FILE=~/.age/keys.txt

# Or AWS KMS
export AWS_PROFILE=myprofile
export AWS_REGION=us-east-1

# Environment
export NODE_ENV=staging  # or production
```

Then just run: `npm start`

Everything else is automatic! 🎉
