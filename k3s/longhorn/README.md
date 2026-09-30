# Longhorn recurring jobs (snapshots / off-site backups)

Cluster-scoped Longhorn resources for the `wow` volumes. They live in `longhorn-system`, which is
why they are **not** part of `k3s/base` (that kustomization forces `namespace: wow`) and are **not**
applied by `k3s/deploy.sh`. The operator applies them by hand with the commands below.

This is the crash-consistent safety net under the logical dumps in `k3s/base/backups/`
(see `k3s/README.md` → "Backups").

| RecurringJob         | Task       | Cron (controller-manager local time) | Retain | Group        |
|----------------------|------------|--------------------------------------|--------|--------------|
| `wow-snapshot-daily` | `snapshot` | `0 2 * * *` (daily 02:00)            | 7      | `wow-backup` |
| `wow-backup-weekly`  | `backup`   | `0 4 * * 0` (Sunday 04:00)           | 4      | `wow-backup` |

Longhorn creates a Kubernetes CronJob per RecurringJob without `timeZone`. The cron expression is
therefore evaluated in the kube-controller-manager's time zone, which for k3s is the host time zone.

## Current state (read-only check, 2026-09-30)

- `kubectl get recurringjobs.longhorn.io -A` → no resources. No recurring jobs exist yet.
- Longhorn `v1.10.1`. There is no `backup-target` setting any more; the target is the
  `BackupTarget` CR `default`:
  ```text
  kubectl get backuptargets.longhorn.io default -n longhorn-system -o yaml
  spec.backupTargetURL: ""        status.available: false
  conditions: Unavailable — "backup target URL is empty"
  ```
  **No backup target is configured.** `wow-backup-weekly` (task `backup`) would fail every
  week until one is configured. Snapshots (`wow-snapshot-daily`) work without a target.
- Every volume already has the label `recurring-job-group.longhorn.io/default=enabled`. Longhorn
  adds that label automatically to volumes without recurring-job labels. No job is in the
  `default` group, so it does nothing. Leave it alone.
- Snapshots stay on the same disk (`/var/lib/longhorn`, single node `ubuntu`, 1 replica per
  volume). They protect against logical damage, not against losing the node or disk. Only the
  `backup` task leaves the machine.
- Disk: about 348 GiB max, 104 GiB reserved, 125 GiB scheduled, about 181 GiB actually free. Each
  snapshot only uses the blocks that changed since the previous snapshot. The `wow-backups` PVC
  (30 Gi) still fits.

## Volumes in the group `wow-backup`

Current PVC → Longhorn volume mapping (`kubectl get pvc -n wow`):

| PVC                         | Longhorn volume                            | Why                                  |
|-----------------------------|--------------------------------------------|--------------------------------------|
| `wow-acore-auth-db`         | `pvc-ea5b26ac-a84a-448e-aba4-0067cf8605b1` | accounts (acore_auth)                |
| `wow-acore-blizzlike-db`    | `pvc-8053ac84-8fcd-4529-a9e2-e45674e92605` | realm 1 characters/world             |
| `wow-acore-ip-db`           | `pvc-5e918c3c-aa55-442b-9153-1b6eae67b35e` | realm 2 characters/world             |
| `wow-acore-ip-boosted-db`   | `pvc-a8e40c3d-4279-479b-a48d-ccf5379f8aac` | realm 3 characters/world             |
| `wow-frontend-sqllite-data` | `pvc-a00d4e57-b1e6-41c4-abd0-5d9983879d75` | portal SQLite (mappings, settings)   |
| `postgresql-pvc`            | `pvc-a9006d40-cb38-424e-ba28-2c28cc8458b5` | Directus database                    |
| `directus-database-pvc`     | `pvc-c9604d7e-2fb3-4456-8223-982004158de7` | Directus                             |
| `directus-extensions-pvc`   | `pvc-bcb4f1b2-e7e8-4200-8b5f-6bec4c8e5a20` | Directus                             |
| `directus-templates-pvc`    | `pvc-042fe8e1-ed73-45d1-a843-df22a12a3414` | Directus                             |
| `directus-uploads-pvc`      | `pvc-7c540afc-6938-422f-ba9a-2773a818f8ee` | Directus uploads                     |

Optional, not in the default list:

