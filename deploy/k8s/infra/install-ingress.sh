#!/usr/bin/env bash
# Instala/atualiza o ingress-nginx COMPARTILHADO do cluster (namespace ingress-nginx), interno
# (Service ClusterIP, sem LB da DigitalOcean) e com o real-ip da Cloudflare vindo do Cloudflare
# Tunnel (ver ingress-nginx-values.yaml e install-cloudflared.sh).
#
# Uso (admin do cluster, com o kubeconfig de admin no contexto atual):
#   deploy/k8s/infra/install-ingress.sh
#
# Se já existir uma IngressClass `nginx` que NÃO pertence à release `ingress-nginx` do namespace
# `ingress-nginx` (instalada por outro projeto), o script não altera nada: só mostra o que conferir.
set -euo pipefail

RELEASE="ingress-nginx"
# Versão fixa do chart (controller v1.15.x).
CHART_VERSION="4.15.1"
NAMESPACE="ingress-nginx"
VALUES_FILE="$(cd "$(dirname "$0")" && pwd)/ingress-nginx-values.yaml"

for tool in kubectl helm; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Erro: '$tool' não encontrado no PATH." >&2
    exit 1
  fi
done

if kubectl get ingressclass nginx >/dev/null 2>&1; then
  owner_release="$(kubectl get ingressclass nginx -o jsonpath='{.metadata.annotations.meta\.helm\.sh/release-name}')"
  owner_namespace="$(kubectl get ingressclass nginx -o jsonpath='{.metadata.annotations.meta\.helm\.sh/release-namespace}')"
  if [[ "$owner_release" != "$RELEASE" || "$owner_namespace" != "$NAMESPACE" ]]; then
    cat <<EOF
Aviso: a IngressClass 'nginx' já existe e não é gerenciada pela release '$RELEASE' do namespace
'$NAMESPACE' (release='${owner_release:-?}', namespace='${owner_namespace:-?}'). Nada foi alterado.

Confira no ConfigMap do controller existente se estas opções estão como em
$VALUES_FILE (necessárias para o IP real e o esquema atrás do Cloudflare Tunnel):
  use-forwarded-headers: "true"
  enable-real-ip: "true"
  forwarded-for-header: "CF-Connecting-IP"
  compute-full-forwarded-for: "false"
  proxy-real-ip-cidr: <faixa de pods do cluster, ex.: 10.109.0.0/16>
Os Public Hostnames do túnel devem apontar para o Service HTTP (porta 80) desse controller.
EOF
    exit 0
  fi
  echo "IngressClass 'nginx' pertence à release '$RELEASE' — atualizando."
fi

helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx >/dev/null 2>&1 || true
helm repo update ingress-nginx

helm upgrade --install "$RELEASE" ingress-nginx/ingress-nginx \
  --version "$CHART_VERSION" \
  -n "$NAMESPACE" --create-namespace \
  -f "$VALUES_FILE" \
  --wait

kubectl -n "$NAMESPACE" rollout status deploy/ingress-nginx-controller --timeout=5m
echo "ingress-nginx pronto (Service ClusterIP ingress-nginx-controller.$NAMESPACE.svc.cluster.local:80)."
