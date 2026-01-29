# Authentication Guide

This guide explains the authentication architecture and how to configure different authentication modes.

## Table of Contents

- [Overview](#overview)
- [Authentication Modes](#authentication-modes)
- [Mock Authentication](#mock-authentication)
- [External Header-Based Auth](#external-header-based-auth)
  - [OAuth2-Proxy Setup](#oauth2-proxy-setup)
  - [Nginx Basic Auth](#nginx-basic-auth)
  - [Any HTTP Header Provider](#any-http-header-provider)
- [Direct WoW Account Login](#direct-wow-account-login)
- [GM Level Detection](#gm-level-detection)
- [Account Linking](#account-linking)

## Overview

The Azeroth Management Portal supports **flexible authentication** by design. This means:

- **Multiple auth modes** – Choose the mode that fits your infrastructure
- **External authentication** – Use OAuth-Proxy, nginx basic auth, or any provider that sets HTTP headers
- **Direct WoW login** – Simple mode using WoW account credentials directly
- **Session-less API** – Each request is authenticated via headers or session cookies
- **Account linking** – External identities can be linked to WoW accounts (when using external auth)

This approach allows the portal to integrate with existing identity infrastructure without duplicating user management.

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Authentication Modes                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐     ┌──────────────┐     ┌──────────────────┐              │
│  │   Browser   │────▶│ Auth Proxy   │────▶│  Identity        │              │
│  │             │◀────│ (nginx/oauth)│◀────│  Provider        │              │
│  └─────────────┘     └──────────────┘     └──────────────────┘              │
│         │                   │                                                │
│         │  X-Auth Headers   │                                                │
│         ▼                   ▼                                                │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │                    Azeroth Portal                           │            │
│  │  ┌──────────────────────────────────────────────────────┐   │            │
│  │  │  /api/auth/me                                        │   │            │
│  │  │  1. Read auth headers (or session for direct mode)   │   │            │
│  │  │  2. Query GM level from linked accounts              │   │            │
│  │  │  3. Return user with isGM flag                       │   │            │
│  │  └──────────────────────────────────────────────────────┘   │            │
│  └─────────────────────────────────────────────────────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Authentication Modes

The `authMode` setting determines how authentication works:

| Mode          | Description               | Headers/Session       | Use Case                    |
| ------------- | ------------------------- | --------------------- | --------------------------- |
| `mock`        | Simulated user            | None                  | Local development           |
| `oauth-proxy` | OAuth2-Proxy headers      | `X-Auth-Request-*`    | Kubernetes with OAuth2Proxy |
| `header`      | Generic header-based auth | `X-Remote-User`, etc. | Nginx basic auth, custom    |
| `direct`      | Direct WoW account login  | Session cookie        | Simple deployments          |

### Configuring Auth Mode

Set the `NUXT_PUBLIC_AUTH_MODE` environment variable:

```bash
# For development
NUXT_PUBLIC_AUTH_MODE=mock

# For production with OAuth2-Proxy
NUXT_PUBLIC_AUTH_MODE=oauth-proxy

# For nginx basic auth or similar
NUXT_PUBLIC_AUTH_MODE=header

# For direct WoW account login
NUXT_PUBLIC_AUTH_MODE=direct
```

## Mock Authentication

Mock mode is for **local development only**. It simulates an authenticated user without requiring external services.

### Configuration

```bash
NUXT_PUBLIC_AUTH_MODE=mock
NUXT_PUBLIC_MOCK_USER=testuser
NUXT_PUBLIC_MOCK_EMAIL=test@localhost
NUXT_PUBLIC_MOCK_GM_LEVEL=3
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

## External Header-Based Auth

Both `oauth-proxy` and `header` modes read user information from HTTP headers set by an upstream proxy.

### Supported Headers

The portal checks these headers (in order of priority):

| Header                              | Purpose          |
| ----------------------------------- | ---------------- |
| `X-Auth-Request-Preferred-Username` | Username (OAuth) |
| `X-Forwarded-Preferred-Username`    | Username         |
| `X-Auth-Request-User`               | Username         |
| `X-Forwarded-User`                  | Username         |
| `X-Remote-User`                     | Username (nginx) |
| `X-Auth-Request-Email`              | Email            |
| `X-Forwarded-Email`                 | Email            |

### OAuth2-Proxy Setup

OAuth2-Proxy is recommended for Kubernetes deployments as it handles authentication at the ingress level.

#### Architecture

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

#### OAuth2-Proxy Configuration

Works with any OIDC provider (Keycloak, Auth0, Google, GitHub, etc.):

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
            - --provider=oidc # or keycloak-oidc, google, github, etc.
            - --oidc-issuer-url=https://your-idp.example.com
            - --client-id=azeroth-portal
            - --client-secret=$(CLIENT_SECRET)
            - --cookie-secret=$(COOKIE_SECRET)
            - --email-domain=*
            - --upstream=http://portal-service:3000
            - --http-address=0.0.0.0:4180
            - --set-xauthrequest=true
            - --pass-access-token=true
```

#### Ingress Configuration

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: portal-ingress
  annotations:
    nginx.ingress.kubernetes.io/auth-url: "http://oauth2-proxy.default.svc.cluster.local:4180/oauth2/auth"
    nginx.ingress.kubernetes.io/auth-signin: "https://portal.example.com/oauth2/start?rd=$escaped_request_uri"
    nginx.ingress.kubernetes.io/auth-response-headers: "X-Auth-Request-User,X-Auth-Request-Email,X-Auth-Request-Preferred-Username"
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

#### Portal Configuration

```bash
NUXT_PUBLIC_AUTH_MODE=oauth-proxy
```

### Nginx Basic Auth

For simple deployments, you can use nginx basic auth with the `header` mode.

#### Nginx Configuration

```nginx
server {
    listen 443 ssl;
    server_name portal.example.com;

    # SSL configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # Basic auth
    auth_basic "Azeroth Portal";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Pass authenticated username to the portal
        proxy_set_header X-Remote-User $remote_user;

        # Optional: You can add custom email header if needed
        # proxy_set_header X-Auth-Request-Email "$remote_user@example.com";
    }
}
```

#### Create Password File

```bash
# Create password file
htpasswd -c /etc/nginx/.htpasswd firstuser

# Add more users
htpasswd /etc/nginx/.htpasswd anotheruser
```

#### Portal Configuration

```bash
NUXT_PUBLIC_AUTH_MODE=header
```

### Any HTTP Header Provider

You can use any upstream service that sets HTTP headers. The portal looks for:

1. `X-Auth-Request-Preferred-Username` (preferred)
2. `X-Auth-Request-User`
3. `X-Forwarded-User`
4. `X-Remote-User`

## Direct WoW Account Login

For simple deployments without external authentication, use `direct` mode. Users log in with their WoW account credentials.

### Configuration

```bash
NUXT_PUBLIC_AUTH_MODE=direct
```

### Behavior

- Users log in with their WoW account username/password
- Password verified using SRP-6a (same as game client)
- Session stored in HTTP-only cookie
- **Account linking disabled** (user IS the WoW account)
- **GM access** based on `account_access` table for the logged-in account
- Email is **mandatory** for new account creation

### API Endpoints

| Endpoint           | Method | Description          |
| ------------------ | ------ | -------------------- |
| `/api/auth/login`  | POST   | Login with WoW creds |
| `/api/auth/logout` | POST   | Destroy session      |
| `/api/auth/me`     | GET    | Get current user     |

### Login Request

```json
POST /api/auth/login
{
  "username": "MyWowAccount",
  "password": "mypassword"
}
```

### Login Response

```json
{
	"success": true,
	"user": {
		"sub": "MYWOWACCOUNT",
		"preferred_username": "MYWOWACCOUNT",
		"email": "player@example.com",
		"email_verified": true,
		"isGM": true,
		"gmLevel": 3
	}
}
```

## GM Level Detection

The portal automatically detects GM status by querying the AzerothCore database.

### How It Works

#### For External Auth Modes (oauth-proxy, header)

1. User authenticates via external provider
2. Portal looks up account mappings for this external user
3. For each linked WoW account, queries `acore_auth.account_access`
4. Returns the highest GM level found

#### For Direct Mode

1. User logs in with WoW credentials
2. Portal directly queries `acore_auth.account_access` for that account
3. Returns the GM level

### Database Query

```sql
SELECT gmlevel
FROM account_access
WHERE id = ?
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
VALUES (account_id, 2, -1);
```

## Account Linking

Account linking connects an external identity to WoW accounts. **This is only available when using external authentication modes** (`oauth-proxy` or `header`).

### When Account Linking is Enabled

- Users can link multiple WoW accounts to their external identity
- Switching between accounts doesn't require re-authentication
- GM status is determined by the highest level among linked accounts

### When Account Linking is Disabled (Direct Mode)

- User IS the WoW account (no mapping needed)
- Each session is tied to a single WoW account
- Switch accounts by logging out and back in

### Linking Flow (External Auth Only)

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
│  external_id → wow_id   │
└─────────────────────────┘
```

### Security Considerations

- **Password Verification**: Uses SRP-6a (same as game client)
- **One-to-Many**: One external user can link multiple WoW accounts
- **Unique Links**: Each WoW account can only be linked to one external user
- **Unlink Anytime**: Users can unlink accounts from the portal

### API Endpoints (External Auth Only)

| Endpoint                                      | Method | Description         |
| --------------------------------------------- | ------ | ------------------- |
| `/api/accounts/user/:externalId`              | GET    | Get linked accounts |
| `/api/accounts/map`                           | POST   | Link a WoW account  |
| `/api/accounts/map/:externalId/:wowAccountId` | DELETE | Unlink account      |

### Troubleshooting

**"Invalid credentials"**

- Verify username and password are correct
- Password is case-sensitive
- Username stored uppercase in database

**"Account already linked"**

- WoW account is linked to another external user
- Admin can view/manage mappings in admin panel

**"Account not found"**

- Check username spelling
- Verify account exists in `acore_auth.account`

## Migration from Keycloak-Specific Setup

If you're migrating from an older version that used Keycloak-specific naming:

### Database Migration

Run the migration script to update your database schema:

```bash
node scripts/migrate-db-schema.js [path-to-database.db]
```

This will:

1. Create a backup of your database
2. Rename `keycloak_id` → `external_id`
3. Rename `keycloak_username` → `display_name`
4. Add `email` column

### Environment Variable Changes

| Old Variable                 | New Variable (if changed) |
| ---------------------------- | ------------------------- |
| `NUXT_PUBLIC_KEYCLOAK_URL`   | Removed                   |
| `NUXT_PUBLIC_KEYCLOAK_REALM` | Removed                   |

The portal no longer needs identity-provider-specific configuration. Use OAuth2-Proxy or another auth proxy to handle the OIDC flow.
