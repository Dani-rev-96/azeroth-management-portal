# Server Configuration

## Overview

All configuration is loaded from environment variables at runtime.
This is critical for Kubernetes deployments where env vars are injected at runtime.

## Configuration Sources

### Environment Variables (Runtime)

All realm and shop configuration comes from environment variables:

```bash
# Auth Database
NUXT_DB_AUTH_HOST=localhost
NUXT_DB_AUTH_PORT=3306
NUXT_DB_AUTH_USER=acore
NUXT_DB_AUTH_PASSWORD=acore

# Realm 0
NUXT_DB_REALM_0_ID=1
NUXT_DB_REALM_0_NAME=Azeroth WoTLK
NUXT_DB_REALM_0_DESCRIPTION=Classical WOTLK with PlayerBots
NUXT_DB_REALM_0_HOST=localhost
NUXT_DB_REALM_0_PORT=3307
NUXT_DB_REALM_0_USER=acore
NUXT_DB_REALM_0_PASSWORD=acore

# Realm 0 SOAP (optional)
NUXT_DB_REALM_0_SOAP_ENABLED=true
NUXT_DB_REALM_0_SOAP_HOST=127.0.0.1
NUXT_DB_REALM_0_SOAP_PORT=7878
NUXT_DB_REALM_0_SOAP_USERNAME=soap_user
NUXT_DB_REALM_0_SOAP_PASSWORD=soap_password

# Shop Configuration
NUXT_SHOP_ENABLED=true
NUXT_PUBLIC_SHOP_DELIVERY_METHOD=mail
NUXT_PUBLIC_SHOP_MARKUP_PERCENT=20
```

## Usage

### Server-side (API routes)

```typescript
import { getRealms, getRealmConfig, getAuthDbConfig, getShopConfig } from "#server/utils/config";

// Get all configured realms
const realms = getRealms();

// Get specific realm config (includes db credentials)
const realmConfig = getRealmConfig("1");

// Get auth database config
const authDb = getAuthDbConfig();

// Get shop configuration
const shopConfig = getShopConfig();
```

### Client-side (Components)

Clients should fetch realm info from the API endpoint:

```typescript
// In a composable or component
const { data: realms } = await useFetch("/api/realms");
```

## Important Notes

- **No hardcoded realm lists**: All realms are configured via environment variables
- **Realm IDs are strings**: Use numeric-like IDs ("1", "2", "3") from the game's realmlist table
- **Database credentials are server-only**: Never expose credentials to the client
- **SOAP is optional per-realm**: Configure only for realms that need bag delivery
