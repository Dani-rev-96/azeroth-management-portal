# Kubernetes Konfiguration

## Struktur

```
k3s/
├── deploy.sh                          # ← ENTRY POINT
├── README.md
│
├── base/                              # Gemeinsame Ressourcen
│   ├── kustomization.yaml             # Listet alle Base-Ressourcen
│   ├── basics/                        # Namespace, Certificate
│   ├── postgresql/
│   ├── directus/
│   ├── wow-wotlk.dani-home.de/
│   ├── ingress/
│   └── backups/                       # Backup-PVC + CronJobs (mysql, sqlite) + Scripts
│
├── longhorn/                          # Longhorn RecurringJobs (longhorn-system, manuell!)
│
└── overlays/
    └── production/
        ├── kustomization.yaml         # Importiert base + kann Patches hinzufügen
        ├── .gitignore
        ├── postgresql-secrets.yaml.example
        ├── directus-secrets.yaml.example
        ├── postgresql-secrets.enc.yaml  # ← SOPS verschlüsselt (du erstellst)
        └── directus-secrets.enc.yaml    # ← SOPS verschlüsselt (du erstellst)
```

## Wie es funktioniert

```
                    deploy.sh
                        │
           ┌────────────┴────────────┐
           │                         │
           ▼                         ▼
    SOPS decrypt              kubectl apply -k
    *-secrets.enc.yaml        overlays/production/
           │                         │
           │                         ▼
           │              overlays/production/kustomization.yaml
           │                         │
           │                         │ resources: [../../base]
           │                         ▼
           │                  base/kustomization.yaml
           │                         │
           ▼                         ▼
    kubectl apply -f         Alle Base-Ressourcen
```

## Image / Registry

Das `wow-frontend`-Image kommt aus **GHCR** (öffentliches Package):
`ghcr.io/dani-rev-96/azeroth-management-portal:<version>` — die Version ist die
aus `package.json` und muss mit dem Tag im Deployment übereinstimmen.

- `imagePullSecrets: docker-ghcr` — der Secret liegt bereits im Namespace `wow`
  und wird von `wow-frontend-infra` verwaltet, hier also nicht anlegen.
- Der **erste Push muss aus dem CI** kommen (`.github/workflows/build.yml`):
  Ein GHCR-Package ist nur dann an das Repo gekoppelt, wenn ein Workflow es
  anlegt — nur dann bekommt `GITHUB_TOKEN` Schreibrechte. Ein manuell angelegtes
  Package ist nicht gekoppelt und antwortet mit 403 auf Blob-Uploads.
- Der lokale Weg über podman (`nix run .#buildAndPush` → `docker-hosted.dani-home.de`)
  bleibt unverändert; er nutzt den `packages.image`-Output, nicht `packages.ghcr`.

## Deployment

### Einmalig: Secrets erstellen

```bash
cd k3s/overlays/production

# 1. Beispiele kopieren
cp postgresql-secrets.yaml.example postgresql-secrets.yaml
cp directus-secrets.yaml.example directus-secrets.yaml

# 2. Echte Werte eintragen
nano postgresql-secrets.yaml
nano directus-secrets.yaml

# 3. Verschlüsseln
sops -e postgresql-secrets.yaml > postgresql-secrets.enc.yaml
sops -e directus-secrets.yaml > directus-secrets.enc.yaml

# 4. Unverschlüsselte löschen!
rm postgresql-secrets.yaml directus-secrets.yaml
```

### Deployment ausführen

```bash
./k3s/deploy.sh
```

Das Script macht:

1. Entschlüsselt und applied alle `*-secrets.enc.yaml`
2. Applied `kubectl apply -k overlays/production/` (was base importiert)

## Status prüfen

```bash
kubectl get all -n wow
kubectl get secrets -n wow
```

## Löschen

```bash
kubectl delete -k k3s/overlays/production/
kubectl delete secret postgresql-secrets directus-secrets -n wow
```

## SOPS Konfiguration

Die Datei `.sops.yaml` im Repo-Root definiert, welcher Key verwendet wird:

```yaml
creation_rules:
  - path_regex: .*\.enc\.yaml$
    age: >-
      age1...  # Dein Age Public Key
```

## DB Tunnel (SSH Bastion)

Die Admin-Feature `admin.db-tunnel` erlaubt es Nutzern, sich über einen
OpenSSH-Bastion-Pod per DBeaver (oder beliebigem SSH-Tunnel-Client) auf die
in-cluster Datenbanken zu verbinden. Der Bastion erlaubt ausschließlich
TCP-Forwarding zu bekannten DB-Services, keine Shell — diese Restriktionen
stehen direkt als Optionen in der `authorized_keys`-Zeile, kein eigenes
`sshd_config` nötig.

**Einmalige Einrichtung:**

1. Keypair erzeugen:
   ```bash
   ssh-keygen -t ed25519 -f db-tunnel -C "wow-portal-db-tunnel" -N ""
   ```
