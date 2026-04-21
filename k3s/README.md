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
│   └── ingress/
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
