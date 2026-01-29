# Azeroth Management Portal

A modern, CMS-independent management and community portal for [AzerothCore](https://www.azerothcore.org/) WoW servers. Built with Nuxt 4, featuring flexible authentication (OAuth-Proxy, nginx basic auth, or direct WoW login), multi-realm support, and comprehensive account/character management.

<p align="center">
  <img src="https://img.shields.io/badge/Nuxt-4.x-00DC82?logo=nuxt.js" alt="Nuxt 4" />
  <img src="https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js" alt="Vue 3" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/AzerothCore-WOTLK-blue" alt="AzerothCore" />
</p>

## ✨ Features

### 👤 Account Management

- **Account Linking** – Link your external identity to one or more WoW accounts (when using external auth)
- **Account Creation** – Create new WoW accounts directly from the portal
- **Password Management** – Change passwords for linked accounts (SRP-6a compliant)
- **Multi-Account Support** – Manage multiple WoW accounts from a single identity

### 🎮 Character Management

- **Character Overview** – View all characters across linked accounts and realms
- **Character Details** – Inspect equipment, stats, talents, and achievements
- **Character Actions** – Rename, unstuck, or restore deleted characters
- **Equipment Viewer** – Display gear with proper icons and enchantment stats

### 👥 Community Hub

- **Online Players** – Real-time view of who's playing (auto-refreshes)
- **Server Statistics** – Total accounts, characters, guilds, level distribution
- **Top Players** – Leaderboards by level, playtime, and achievements
- **PvP Statistics** – Arena and battleground rankings
- **Realm Filtering** – View stats per realm or aggregated

### 🛡️ Admin Panel (GM Tools)

- **Account Management** – Search, view, and manage all accounts
- **GM Level Management** – Assign or revoke GM privileges
- **Account Mappings** – View all external-to-WoW account links
- **Mass Mailing** – Send in-game mail to players or groups
- **File Management** – Upload/manage downloadable files (game clients, patches)
- **Data Export** – Export account and character data

### 📦 Downloads

- **File Repository** – Serve game clients and patches
- **Resumable Downloads** – Interrupted downloads can be resumed
- **File Descriptions** – Automatic descriptions for known file types

### 🔐 Authentication

- **Flexible Auth Modes** – Choose what fits your infrastructure
- **OAuth-Proxy Support** – Header-based auth for Kubernetes deployments
- **Nginx Basic Auth** – Simple header-based auth with htpasswd
- **Direct WoW Login** – Simple mode using WoW account credentials
- **Mock Mode** – Local development without external auth
- **GM Detection** – Automatic detection of GM status from game database

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Users / Browser                          │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    OAuth-Proxy / LB     │  (Production)
                    │    or Direct Access     │  (Development)
                    └────────────┬────────────┘
                                 │
┌────────────────────────────────▼─────────────────────────────────┐
│                    Azeroth Management Portal                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                     Nuxt 4 Application                      │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │ │
│  │  │   Pages     │  │  Components │  │       Stores        │  │ │
│  │  │  - Home     │  │  - Account  │  │  - Auth (Pinia)     │  │ │
│  │  │  - Account  │  │  - Admin    │  │  - Accounts         │  │ │
│  │  │  - Admin    │  │  - Character│  │  - Community        │  │ │
│  │  │  - Community│  │  - Community│  │                     │  │ │
│  │  │  - Downloads│  │  - UI       │  │                     │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Nitro Server (API)                        │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │ /api/auth     - Authentication endpoints             │   │ │
│  │  │ /api/accounts - Account & mapping management         │   │ │
│  │  │ /api/characters - Character data & actions           │   │ │
│  │  │ /api/admin    - GM tools & administration            │   │ │
│  │  │ /api/community - Stats, online players, leaderboards │   │ │
│  │  │ /api/downloads - File serving                        │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────┬──────────────────────────────────────────────────────┘
            │
  ┌─────────▼─────────┐                 ┌─────────────────────────┐
  │   SQLite (Local)  │                 │   AzerothCore DBs       │
  │  - Account Maps   │                 │  - acore_auth           │
  │  - DBC Data       │                 │  - acore_characters     │
  └───────────────────┘                 │  - acore_world          │
                                        │  (per realm)            │
                                        └─────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (20+ recommended)
- **pnpm** (recommended) or npm
- **AzerothCore** server with accessible MySQL databases
- **Authentication**: Choose OAuth-Proxy, nginx basic auth, or direct WoW login

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/azeroth-management-portal.git
cd azeroth-management-portal

# Install dependencies
pnpm install

# Copy and configure environment
cp .env.example .env.local
# Edit .env.local with your database credentials
```

### Configuration

Create `.env.local` with your database credentials:

```bash
# Auth Database (shared across all realms)
NUXT_DB_AUTH_HOST=localhost
NUXT_DB_AUTH_PORT=3306
NUXT_DB_AUTH_USER=acore
NUXT_DB_AUTH_PASSWORD=acore

# Realm 0 - Primary realm
NUXT_DB_REALM_0_ID=1
NUXT_DB_REALM_0_NAME=Azeroth WotLK
NUXT_DB_REALM_0_DESCRIPTION=Classical WOTLK with PlayerBots
NUXT_DB_REALM_0_HOST=localhost
NUXT_DB_REALM_0_PORT=3306
NUXT_DB_REALM_0_USER=acore
NUXT_DB_REALM_0_PASSWORD=acore

# Realm 1 - Secondary realm (optional)
NUXT_DB_REALM_1_ID=2
NUXT_DB_REALM_1_NAME=Azeroth IP
NUXT_DB_REALM_1_HOST=localhost
NUXT_DB_REALM_1_PORT=3307
NUXT_DB_REALM_1_USER=acore
NUXT_DB_REALM_1_PASSWORD=acore

# Public settings
NUXT_PUBLIC_AUTH_MODE=mock
NUXT_PUBLIC_APP_BASE_URL=http://localhost:3000
```

### Development

```bash
# Start development server with mock authentication
pnpm dev

# Open http://localhost:3000
```

### Production Build

```bash
# Build for production
pnpm build:production

# Preview production build
pnpm preview
```

## 📖 Documentation

| Document                                 | Description                                   |
| ---------------------------------------- | --------------------------------------------- |
| [Setup Guide](docs/SETUP.md)             | Detailed installation and configuration       |
| [Configuration](docs/CONFIGURATION.md)   | Environment variables and realm configuration |
| [Authentication](docs/AUTHENTICATION.md) | Auth modes and setup guides                   |
| [API Reference](docs/API.md)             | Backend API endpoints                         |
| [Deployment](docs/DEPLOYMENT.md)         | Production deployment guide                   |
| [Development](docs/DEVELOPMENT.md)       | Contributing and local development            |

## 🔧 Tech Stack

- **Frontend**: [Nuxt 4](https://nuxt.com/), [Vue 3](https://vuejs.org/), [Pinia](https://pinia.vuejs.org/)
- **UI**: [PrimeVue](https://primevue.org/), SCSS
- **Backend**: [Nitro](https://nitro.unjs.io/) (Nuxt's server engine)
- **Databases**: MySQL (AzerothCore), SQLite (local data, DBC cache)
- **Authentication**: OAuth-Proxy, Nginx Basic Auth, Direct WoW Login, or Mock
- **Security**: SRP-6a password verification (AzerothCore compatible)

## 📜 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- [AzerothCore](https://www.azerothcore.org/) – The open-source WoW emulator
- [Nuxt](https://nuxt.com/) – The Vue framework for full-stack applications
- [OAuth2-Proxy](https://oauth2-proxy.github.io/oauth2-proxy/) – Identity-aware proxy for Kubernetes