2. `authorized_key`-Zeile bauen: Options-Prefix + `db-tunnel.pub`:
   ```
   no-pty,no-agent-forwarding,no-X11-forwarding,no-user-rc,permitopen="wow-acore-auth-db:3306",permitopen="wow-acore-blizzlike-db:3306",permitopen="wow-acore-ip-db:3306",permitopen="wow-acore-ip-boosted-db:3306",permitopen="postgresql:5432",command="/sbin/nologin" ssh-ed25519 AAAA... wow-portal-db-tunnel
   ```
   Die `no-*`-Optionen deaktivieren interaktive Features, `permitopen`
   beschränkt lokale (`ssh -L`) Forwards auf die DB-Services, und
   `command="/sbin/nologin"` blockt jede Shell-Ausführung.
   WICHTIG: kein `restrict` verwenden — unter OpenSSH 10 re-aktiviert
   `permitopen` in diesem Fall das Forwarding nicht, jeder `-L`-Versuch
   schlägt mit "administratively prohibited" fehl.
3. Secrets aus `k3s/base/db-tunnel/secrets.template.yaml` ableiten, im
   Overlay mit den echten Werten befüllen, mit SOPS verschlüsseln:
   - `db-tunnel-ssh-authorized-keys` ← die gebaute Zeile aus (2)
   - `db-tunnel-ssh-client-key` ← Inhalt von `db-tunnel`
4. Traefik einen TCP-Entrypoint `ssh` auf Port 2222 beibringen (k3s:
   `HelmChartConfig` unter `kube-system/traefik`):
   ```yaml
   apiVersion: helm.cattle.io/v1
   kind: HelmChartConfig
   metadata:
     name: traefik
     namespace: kube-system
   spec:
     valuesContent: |-
       ports:
         ssh:
           port: 2222
           expose:
             default: true
           exposedPort: 2222
           protocol: TCP
   ```
5. Am Gateway / Router Port 2222 → k3s-Node freigeben.

**Rotation:** neues Keypair erzeugen, beide Secrets gleichzeitig ersetzen,
`db-tunnel-ssh` und `wow-frontend` neu rollen. Der SSH-Host-Fingerprint
ändert sich bei jedem Neustart des Bastion-Pods (Host-Keys werden in einem
`emptyDir` gehalten). Für stabile Fingerprints später auf PVC umstellen.

## Backups

> ⚠️ **Restore nie direkt in Prod.** Zurückgespielt wird ausschließlich über die (kommende)
> Restore-Drill-Prozedur auf einem **Nicht-Prod-MySQL** (lokal `mysql:9` via podman, siehe
> Phase 4 des Backup-Plans / `scripts/restore-drill.sh`). Keine Dumps per Hand in die
> `wow-acore-*-db`-Server pipen, keine SQLite-Dateien unter dem laufenden Portal austauschen.

### Was läuft wann

| Wann (Europe/Berlin)      | Was                                  | Wo definiert                          | Ziel |
|---------------------------|--------------------------------------|---------------------------------------|------|
| täglich 02:00 ¹           | Longhorn-Snapshot `wow-snapshot-daily` (7 behalten) | `k3s/longhorn/recurring-jobs.yaml` | lokal auf der Longhorn-Disk |
| täglich 03:15             | CronJob `portal-sqlite-backup`       | `k3s/base/backups/sqlite-cronjob.yaml`| PVC `wow-backups` → `/backups/sqlite` |
| täglich 03:30             | CronJob `mysql-backup`               | `k3s/base/backups/cronjob.yaml`       | PVC `wow-backups` → `/backups/mysql` |
| sonntags 04:00 ¹          | Longhorn-Backup `wow-backup-weekly` (4 behalten) | `k3s/longhorn/recurring-jobs.yaml` | Longhorn-Backup-Target (off-site) |

¹ Longhorn-Cron läuft in der Zeitzone des kube-controller-managers (Host-TZ). Die Longhorn-Jobs
werden **nicht** von `deploy.sh` angewendet und brauchen für `backup` ein Backup-Target. Stand
2026-09-30 ist **keins** konfiguriert. Details und Befehle: [`k3s/longhorn/README.md`](longhorn/README.md).

`mysql-backup` dumpt `acore_auth` (auth) und `acore_characters` der drei Realms. Hosts und
Realm-IDs kommen aus der ConfigMap `wow-frontend-env` (`realm1` = blizzlike, `realm2` = ip,
`realm3` = ip-boosted). `acore_world` nur mit `BACKUP_WORLD=true`. Image `mysql:9`, also dieselbe
Version wie die Server. Die SQLite-Kopie liest `wow-frontend-sqllite-data` **read-only** mit, während
das Portal läuft (gleicher Node, podAffinity). Warum das mit WAL sicher ist, steht im Kopf von
`k3s/base/backups/sqlite-cronjob.yaml`.

Die Scripts liegen in `k3s/base/backups/scripts/` (Quelle; `scripts/backup/` verlinkt nur dorthin)
und landen per `configMapGenerator` in der ConfigMap `wow-backup-scripts`.

