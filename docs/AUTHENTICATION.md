# Authentication Guide

This guide explains the authentication architecture and how to configure different authentication modes.

## Table of Contents

- [Overview](#overview)
- [Authentication Modes](#authentication-modes)
- [Mock Authentication](#mock-authentication)
- [Keycloak Setup](#keycloak-setup)
- [OAuth-Proxy Setup](#oauth-proxy-setup)
- [GM Level Detection](#gm-level-detection)
- [Account Linking](#account-linking)

## Overview

The Azeroth Management Portal uses **external authentication** by design. This means:

- **No built-in user database** – Users are managed externally (Keycloak, OAuth-Proxy)
- **Session-less API** – Each request is authenticated via headers or tokens
- **Account linking** – External identities are linked to WoW accounts

This approach allows the portal to integrate with existing identity infrastructure without duplicating user management.

### Authentication Flow

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐
│   Browser   │────▶│ OAuth-Proxy  │────▶│  Keycloak        │
│             │◀────│ (or direct)  │◀────│  (Identity)      │
└─────────────┘     └──────────────┘     └──────────────────┘
       │                   │
       │  X-Auth Headers   │
       ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Azeroth Portal                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  /api/auth/me                                        │   │
│  │  1. Read auth headers (or mock user)                 │   │
│  │  2. Query GM level from acore_auth.account_access    │   │
│  │  3. Return user with isGM flag                       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Authentication Modes

The `authMode` setting in your credentials file determines how authentication works:

| Mode          | Description          | Headers            | Use Case              |
| ------------- | -------------------- | ------------------ | --------------------- |
| `mock`        | Simulated user       | None               | Local development     |
| `oauth-proxy` | OAuth2-Proxy headers | `X-Auth-Request-*` | Kubernetes production |
| `keycloak`    | Direct Keycloak      | Token              | Staging/testing       |

### Configuring Auth Mode

```json
// .db.local.json
{
	"env": {
		"authMode": "mock",
		"mockUser": "admin",
		"mockEmail": "admin@localhost",
		"mockGMLevel": 3
	}
}
```

## Mock Authentication

Mock mode is for **local development only**. It simulates an authenticated user without requiring external services.

### Configuration

```json
{
	"env": {
		"authMode": "mock",
		"mockUser": "testuser",
		"mockEmail": "test@localhost",
		"mockGMLevel": 3
	}
}
```

### Behavior

- All requests are treated as authenticated
- The mock user has the configured GM level
- No login/logout actually occurs
- Useful for testing all features including admin panel

### GM Levels

| Level | Description    |
| ----- | -------------- |
| 0     | Regular player |
| 1     | Trial GM       |
| 2     | GM             |
| 3     | Administrator  |

## Keycloak Setup

Keycloak provides enterprise-grade identity management with support for SSO, MFA, and federated identity.

### Prerequisites

- Keycloak 20+ running and accessible
- Admin access to create realm and clients

### 1. Create Realm

1. Log into Keycloak Admin Console
2. Create a new realm (e.g., `wow`)
3. Configure realm settings:
   - **Login** → Enable "User registration" if desired
   - **Tokens** → Set appropriate lifetimes

### 2. Create Client

1. Go to **Clients** → **Create client**
2. Configure:
   - **Client ID**: `azeroth-portal`
   - **Client Protocol**: `openid-connect`
   - **Access Type**: `confidential` or `public`
   - **Valid Redirect URIs**: `https://portal.example.com/*`
   - **Web Origins**: `https://portal.example.com`

### 3. Configure Portal

```json
// .db.production.json
{
	"env": {
		"authMode": "keycloak",
		"keycloakUrl": "https://keycloak.example.com",
		"keycloakRealm": "wow",
		"appBaseUrl": "https://portal.example.com"
	}
}
```

### 4. User Attributes

The portal reads these claims from the Keycloak token:

| Claim                | Usage                     |
| -------------------- | ------------------------- |
| `sub`                | Unique user identifier    |
| `preferred_username` | Display name              |
| `email`              | User email                |
| `email_verified`     | Email verification status |

## OAuth-Proxy Setup

OAuth2-Proxy is recommended for Kubernetes deployments as it handles authentication at the ingress level.

### Architecture

```
┌────────────┐    ┌───────────────┐    ┌─────────────────┐
│   Client   │───▶│   Ingress     │───▶│  OAuth2-Proxy   │
│            │    │   (nginx)     │    │                 │
└────────────┘    └───────────────┘    └────────┬────────┘
                                                │
                         ┌──────────────────────┘
                         │  X-Auth-Request-User
                         │  X-Auth-Request-Email
                         ▼
                  ┌──────────────────┐
                  │  Portal Backend  │
                  │  /api/auth/me    │
                  └──────────────────┘
```

### OAuth2-Proxy Configuration

```yaml
# oauth2-proxy deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: oauth2-proxy
spec:
  template:
    spec:
      containers:
        - name: oauth2-proxy
          image: quay.io/oauth2-proxy/oauth2-proxy:latest
          args:
            - --provider=keycloak-oidc
            - --oidc-issuer-url=https://keycloak.example.com/realms/wow
            - --client-id=azeroth-portal
            - --client-secret=$(CLIENT_SECRET)
            - --cookie-secret=$(COOKIE_SECRET)
            - --email-domain=*
            - --upstream=http://portal-service:3000
            - --http-address=0.0.0.0:4180
            - --set-xauthrequest=true
            - --pass-access-token=true
```

### Ingress Configuration

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: portal-ingress
  annotations:
    nginx.ingress.kubernetes.io/auth-url: "http://oauth2-proxy.default.svc.cluster.local:4180/oauth2/auth"
    nginx.ingress.kubernetes.io/auth-signin: "https://portal.example.com/oauth2/start?rd=$escaped_request_uri"
    nginx.ingress.kubernetes.io/auth-response-headers: "X-Auth-Request-User,X-Auth-Request-Email"
spec:
  rules:
    - host: portal.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: portal-service
                port:
                  number: 3000
```

### Portal Configuration

```json
{
	"env": {
		"authMode": "oauth-proxy"
	}
}
```

### Headers Used

| Header                        | Description                            |
| ----------------------------- | -------------------------------------- |
| `X-Auth-Request-User`         | Username (Keycloak preferred_username) |
| `X-Auth-Request-Email`        | User email                             |
| `X-Auth-Request-Access-Token` | JWT access token (optional)            |

## GM Level Detection

The portal automatically detects GM status by querying the AzerothCore database.

### How It Works

1. User authenticates (any mode)
2. Portal queries `acore_auth.account_access` for matching username
3. If GM level > 0, user gets `isGM: true` in their session
4. Admin panel becomes accessible

### Database Query

```sql
SELECT gmlevel
FROM account_access aa
JOIN account a ON a.id = aa.id
WHERE a.username = UPPER('username')
ORDER BY gmlevel DESC
LIMIT 1
```

### GM Levels in AzerothCore

| Level | Name          | Permissions           |
| ----- | ------------- | --------------------- |
| 0     | Player        | No special access     |
| 1     | Moderator     | Limited GM commands   |
| 2     | GM            | Full GM commands      |
| 3     | Administrator | Server administration |

### Granting GM Access

```sql
-- Grant GM level 2 to user
INSERT INTO account_access (id, gmlevel, RealmID)
SELECT id, 2, -1 FROM account WHERE username = 'USERNAME';
```

## Account Linking

Users link their external identity (Keycloak) to WoW accounts stored in `acore_auth`.

### Linking Flow

```
┌─────────────┐
│  Frontend   │
│  User Form  │
└──────┬──────┘
       │ POST /api/accounts/map
       │ { wowAccountName, wowAccountPassword }
       ▼
┌──────────────────────────────────────────────────────────┐
│  Backend Validation                                      │
│  1. Find WoW account by username                         │
│  2. Verify password using SRP-6a                         │
│  3. Check account not already linked to another user     │
│  4. Create mapping in SQLite                             │
└──────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────┐
│  SQLite: account_maps   │
│  keycloak_id → wow_id   │
└─────────────────────────┘
```

### Security Considerations

- **Password Verification**: Uses SRP-6a (same as game client)
- **One-to-Many**: One Keycloak user can link multiple WoW accounts
- **Unique Links**: Each WoW account can only be linked to one Keycloak user
- **Unlink Anytime**: Users can unlink accounts from the portal

### API Endpoints

| Endpoint                                      | Method | Description         |
| --------------------------------------------- | ------ | ------------------- |
| `/api/accounts/user/:keycloakId`              | GET    | Get linked accounts |
| `/api/accounts/map`                           | POST   | Link a WoW account  |
| `/api/accounts/map/:keycloakId/:wowAccountId` | DELETE | Unlink account      |

### Troubleshooting

**"Invalid credentials"**

- Verify username and password are correct
- Password is case-sensitive
- Username stored uppercase in database

**"Account already linked"**

- WoW account is linked to another Keycloak user
- Admin can view/manage mappings in admin panel

**"Account not found"**

- Check username spelling
- Verify account exists in `acore_auth.account`
