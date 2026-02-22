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