### Dateien auf `wow-backups`

```text
/backups/mysql/status.json                                # letzter Lauf, pro Target lastSuccessAt/lastError
/backups/mysql/<db>/<target>/<ts>.sql.gz                  # z.B. acore_characters/realm2/20260930T013000Z.sql.gz
/backups/mysql/<db>/<target>/<ts>.json                    # Manifest: host, serverVersion, sha256, sizeBytes, durationSec, tables{name: rowEstimate}
/backups/sqlite/status.json
/backups/sqlite/<name>/<ts>.db.gz                         # mappings | user-settings | portal-config
/backups/sqlite/<name>/<ts>.json                          # Manifest inkl. integrityCheck und exakten Row-Counts
```

`<ts>` ist UTC (`YYYYMMDDTHHMMSSZ`). Ein Dump heißt erst dann `.sql.gz`/`.db.gz`, wenn alles
geklappt hat: mysqldump- und gzip-Exitcode, `gzip -t`, bei SQLite `integrity_check`. Vorher heißt er
`.partial`. Jede Datei enthält genau eine Datenbank, ohne `CREATE DATABASE`/`USE`.
Retention pro Target, erst nach einem erfolgreichen Backup: alles aus den letzten 7 Tagen, dazu das
neueste Backup jeder ISO-Woche (4 Wochen) und jedes Monats (6 Monate). Script:
`backup-retention.sh`, Tests: `tests/unit/scripts/backup/`.

### Manuell auslösen / prüfen

```bash
kubectl create job --from=cronjob/mysql-backup mysql-backup-manual-$(date +%s) -n wow
kubectl create job --from=cronjob/portal-sqlite-backup portal-sqlite-backup-manual-$(date +%s) -n wow

kubectl get cronjobs,jobs,pods -n wow -l app.kubernetes.io/part-of=wow-backups
kubectl logs -n wow job/<job-name>
```

Manuelle Jobs räumt die CronJob-History nicht weg: `kubectl delete job -n wow <job-name>`.

### Backup herauskopieren und verifizieren

Helper-Pod, der `wow-backups` **read-only** mountet. Das Image hat busybox `tar` (braucht
`kubectl cp`) und `sqlite3`:

```bash
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
kubectl exec -n wow wow-backups-shell -- ls -la /backups/mysql/acore_characters/realm2

TS=20260930T013000Z
kubectl cp wow/wow-backups-shell:/backups/mysql/acore_characters/realm2/$TS.sql.gz ./$TS.sql.gz
kubectl cp wow/wow-backups-shell:/backups/mysql/acore_characters/realm2/$TS.json   ./$TS.json
kubectl delete pod -n wow wow-backups-shell

# lokal prüfen
gzip -t $TS.sql.gz && sha256sum $TS.sql.gz && grep '"sha256"' $TS.json   # Hashes müssen gleich sein
zcat $TS.sql.gz | head -n 30
# SQLite: gunzip -c <ts>.db.gz > check.db && sqlite3 check.db 'PRAGMA integrity_check'
```

### Erster Lauf nach dem Deploy (Checkliste)

1. `./k3s/deploy.sh` legt PVC `wow-backups` (30 Gi, longhorn-fast), ConfigMap und beide CronJobs an.
2. Beide Jobs einmal manuell starten (siehe oben) und die Logs lesen. `status.json` muss
   `"ok": true` zeigen.
3. Die Warnung `SELECT command denied … column_masking_policy … when trying to dump masking policies`
   ist harmlos: mysqldump 9.x liest optional Masking-Policies, der Dump läuft trotzdem durch.
4. Enthält eine DB Stored Procedures/Functions, braucht `acore` das globale Recht `SHOW_ROUTINE`.
   Sonst bricht mysqldump mit `insufficient privileges to SHOW CREATE PROCEDURE` ab und der Job
   meldet den Fehler. Fix (einmalig, als root auf dem jeweiligen Server):
   `GRANT SHOW_ROUTINE ON *.* TO 'acore'@'%';`
5. Schlägt `portal-sqlite-backup` mit `unable to open database file` fehl, sind die SQLite-Dateien
   für uid 999 nicht lesbar. Dann in `sqlite-cronjob.yaml` `runAsUser: 0` **und** `runAsNonRoot: false`
setzen; die Quelle bleibt
   read-only gemountet. Läuft das Portal nicht, bleibt der Job Pending bzw. scheitert, weil er
   neben dem Portal-Pod laufen muss und die WAL-Dateien braucht.

Grenzen: `wow-backups` liegt auf demselben Node und derselben Disk wie die Datenbanken. Off-site
gibt es erst mit dem Longhorn-Backup-Target (dann `wow-backups` mit in die Gruppe `wow-backup`
aufnehmen). Einen Alarm für „neuestes Backup älter als 36 h“ gibt es noch nicht; `status.json` ist
die Datenquelle dafür (Portal, Phase 2).
