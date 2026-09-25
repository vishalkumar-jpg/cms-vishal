#!/usr/bin/env bash
# Inject and verify critical UAT Admin build-time VITE_* vars.
# Used by .github/workflows/frontend-deploy.yml after decoding UAT_FRONTEND_ENV_BASE64.
set -euo pipefail

ENV_FILE="${1:-.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "::error::Env file not found: $ENV_FILE"
  exit 1
fi

UAT_API_URL="https://uat-cms-api.officebeacon.net"
UAT_RENDERER_URL="https://uat-cms.officebeacon.net"
UAT_PLATFORM_BASE_DOMAIN="uat-cms.officebeacon.net"

sed -i "/^VITE_API_URL=/d" "$ENV_FILE" || true
sed -i "/^VITE_RENDERER_BASE_URL=/d" "$ENV_FILE" || true
sed -i "/^VITE_PLATFORM_BASE_DOMAIN=/d" "$ENV_FILE" || true

# Decoded secrets may omit a trailing newline; ensure appended vars start on new lines.
if [[ -s "$ENV_FILE" ]]; then
  last_char=$(tail -c1 "$ENV_FILE")
  if [[ "$last_char" != $'\n' ]]; then
    echo "" >>"$ENV_FILE"
  fi
fi

echo "VITE_API_URL=$UAT_API_URL" >>"$ENV_FILE"
echo "VITE_RENDERER_BASE_URL=$UAT_RENDERER_URL" >>"$ENV_FILE"
echo "VITE_PLATFORM_BASE_DOMAIN=$UAT_PLATFORM_BASE_DOMAIN" >>"$ENV_FILE"

grep -q "^VITE_API_URL=$UAT_API_URL$" "$ENV_FILE" || {
  echo "::error::VITE_API_URL not set correctly"
  exit 1
}
grep -q "^VITE_RENDERER_BASE_URL=$UAT_RENDERER_URL$" "$ENV_FILE" || {
  echo "::error::VITE_RENDERER_BASE_URL not set correctly"
  exit 1
}
grep -q "^VITE_PLATFORM_BASE_DOMAIN=$UAT_PLATFORM_BASE_DOMAIN$" "$ENV_FILE" || {
  echo "::error::VITE_PLATFORM_BASE_DOMAIN not set correctly"
  exit 1
}
