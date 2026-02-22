#!/usr/bin/env bash
# Entschlüsselt SOPS-Secrets und wendet alles mit Kustomize an
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OVERLAY_DIR="$SCRIPT_DIR/overlays/production"

kubectl create namespace wow || true

echo "🔐 Deploying secrets..."
for secret_file in "$OVERLAY_DIR"/*-secrets.enc.yaml; do
  if [[ -f "$secret_file" ]]; then
    echo "   Applying $(basename "$secret_file")..."
    sops -d "$secret_file" | kubectl apply -f -
  fi
done

echo "🚀 Deploying Kustomize resources..."
kubectl apply -k "$OVERLAY_DIR"

echo "✅ Deployment complete!"
echo ""
echo "Status:"
kubectl get pods -n wow
