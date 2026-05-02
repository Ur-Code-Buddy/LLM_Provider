#!/usr/bin/env sh
# Generate a LiteLLM virtual key (requires running proxy + master key).
# Field names match GenerateKeyRequest (tpm_limit / rpm_limit / max_parallel_requests).
# See: https://docs.litellm.ai/docs/proxy/virtual_keys
set -eu
BASE_URL="${LITELLM_BASE_URL:-http://127.0.0.1:4000}"
MASTER="${LITELLM_MASTER_KEY:?set LITELLM_MASTER_KEY}"

curl -sS -X POST "${BASE_URL}/key/generate" \
  -H "Authorization: Bearer ${MASTER}" \
  -H "Content-Type: application/json" \
  -d "{
    \"metadata\": {\"key_alias\": \"${KEY_ALIAS:-gateway-client}\"},
    \"models\": [\"gateway-basic\", \"gateway-premium\", \"gateway-openai-fallback\", \"gateway-kimi\"],
    \"max_budget\": ${MAX_BUDGET:-50},
    \"budget_duration\": \"${BUDGET_DURATION:-30d}\",
    \"duration\": \"${KEY_DURATION:-365d}\",
    \"tpm_limit\": ${TPM_LIMIT:-100000},
    \"rpm_limit\": ${RPM_LIMIT:-500},
    \"max_parallel_requests\": ${MAX_PARALLEL:-8}
  }" | tee /dev/stderr

echo
