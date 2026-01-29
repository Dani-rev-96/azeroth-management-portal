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
| Docker   | 24+     | Containerized deployment           |

> **Note:** For authentication options (OAuth proxy, nginx basic auth, or direct WoW login), see [AUTHENTICATION.md](AUTHENTICATION.md).

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

- **Account Mappings** – Links between external users and WoW accounts
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

The portal uses environment variables for database credentials and settings. This makes configuration portable across different deployment environments.

### Configuration Files

| File           | Environment | Git Status |
| -------------- | ----------- | ---------- |
| `.env.example` | Template    | Committed  |
| `.env.local`   | Development | Ignored    |
| `.env`         | Production  | Ignored    |

### Local Development Setup

```bash
# Copy the example configuration
cp .env.example .env.local

# Edit with your database credentials
nano .env.local
```

### Environment Variable Structure

```bash
# ===========================================
# Auth Database Configuration
# ===========================================
NUXT_DB_AUTH_HOST=localhost
NUXT_DB_AUTH_PORT=3306
NUXT_DB_AUTH_USER=portal
NUXT_DB_AUTH_PASSWORD=your_password

# ===========================================
# Realm Configuration (up to 10 realms: 0-9)
# ===========================================

# Realm 0 - Primary Realm
NUXT_DB_REALM_0_ID=1
NUXT_DB_REALM_0_NAME=Azeroth WotLK
NUXT_DB_REALM_0_DESCRIPTION=Classical WOTLK with PlayerBots
NUXT_DB_REALM_0_HOST=localhost
NUXT_DB_REALM_0_PORT=3306
NUXT_DB_REALM_0_USER=portal
NUXT_DB_REALM_0_PASSWORD=your_password

# Realm 1 - Secondary Realm (optional)
NUXT_DB_REALM_1_ID=2
NUXT_DB_REALM_1_NAME=Azeroth IP
NUXT_DB_REALM_1_DESCRIPTION=Individual Progression Mode
NUXT_DB_REALM_1_HOST=localhost
NUXT_DB_REALM_1_PORT=3307
NUXT_DB_REALM_1_USER=portal
NUXT_DB_REALM_1_PASSWORD=your_password

# ===========================================
# Public Configuration
# ===========================================
NUXT_PUBLIC_AUTH_MODE=mock
NUXT_PUBLIC_MOCK_USER=admin
NUXT_PUBLIC_MOCK_EMAIL=admin@localhost
NUXT_PUBLIC_MOCK_GM_LEVEL=3
NUXT_PUBLIC_APP_BASE_URL=http://localhost:3000
```

### Environment Variable Reference

| Variable                     | Description             | Default     |
| ---------------------------- | ----------------------- | ----------- |
| `NUXT_DB_AUTH_HOST`          | Auth database hostname  | `localhost` |
| `NUXT_DB_AUTH_PORT`          | Auth database port      | `3306`      |
| `NUXT_DB_AUTH_USER`          | Auth database username  | `acore`     |
| `NUXT_DB_AUTH_PASSWORD`      | Auth database password  | `acore`     |
| `NUXT_DB_REALM_{n}_ID`       | Realm unique identifier | (required)  |
| `NUXT_DB_REALM_{n}_NAME`     | Realm display name      | (required)  |
| `NUXT_DB_REALM_{n}_HOST`     | Realm database hostname | `localhost` |
| `NUXT_DB_REALM_{n}_PORT`     | Realm database port     | `3306`      |
| `NUXT_DB_REALM_{n}_USER`     | Realm database username | `acore`     |
| `NUXT_DB_REALM_{n}_PASSWORD` | Realm database password | `acore`     |

## Realm Configuration

Realms are configured entirely via environment variables. See [CONFIGURATION.md](CONFIGURATION.md) for the complete reference.

### Adding a New Realm

Simply add environment variables for the new realm:

```bash
# In .env.local or your deployment environment
NUXT_DB_REALM_3_ID=4
NUXT_DB_REALM_3_NAME=My New Realm
NUXT_DB_REALM_3_DESCRIPTION=A new realm
NUXT_DB_REALM_3_HOST=localhost
NUXT_DB_REALM_3_PORT=3310
NUXT_DB_REALM_3_USER=acore
NUXT_DB_REALM_3_PASSWORD=acore
```

Restart the application - realms are loaded at startup.

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
