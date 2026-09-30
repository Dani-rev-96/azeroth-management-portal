# Deployment Guide

Production deployment guide for the Azeroth Management Portal.

## Table of Contents

- [Deployment Options](#deployment-options)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Reverse Proxy Setup](#reverse-proxy-setup)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Production Checklist](#production-checklist)
- [Backups](#backups)
- [Monitoring](#monitoring)

## Deployment Options

| Method         | Complexity | Best For                    |
| -------------- | ---------- | --------------------------- |
| Docker Compose | Low        | Single server, small setups |
| Kubernetes     | High       | Scalable, enterprise        |
| Node.js Direct | Low        | VPS, simple hosting         |

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built application
COPY --from=builder /app/.output .output
COPY --from=builder /app/data ./data
COPY --from=builder /app/server/assets ./server/assets

# Set environment
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
```

### Docker Compose

```yaml
version: "3.8"

services:
  portal:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      # Auth Database
      - NUXT_DB_AUTH_HOST=db
      - NUXT_DB_AUTH_PORT=3306
      - NUXT_DB_AUTH_USER=acore
      - NUXT_DB_AUTH_PASSWORD=${DB_PASSWORD}
      # Realm 0
      - NUXT_DB_REALM_0_ID=1
      - NUXT_DB_REALM_0_NAME=Azeroth WotLK
      - NUXT_DB_REALM_0_DESCRIPTION=Blizzlike
      - NUXT_DB_REALM_0_HOST=db
      - NUXT_DB_REALM_0_PORT=3306
      - NUXT_DB_REALM_0_USER=acore
      - NUXT_DB_REALM_0_PASSWORD=${DB_PASSWORD}
      # Public settings
      - NUXT_PUBLIC_AUTH_MODE=oauth-proxy
      - NUXT_PUBLIC_APP_BASE_URL=https://portal.example.com
    volumes:
      - ./data:/app/data
    restart: unless-stopped
    depends_on:
      - oauth2-proxy
    networks:
      - portal-net

  oauth2-proxy:
    image: quay.io/oauth2-proxy/oauth2-proxy:latest
    command:
      - --provider=oidc # Works with any OIDC provider (Keycloak, Auth0, Google, etc.)
      - --oidc-issuer-url=https://your-idp.example.com/realms/wow
      - --client-id=azeroth-portal
      - --client-secret=${OAUTH_CLIENT_SECRET}
      - --cookie-secret=${OAUTH_COOKIE_SECRET}
      - --upstream=http://portal:3000
      - --http-address=0.0.0.0:4180
      - --email-domain=*
      - --set-xauthrequest=true
    ports:
      - "4180:4180"
    networks:
      - portal-net

networks:
  portal-net:
    driver: bridge
```

### Building and Running

```bash
# Build image
docker build -t azeroth-portal:latest .

# Run with docker compose
docker compose up -d

# View logs
docker compose logs -f portal
```

## Kubernetes Deployment

### ConfigMap for Non-Sensitive Settings

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: azeroth-portal-env
  namespace: wow
data:
  # Auth Database
  NUXT_DB_AUTH_HOST: "wow-acore-auth-db"
  NUXT_DB_AUTH_PORT: "3306"
  NUXT_DB_AUTH_USER: "acore"

  # Realm 0
  NUXT_DB_REALM_0_ID: "1"
  NUXT_DB_REALM_0_NAME: "Azeroth WotLK"
  NUXT_DB_REALM_0_DESCRIPTION: "Blizzlike"
  NUXT_DB_REALM_0_HOST: "wow-acore-blizzlike-db"
  NUXT_DB_REALM_0_PORT: "3306"
  NUXT_DB_REALM_0_USER: "acore"

  # Realm 1 (optional)
  NUXT_DB_REALM_1_ID: "2"
  NUXT_DB_REALM_1_NAME: "Individual IP"
  NUXT_DB_REALM_1_DESCRIPTION: "Individual Progression Realm"
  NUXT_DB_REALM_1_HOST: "wow-acore-ip-db"
  NUXT_DB_REALM_1_PORT: "3306"
  NUXT_DB_REALM_1_USER: "acore"

  # Public settings
  NUXT_PUBLIC_AUTH_MODE: "oauth-proxy"
  NUXT_PUBLIC_APP_BASE_URL: "https://wow.example.com"
```

### Secret for Passwords

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: azeroth-portal-secrets
  namespace: wow
type: Opaque
stringData:
  acore-password: "your-secure-password"
```

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: azeroth-portal
  namespace: wow
spec:
  replicas: 2
  selector:
    matchLabels:
      app: azeroth-portal
  template:
    metadata:
      labels:
        app: azeroth-portal
    spec:
      containers:
        - name: azeroth-portal
          image: your-registry/azeroth-portal:latest
          ports:
            - containerPort: 80
          env:
            - name: NITRO_PORT
              value: "80"
            # Passwords from secret
            - name: NUXT_DB_AUTH_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: azeroth-portal-secrets
                  key: acore-password
            - name: NUXT_DB_REALM_0_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: azeroth-portal-secrets
                  key: acore-password
            - name: NUXT_DB_REALM_1_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: azeroth-portal-secrets
                  key: acore-password
          envFrom:
            # Non-sensitive config from ConfigMap
            - configMapRef:
                name: azeroth-portal-env
          volumeMounts:
            - name: data
              mountPath: /data
          resources:
            requests:
              memory: "256Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          readinessProbe:
            httpGet:
              path: /api/realms
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /api/realms
              port: 80
            initialDelaySeconds: 15
            periodSeconds: 20
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: portal-data
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: azeroth-portal
  namespace: wow
spec:
  selector:
    app: azeroth-portal
  ports:
    - port: 80
      targetPort: 80
```

### Ingress with OAuth2-Proxy

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: azeroth-portal
  namespace: wow
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/auth-url: "https://portal.example.com/oauth2/auth"
    nginx.ingress.kubernetes.io/auth-signin: "https://portal.example.com/oauth2/start?rd=$escaped_request_uri"
    nginx.ingress.kubernetes.io/auth-response-headers: "X-Auth-Request-User,X-Auth-Request-Email"
    nginx.ingress.kubernetes.io/proxy-body-size: "50g"
spec:
  tls:
    - hosts:
        - portal.example.com
      secretName: portal-tls
  rules:
    - host: portal.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: azeroth-portal
                port:
                  number: 80
```

### PersistentVolumeClaim

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: portal-data
  namespace: wow
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

## Reverse Proxy Setup

### Nginx Configuration

```nginx
upstream portal {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name portal.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name portal.example.com;

    ssl_certificate /etc/letsencrypt/live/portal.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/portal.example.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # File upload size (for downloads feature)
    client_max_body_size 50G;

    location / {
        proxy_pass http://portal;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Downloads with resume support
    location /api/downloads/ {
        proxy_pass http://portal;
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
```

### Caddy Configuration

```caddyfile
portal.example.com {
    reverse_proxy localhost:3000

    # Large file uploads
    request_body {
        max_size 50GB
    }

    # Security headers
    header {
        X-Frame-Options DENY
        X-Content-Type-Options nosniff
        X-XSS-Protection "1; mode=block"
    }
}
```

## SSL/TLS Configuration

### Let's Encrypt with Certbot

```bash
# Install certbot
apt install certbot python3-certbot-nginx

# Get certificate
certbot --nginx -d portal.example.com

# Auto-renewal (usually configured automatically)
systemctl status certbot.timer
```

### Development SSL with mkcert

```bash
# Install mkcert
brew install mkcert  # macOS
# or: apt install mkcert  # Linux

# Install local CA
mkcert -install

# Generate certificates
mkdir certs
cd certs
mkcert -cert-file localhost.pem -key-file localhost-key.pem localhost

# Run with SSL
npm run dev:ssl
```

## Production Checklist

### Security

- [ ] Enable HTTPS only
- [ ] Set secure headers (CSP, HSTS, etc.)
- [ ] Encrypt credentials with SOPS
- [ ] Use non-root user in container
- [ ] Enable rate limiting
- [ ] Regular security updates

### Performance

- [ ] Enable response compression (gzip/brotli)
- [ ] Configure proper caching headers
- [ ] Use CDN for static assets
- [ ] Enable HTTP/2

### Reliability

- [ ] Set up health checks
- [ ] Configure restart policies
- [ ] Set resource limits
- [ ] Enable logging
- [ ] Set up monitoring
- [ ] Configure backups for SQLite data

### Configuration

- [ ] Set `NODE_ENV=production`
- [ ] Use encrypted credentials
- [ ] Configure proper auth mode
- [ ] Set correct `appBaseUrl`
- [ ] Test all realm connections

## Backups

> ⚠️ **Never restore straight into production.** Restores only go through the (upcoming)
> restore-drill procedure against a **non-production MySQL** (a local `mysql:9` started with podman;
> see Phase 4 of the backup plan / `scripts/restore-drill.sh`). Do not pipe a dump into the
> `wow-acore-*-db` servers by hand, and do not swap SQLite files under the running portal.

The k3s deployment ships the backup infrastructure in `k3s/base/backups/` (applied by
`k3s/deploy.sh`) and `k3s/longhorn/` (applied by hand). The operator runbook, in German, is in
[`k3s/README.md`](../k3s/README.md#backups). The Longhorn part is in
[`k3s/longhorn/README.md`](../k3s/longhorn/README.md).

### What runs when

| When (Europe/Berlin)  | What                                                             | Output |
|-----------------------|------------------------------------------------------------------|--------|
| daily 02:00 ¹         | Longhorn RecurringJob `wow-snapshot-daily` (task snapshot, retain 7) | Longhorn snapshots on the node's disk |
| daily 03:15           | CronJob `portal-sqlite-backup` (`keinos/sqlite3:3.46.1`)         | PVC `wow-backups` → `/backups/sqlite` |
| daily 03:30           | CronJob `mysql-backup` (`mysql:9`, same image as the DB servers) | PVC `wow-backups` → `/backups/mysql` |
| Sunday 04:00 ¹        | Longhorn RecurringJob `wow-backup-weekly` (task backup, retain 4) | Longhorn backup target (off-site) |

¹ Longhorn evaluates the cron expression in the kube-controller-manager's time zone. The `backup`
task needs a Longhorn backup target. As of 2026-09-30 **none is configured**
(`BackupTarget default`: `backupTargetURL: ""`), so only the snapshot job should be applied for now.

- `mysql-backup` runs `mysqldump --single-transaction --routines --triggers --events
  --set-gtid-purged=OFF --no-tablespaces` for `acore_auth` and for each realm's `acore_characters`.
  `acore_world` is only dumped with `BACKUP_WORLD=true`. Hosts and realm ids come from the
  `wow-frontend-env` ConfigMap. The password is `acore-secrets/acore-user-password`, passed as
  `MYSQL_PWD`.
- `portal-sqlite-backup` mounts `wow-frontend-sqllite-data` **read-only** next to the running portal
  pod (required podAffinity; the PVC is RWO). It copies `mappings.db`, `user-settings.db` and
  `portal-config.db` with `sqlite3 'file:…?mode=ro' .backup`, then runs `PRAGMA integrity_check`
  on the copy.
- Both jobs: `concurrencyPolicy: Forbid`, `backoffLimit: 1`, run as uid/gid 999 with a read-only
  root filesystem. If one database fails, the others still run and the job exits non-zero.

### Where the files go

```text
/backups/mysql/status.json                     last run: per target lastRunAt, lastSuccessAt, lastBackup, lastError
/backups/mysql/<database>/<target>/<ts>.sql.gz one database per file, no CREATE DATABASE/USE
/backups/mysql/<database>/<target>/<ts>.json   manifest: database, target, realmId, host, serverVersion,
                                               createdAt, sizeBytes, sha256 (of the .gz), durationSec,
                                               tables {name: rowEstimate}
/backups/sqlite/status.json
/backups/sqlite/<name>/<ts>.db.gz              name = mappings | user-settings | portal-config
/backups/sqlite/<name>/<ts>.json               manifest incl. integrityCheck and exact row counts
```

Targets are `auth`, `realm1`, `realm2`, `realm3` (the realm id). `<ts>` is the UTC start time,
`YYYYMMDDTHHMMSSZ`. Files are written as `.partial` and only renamed once every check passed:
both pipeline exit codes, `gzip -t`, and for SQLite `integrity_check`. Retention runs per target,
and only after a successful backup. It keeps everything from the last 7 days, plus the newest
backup of each of the last 4 ISO weeks and the newest of each of the last 6 months that have
backups. The dump and its manifest are deleted together.
The scripts live in `k3s/base/backups/scripts/`, with links in `scripts/backup/`. They support
`DRY_RUN=1` and are tested in `tests/unit/scripts/backup/`.

### Trigger a manual run

```bash
kubectl create job --from=cronjob/mysql-backup mysql-backup-manual-$(date +%s) -n wow
kubectl create job --from=cronjob/portal-sqlite-backup portal-sqlite-backup-manual-$(date +%s) -n wow
kubectl get jobs,pods -n wow -l app.kubernetes.io/part-of=wow-backups
kubectl logs -n wow job/<job-name>
```

### Copy a backup out and verify it

```bash
# helper pod that mounts wow-backups read-only (image has tar for kubectl cp, and sqlite3)
kubectl run wow-backups-shell -n wow --restart=Never --image=keinos/sqlite3:3.46.1 --overrides='{
  "spec": {
    "securityContext": {"runAsUser": 999, "runAsGroup": 999},
    "containers": [{"name": "wow-backups-shell", "image": "keinos/sqlite3:3.46.1",
      "command": ["sleep", "3600"],
      "volumeMounts": [{"name": "backups", "mountPath": "/backups", "readOnly": true}]}],
    "volumes": [{"name": "backups", "persistentVolumeClaim": {"claimName": "wow-backups", "readOnly": true}}]
  }}'
kubectl wait -n wow --for=condition=Ready pod/wow-backups-shell
kubectl exec -n wow wow-backups-shell -- cat /backups/mysql/status.json

TS=20260930T013000Z
kubectl cp wow/wow-backups-shell:/backups/mysql/acore_auth/auth/$TS.sql.gz ./$TS.sql.gz
kubectl cp wow/wow-backups-shell:/backups/mysql/acore_auth/auth/$TS.json ./$TS.json
kubectl delete pod -n wow wow-backups-shell

gzip -t $TS.sql.gz
sha256sum $TS.sql.gz; grep '"sha256"' $TS.json      # must match
# SQLite: gunzip -c <ts>.db.gz > check.db && sqlite3 check.db 'PRAGMA integrity_check'   # → ok
```

### Known limitations

- `wow-backups` is on the same node and Longhorn disk as the databases. An off-site copy only
  exists once a Longhorn backup target is configured. Then add `wow-backups` to the `wow-backup`
  group as well.
- If a database contains stored routines, the `acore` user needs the global `SHOW_ROUTINE`
  privilege. Without it the dump fails loudly. MySQL 9's mysqldump prints a harmless
  `column_masking_policy` warning for users without access to the `mysql` schema.
- The SQLite job runs as uid 999 and assumes the portal's database files are world-readable.
  If `portal-sqlite-backup` fails with `unable to open database file`, set `runAsUser: 0` **and**
  `runAsNonRoot: false` in `k3s/base/backups/sqlite-cronjob.yaml` (the source stays read-only).
- No staleness alert yet ("newest backup older than 36 h"). `status.json` is the data source for
  it.

## Monitoring

### Health Endpoint

The portal exposes health information via the auth endpoint:

```bash
curl https://portal.example.com/api/auth/me
# Returns 401 if not authenticated (healthy)
# Returns 500 if database issues
```

### Prometheus Metrics (Optional)

Add Prometheus metrics with a Nuxt module:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
	modules: ["nuxt-prometheus"],
	prometheus: {
		path: "/metrics",
	},
});
```

### Log Aggregation

Logs are output to stdout/stderr. Aggregate with:

- **Docker**: Docker logging drivers
- **Kubernetes**: Fluent Bit, Loki
- **Cloud**: CloudWatch, Stackdriver

### Example Grafana Dashboard

Monitor these key metrics:

- Request rate and latency
- Error rate (4xx, 5xx)
- Database connection pool
- Memory usage
- Active connections

### Alerts

Set up alerts for:

- High error rate (> 1%)
- High latency (> 2s p95)
- Database connection failures
- Memory pressure
- Disk space (for SQLite data)
