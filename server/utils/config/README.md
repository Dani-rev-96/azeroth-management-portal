# Server Configuration Structure

## Overview

The configuration has been split into two parts for security:

### Public Configuration (`shared/utils/config/`)

Contains realm metadata that can be safely shared with the client:

- Realm names, IDs, descriptions
- Port numbers
- Database keys (references only, no credentials)

**Files:**

- `shared/utils/config/index.ts` - Main export with `useServerConfig()`
- `shared/utils/config/local.ts` - Local development realm config
- `shared/utils/config/production.ts` - Production realm config

**Usage:**

```typescript
// Client-side (pages, components)
const { realms } = await useServerConfig();

// Server-side (API routes) - for realm metadata only
const serverConfig = await useServerConfig();
console.log(serverConfig.realms);
```

### Private Configuration (`server/utils/config/`)

Contains sensitive database credentials (SERVER-SIDE ONLY):

- Database hosts, ports
- Database usernames and passwords
- Connection details

**Files:**

- `server/utils/config/index.ts` - Main export with `useServerDatabaseConfig()`
- `server/utils/config/local.ts` - Local development database credentials
- `server/utils/config/production.ts` - Production database credentials

**Usage:**

```typescript
// Server-side ONLY (API routes, server utils)
import { useServerDatabaseConfig } from "#server/utils/config";

const { databaseConfigs } = await useServerDatabaseConfig();
// Use databaseConfigs for database connections
```

## Migration Notes

The database credentials have been moved from `shared/` to `server/` to prevent them from being exposed to the client. The `useServerConfig()` composable now only returns realm metadata without database credentials.

All API routes and server utilities automatically use the correct configuration source.
