#!/usr/bin/env bash
# Instala/atualiza o Cloudflare Tunnel COMPARTILHADO do cluster (túnel `emagine-k8s`, namespace
# cloudflared): cria/atualiza o Secret `cloudflared-token` e aplica cloudflared.yaml.
#
# Uso (admin do cluster, com o kubeconfig de admin no contexto atual):
#   deploy/k8s/infra/install-cloudflared.sh                 # pede o token sem eco (recomendado)
#   CLOUDFLARE_TUNNEL_TOKEN=... deploy/k8s/infra/install-cloudflared.sh
#
# O token vem do painel Cloudflare Zero Trust (Networks → Tunnels → emagine-k8s → instalar
# conector). É credencial do CLUSTER, não do Finami: não vai para o GitHub nem para a pipeline.
# Prefira o prompt, para o token não ficar no histórico do shell. O script nunca imprime o token.
set -euo pipefail

NAMESPACE="cloudflared"
SECRET_NAME="cloudflared-token"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MANIFEST="$SCRIPT_DIR/cloudflared.yaml"

if ! command -v kubectl >/dev/null 2>&1; then
  echo "Erro: 'kubectl' não encontrado no PATH." >&2
  exit 1
fi

token="${CLOUDFLARE_TUNNEL_TOKEN:-}"
if [[ -z "$token" ]]; then
  read -rs -p "Token do túnel emagine-k8s (não será exibido): " token
  echo
fi
if [[ -z "$token" ]]; then
  echo "Erro: token do túnel vazio." >&2
  exit 1
fi

umask 077
token_file="$(mktemp)"
trap 'rm -f "$token_file"' EXIT
printf '%s' "$token" > "$token_file"
unset token CLOUDFLARE_TUNNEL_TOKEN

# Namespace primeiro (o Secret depende dele); o manifesto completo é aplicado depois.
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

kubectl -n "$NAMESPACE" create secret generic "$SECRET_NAME" \
  --from-file=token="$token_file" \
  --dry-run=client -o yaml | kubectl apply -f -

rm -f "$token_file"

kubectl apply -f "$MANIFEST"
# Reinicia para pegar um token novo (o env vem do Secret só na criação do pod).
kubectl -n "$NAMESPACE" rollout restart deploy/cloudflared
kubectl -n "$NAMESPACE" rollout status deploy/cloudflared --timeout=5m

echo "cloudflared pronto. Confira o status do túnel emagine-k8s no painel Zero Trust (HEALTHY)."
