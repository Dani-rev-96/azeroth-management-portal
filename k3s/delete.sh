#!/usr/bin/env bash
# Entfernt alle Kubernetes-Ressourcen
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OVERLAY_DIR="$SCRIPT_DIR/overlays/production"

echo "🗑️  Deleting Kustomize resources..."
kubectl delete -k "$OVERLAY_DIR" --ignore-not-found

echo "🔐 Deleting secrets..."
for secret_file in "$OVERLAY_DIR"/*-secrets.enc.yaml; do
  if [[ -f "$secret_file" ]]; then
    echo "   Deleting $(basename "$secret_file")..."
    sops -d "$secret_file" | kubectl delete -f - --ignore-not-found
  fi
done

echo "✅ Deletion complete!"