| PVC                        | Longhorn volume                            | Note                                                        |
|----------------------------|--------------------------------------------|-------------------------------------------------------------|
| `wow-backups`              | `kubectl get pvc wow-backups -n wow -o jsonpath='{.spec.volumeName}'` | Once a backup target exists: its weekly backup is the off-site copy of the logical dumps |
| `wow-frontend-data`        | `pvc-c377d5d3-dd66-486b-8e63-4916b866b11d` | 50 Gi of public downloads. Large; only if not reproducible |
| `wow-acore-shared`         | `pvc-0972fd32-6582-48ae-97fe-7d96ee7ac121` | RWX, shared AzerothCore data                                |
| `wow-acore-*-etc`          | `pvc-56790eff-…` / `pvc-c982143c-…` / `pvc-6630f075-…` | 100 Mi worldserver configs. Blizzlike and IP are detached (world scaled to 0). Detached volumes are skipped (`allow-recurring-job-while-volume-detached=false`) |

The volume names change if a PVC is ever re-created. Always resolve them from the PVC (the loop
below does this) instead of copying the table.

## Operator commands (run manually, never from CI)

```bash
# 0. Check the backup target (read-only)
kubectl get backuptargets.longhorn.io -n longhorn-system
kubectl get recurringjobs.longhorn.io -n longhorn-system

# 1a. No backup target yet → create only the snapshot job
kubectl apply -f k3s/longhorn/recurring-jobs.yaml -l wow.dani-home.de/requires-backup-target=false

# 1b. Backup target configured (see below) → create both jobs
kubectl apply -f k3s/longhorn/recurring-jobs.yaml

# 2. Put the volumes into the group (resolves the Longhorn volume name from each PVC)
for pvc in wow-acore-auth-db wow-acore-blizzlike-db wow-acore-ip-db wow-acore-ip-boosted-db \
           wow-frontend-sqllite-data postgresql-pvc \
           directus-database-pvc directus-extensions-pvc directus-templates-pvc directus-uploads-pvc; do
  vol="$(kubectl get pvc "$pvc" -n wow -o jsonpath='{.spec.volumeName}')"
  echo "$pvc -> $vol"
  kubectl -n longhorn-system label volumes.longhorn.io "$vol" recurring-job-group.longhorn.io/wow-backup=enabled --overwrite
done

# 3. Verify
kubectl get volumes.longhorn.io -n longhorn-system -l recurring-job-group.longhorn.io/wow-backup=enabled
kubectl get cronjobs -n longhorn-system                    # one CronJob per RecurringJob
kubectl get snapshots.longhorn.io -n longhorn-system       # after 02:00
kubectl get backups.longhorn.io -n longhorn-system         # after Sunday 04:00 (needs a target)

# Remove a volume from the group again
kubectl -n longhorn-system label volumes.longhorn.io <pvc-…> recurring-job-group.longhorn.io/wow-backup-
```

Alternative for GitOps-managed PVCs: Longhorn copies recurring-job labels from a PVC to its volume
when the PVC has the annotation `recurring-job.longhorn.io/source: enabled`. Then the label
`recurring-job-group.longhorn.io/wow-backup: enabled` can live in the PVC manifest. The AzerothCore
DB PVCs are not managed in this repo, so the commands above are the common path.

## Configuring a backup target (prerequisite for `wow-backup-weekly`)

Longhorn 1.10 keeps the target in the `BackupTarget` CR `default` (UI: Settings → Backup Target).
Example for S3-compatible storage (Backblaze B2, Hetzner Object Storage, MinIO, …):

```bash
kubectl -n longhorn-system create secret generic longhorn-backup-s3 \
  --from-literal=AWS_ACCESS_KEY_ID=… --from-literal=AWS_SECRET_ACCESS_KEY=… \
  --from-literal=AWS_ENDPOINTS=https://s3.eu-central-003.backblazeb2.com
kubectl -n longhorn-system patch backuptargets.longhorn.io default --type merge \
  -p '{"spec":{"backupTargetURL":"s3://<bucket>@<region>/wow","credentialSecret":"longhorn-backup-s3"}}'
kubectl get backuptargets.longhorn.io default -n longhorn-system   # AVAILABLE must be true
```

Keep the credentials out of git (or add them SOPS-encrypted like the other secrets). Test a restore
from the target into a **new** volume, never over a live one.
