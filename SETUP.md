# WoW Management Frontend

A modern Nuxt 4 frontend for managing AzerothCore multi-realm WoW server installations. Designed to be deployed on Kubernetes with Keycloak authentication via OAuth-Proxy.

## Features

- **Multi-Realm Support**: Manage characters across multiple WOTLK realms
- **Keycloak Authentication**: OAuth-Proxy protected with header-based auth
- **Account Mapping**: Link Keycloak accounts to WoW accounts
- **Responsive Design**: Mobile-friendly interface built with Tailwind CSS
- **Pinia State Management**: Centralized store for auth and accounts
- **Nuxt 4**: Modern Vue 3 framework with auto-imports and SSR

## Project Structure

```
app/
├── components/          # Reusable Vue components
│   └── LinkAccountForm.vue
├── composables/         # Vue 3 composables
│   └── useAuth.ts
├── layouts/             # Page layouts
│   └── default.vue
├── pages/               # File-based routing
│   ├── index.vue        # Dashboard
│   └── login.vue        # Login page
├── stores/              # Pinia stores
│   ├── auth.ts          # Authentication store
│   └── accounts.ts      # Account management store
├── types/               # TypeScript interfaces
│   └── index.ts
├── utils/               # Utility functions
│   └── config.ts        # Realm and server configuration

server/
└── api/                 # Nitro API routes
    ├── auth/
    │   ├── me.get.ts
    │   └── logout.post.ts
    └── accounts/
        ├── user/[keycloakId].get.ts
        ├── map.post.ts
        └── map/[keycloakId]/[wowAccountId].delete.ts
```

## Configuration

### Realm Configuration

Realms are configured in [app/utils/config.ts](app/utils/config.ts):

- **Realm 1** (Classical WOTLK):
  - World Server: `wow-wotlk-world:8085`
  - SOAP Port: `7878`
  - Database: `wow-acore-db:3306` (acore_world, acore_auth, acore_characters)

- **Realm 2** (Individual Progression):
  - World Server: `wow-wotlk-world-ip:8086`
  - SOAP Port: `7879`
  - Database: `wow-acore-db-ip:3306` (acore_world_ip, acore_characters_ip)

- **Auth Server**: `wow-wotlk-auth:3724`

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Keycloak Configuration
NUXT_PUBLIC_KEYCLOAK_REALM=wow-management
NUXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080

# Directus Configuration (future use)
NUXT_PUBLIC_DIRECTUS_URL=http://localhost:8055

# API Base
NUXT_PUBLIC_API_BASE=http://localhost:3000
```

## Authentication Flow

1. User visits the application
2. OAuth-Proxy intercepts the request and redirects to Keycloak
3. User authenticates with Keycloak
4. OAuth-Proxy sets headers (`X-Remote-User`, `X-Auth-Request-Email`, etc.)
5. Frontend reads headers via backend API `/api/auth/me`
6. User is logged in and can manage WoW accounts

## API Endpoints

### Authentication

- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Account Management

- `GET /api/accounts/user/:keycloakId` - Get all mapped accounts
- `POST /api/accounts/map` - Create Keycloak → WoW account mapping
- `DELETE /api/accounts/map/:keycloakId/:wowAccountId` - Remove mapping

## Development

### Prerequisites

- Node.js 18+
- pnpm (recommended)

### Setup

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## Deployment on Kubernetes

### Docker Image

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

### ConfigMap for realm configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: wow-frontend-config
data:
  # Realm servers will be auto-discovered via Kubernetes service DNS
  # wow-wotlk-world, wow-wotlk-auth, etc.
```

### OAuth-Proxy integration

The application expects to run behind OAuth-Proxy:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wow-frontend
spec:
  template:
    spec:
      containers:
        - name: oauth-proxy
          image: quay.io/oauth2-proxy/oauth2-proxy:latest
          args:
            - --provider=keycloak
            - --oidc-issuer-url=https://keycloak.example.com/auth/realms/wow-management
            # ... more config
        - name: frontend
          image: wow-frontend:latest
          ports:
            - containerPort: 3000
```

## Future Features

- Directus integration for CMS
- Character management (items, reputation, etc.)
- Server statistics and monitoring
- SOAP command execution
- Ban/mute management
- Transaction history

## Technologies Used

- **Nuxt 4** - Vue 3 meta-framework
- **TypeScript** - Type safety
- **Pinia** - State management
- **Tailwind CSS** - Styling
- **Nitro** - Server framework
- **PrimeVue** - UI components (available)

## License

MIT
