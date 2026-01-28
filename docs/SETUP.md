# Setup Guide

Complete installation and configuration guide for the Azeroth Management Portal.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Database Setup](#database-setup)
- [Credentials Configuration](#credentials-configuration)
- [Realm Configuration](#realm-configuration)
- [DBC Data Setup](#dbc-data-setup)
- [Running the Application](#running-the-application)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

| Software      | Version               | Purpose                       |
| ------------- | --------------------- | ----------------------------- |
| Node.js       | 18+ (20+ recommended) | JavaScript runtime            |
| pnpm          | 8+                    | Package manager (recommended) |
| MySQL/MariaDB | 8.0+ / 10.5+          | AzerothCore databases         |

### Optional Software

| Software | Version | Purpose                            |
| -------- | ------- | ---------------------------------- |
| SOPS     | 3.7+    | Encrypted credentials (production) |
| age      | 1.0+    | Encryption for SOPS                |
| Keycloak | 20+     | Identity management (production)   |
| Docker   | 24+     | Containerized deployment           |

### AzerothCore Requirements

You need access to the following AzerothCore databases:

- `acore_auth` – Authentication database (accounts, bans, GM levels)
- `acore_characters` – Character database (per realm)
- `acore_world` – World database (items, spells, etc.)

The portal supports multiple realms, each with their own character database.

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/azeroth-management-portal.git
cd azeroth-management-portal
```

### 2. Install Dependencies

```bash
# Using pnpm (recommended)
pnpm install

# Or using npm
npm install
```

### 3. Prepare the Environment

```bash
# Run postinstall to prepare Nuxt
pnpm postinstall
```

## Database Setup

### Database Architecture

The portal connects to AzerothCore's MySQL databases for account and character data, and uses local SQLite databases for:

- **Account Mappings** – Links between Keycloak users and WoW accounts
- **DBC Data Cache** – Item icons, spell info, talents, enchantments

```
┌─────────────────────────────────────────────────────────────┐
│                    Database Architecture                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  AzerothCore (MySQL)           Portal (SQLite)              │
│  ┌───────────────────┐         ┌───────────────────┐        │
│  │   acore_auth      │         │   mappings.db     │        │
│  │   - account       │         │   - account_maps  │        │
│  │   - account_access│         └───────────────────┘        │
│  │   - account_banned│                                      │
│  └───────────────────┘         ┌───────────────────┐        │
│                                │   DBC Databases   │        │
│  ┌───────────────────┐         │   - item.db       │        │
│  │ acore_characters  │         │   - spell.db      │        │
│  │ (per realm)       │         │   - talent.db     │        │
│  │   - characters    │         │   - enchant.db    │        │
│  │   - character_*   │         └───────────────────┘        │
│  │   - guild         │                                      │
│  └───────────────────┘                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### MySQL User Setup

Create a MySQL user for the portal with read access (write access only for specific operations):

```sql
-- Create portal user
CREATE USER 'portal'@'%' IDENTIFIED BY 'secure_password';

-- Grant read access to auth database
GRANT SELECT ON acore_auth.* TO 'portal'@'%';

-- Grant write access for account creation and password changes
GRANT INSERT, UPDATE ON acore_auth.account TO 'portal'@'%';
GRANT INSERT, UPDATE ON acore_auth.account_access TO 'portal'@'%';

-- Grant read access to character databases (repeat per realm)
GRANT SELECT ON acore_characters.* TO 'portal'@'%';

-- Optional: Grant write for character actions (rename, etc.)
GRANT UPDATE ON acore_characters.characters TO 'portal'@'%';

FLUSH PRIVILEGES;
```

## Credentials Configuration

The portal uses JSON configuration files for database credentials and environment settings.

### File Naming Convention

| File                      | Environment | Encryption       | Git       |
| ------------------------- | ----------- | ---------------- | --------- |
| `.db.local.json`          | Development | None (plaintext) | Ignored   |
| `.db.staging.enc.json`    | Staging     | SOPS encrypted   | Committed |
| `.db.production.enc.json` | Production  | SOPS encrypted   | Committed |

### Credential File Structure

```json
{
	"databases": {
		"auth-db": {
			"host": "localhost",
			"port": 3306,
			"user": "portal",
			"password": "your_password"
		},
		"blizzlike-db": {
			"host": "localhost",
			"port": 3306,
			"user": "portal",
			"password": "your_password"
		},
		"ip-db": {
			"host": "localhost",
			"port": 3307,
			"user": "portal",
			"password": "your_password"
		},
		"ip-boosted-db": {
			"host": "localhost",
			"port": 3308,
			"user": "portal",
			"password": "your_password"
		}
	},
	"env": {
		"authMode": "mock",
		"mockUser": "admin",
		"mockEmail": "admin@localhost",
		"mockGMLevel": 3,
		"keycloakUrl": "https://keycloak.example.com",
		"keycloakRealm": "wow",
		"appBaseUrl": "https://portal.example.com"
	}
}
```

### Database Keys Explained

| Key             | Description                            |
| --------------- | -------------------------------------- |
| `auth-db`       | AzerothCore auth database (acore_auth) |
| `blizzlike-db`  | Default/blizzlike realm database       |
| `ip-db`         | Individual Progression realm database  |
| `ip-boosted-db` | Boosted IP realm database              |

### Local Development Setup

```bash
# Create local credentials file
cat > .db.local.json << 'EOF'
{
  "databases": {
    "auth-db": {
      "host": "localhost",
      "port": 3306,
      "user": "acore",
      "password": "acore"
    },
    "blizzlike-db": {
      "host": "localhost",
      "port": 3306,
      "user": "acore",
      "password": "acore"
    },
    "ip-db": {
      "host": "localhost",
      "port": 3306,
      "user": "acore",
      "password": "acore"
    },
    "ip-boosted-db": {
      "host": "localhost",
      "port": 3306,
      "user": "acore",
      "password": "acore"
    }
  },
  "env": {
    "authMode": "mock",
    "mockUser": "admin",
    "mockEmail": "admin@localhost",
    "mockGMLevel": 3
  }
}
EOF
```

### Production Setup with SOPS

For production, encrypt credentials with SOPS:

```bash
# Install SOPS and age
brew install sops age  # macOS
# or: apt install sops age  # Linux

# Generate age key (one-time)
mkdir -p ~/.age
age-keygen -o ~/.age/keys.txt

# Create .sops.yaml configuration
cat > .sops.yaml << 'EOF'
creation_rules:
  - path_regex: \.enc\.json$
    age: age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EOF

# Create production credentials
cat > .db.production.json << 'EOF'
{
  "databases": {
    "auth-db": {
      "host": "db.example.com",
      "port": 3306,
      "user": "portal_prod",
      "password": "SECURE_PASSWORD"
    }
    // ... other databases
  },
  "env": {
    "authMode": "oauth-proxy",
    "keycloakUrl": "https://keycloak.example.com",
    "keycloakRealm": "wow",
    "appBaseUrl": "https://portal.example.com"
  }
}
EOF

# Encrypt the file
sops -e .db.production.json > .db.production.enc.json

# Delete plaintext
rm .db.production.json

# Commit encrypted file
git add .db.production.enc.json
git commit -m "Add encrypted production credentials"
```

## Realm Configuration

Realms are configured in `shared/utils/config/local.ts` (development) and `shared/utils/config/production.ts` (production).

### Realm Configuration Example

```typescript
// shared/utils/config/local.ts
import type { RealmConfig, RealmId } from "~/types";

export const realms: Record<RealmId, RealmConfig> = {
	wotlk: {
		id: "wotlk",
		realmId: 1, // ID from realmlist table
		name: "Azeroth WoTLK",
		description: "Classical WOTLK experience",
		version: "WOTLK",
		worldPort: 8085,
		soapPort: 7878,
		database: "acore_characters",
		databaseHost: "localhost",
		databaseKey: "blizzlike-db", // References credentials file
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
};

export const authServerConfig = {
	host: "localhost",
	port: 3724,
};
```

### Adding a New Realm

1. Add the realm to the `RealmId` type in `app/types/index.ts`:

   ```typescript
   export type RealmId = "wotlk" | "wotlk-ip" | "wotlk-ip-boosted" | "your-new-realm";
   ```

2. Add realm configuration in `shared/utils/config/local.ts` (and production.ts)

3. Add database credentials to your `.db.*.json` file

## DBC Data Setup

The portal uses DBC (DataBase Client) data for displaying item icons, spell tooltips, and talent trees.

### Import DBC Data

```bash
# Ensure DBC JSON files are in data/dbcJsons/
# These can be extracted from WoW client using tools like WDBX

# Run the import script
pnpm import-dbc
```

This creates SQLite databases in `server/assets/`:

- `item.db` – Item metadata
- `spell.db` – Spell information
- `talent.db` – Talent tree data
- `spell_item_enchantment.db` – Enchantment data

### DBC JSON Sources

Place the following JSON files in `data/dbcJsons/`:

- `Item.json`
- `ItemDisplayInfo.json`
- `Spell.json`
- `SpellIcon.json`
- `SpellItemEnchantment.json`
- `Talent.json`
- `TalentTab.json`

### Item Icons

Place PNG icons in `data/png/Icons/` for item display. These can be extracted from the WoW client's `Interface/Icons` folder.

## Running the Application

### Development Mode

```bash
# Start with mock authentication
pnpm dev:local

# Start with HTTPS (requires certificates)
pnpm dev:ssl
```

### Production Mode

```bash
# Build for production
pnpm build:production

# Start production server
node .output/server/index.mjs

# Or use the preview command
pnpm preview
```

### Environment Variables

| Variable            | Description                  | Default       |
| ------------------- | ---------------------------- | ------------- |
| `NODE_ENV`          | Environment mode             | `development` |
| `HOST`              | Server host                  | `localhost`   |
| `PORT`              | Server port                  | `3000`        |
| `SOPS_AGE_KEY_FILE` | Path to age key for SOPS     | -             |
| `PUBLIC_PATH`       | Path for public file storage | `data/public` |

## Troubleshooting

### Common Issues

#### "No credentials file found"

```bash
# Check that .db.local.json exists
ls -la .db.*.json

# Create if missing
cp .db.example.json .db.local.json
# Edit with your credentials
```

#### "SOPS decryption failed"

```bash
# Ensure age key is accessible
export SOPS_AGE_KEY_FILE=~/.age/keys.txt

# Test decryption
sops -d .db.production.enc.json
```

#### "Database connection refused"

1. Verify MySQL is running
2. Check firewall allows connections
3. Verify credentials in `.db.local.json`
4. Test connection manually:
   ```bash
   mysql -h localhost -u portal -p acore_auth
   ```

#### "Module not found" errors

```bash
# Rebuild dependencies
rm -rf node_modules .nuxt .output
pnpm install
pnpm postinstall
```

### Getting Help

- Check the [FAQ](FAQ.md) for common questions
- Open an issue on GitHub
- Join the AzerothCore Discord community
