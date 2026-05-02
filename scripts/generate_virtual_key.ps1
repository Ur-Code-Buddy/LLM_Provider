# Generate a LiteLLM virtual key (requires running proxy + master key).
# Field names: tpm_limit, rpm_limit, max_parallel_requests (GenerateKeyRequest).
$ErrorActionPreference = "Stop"
$BaseUrl = if ($env:LITELLM_BASE_URL) { $env:LITELLM_BASE_URL.TrimEnd("/") } else { "http://127.0.0.1:4000" }
if (-not $env:LITELLM_MASTER_KEY) { throw "Set LITELLM_MASTER_KEY" }
$alias = if ($env:KEY_ALIAS) { $env:KEY_ALIAS } else { "gateway-client" }
$body = @{
  metadata = @{ key_alias = $alias }
  models = @("gateway-basic", "gateway-premium", "gateway-openai-fallback", "gateway-kimi")
  max_budget = if ($env:MAX_BUDGET) { [double]$env:MAX_BUDGET } else { 50 }
  budget_duration = if ($env:BUDGET_DURATION) { $env:BUDGET_DURATION } else { "30d" }
  duration = if ($env:KEY_DURATION) { $env:KEY_DURATION } else { "365d" }
  tpm_limit = if ($env:TPM_LIMIT) { [int]$env:TPM_LIMIT } else { 100000 }
  rpm_limit = if ($env:RPM_LIMIT) { [int]$env:RPM_LIMIT } else { 500 }
  max_parallel_requests = if ($env:MAX_PARALLEL) { [int]$env:MAX_PARALLEL } else { 8 }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post -Uri "$BaseUrl/key/generate" `
  -Headers @{ Authorization = "Bearer $($env:LITELLM_MASTER_KEY)"; "Content-Type" = "application/json" } `
  -Body $body | ConvertTo-Json -Depth 10
