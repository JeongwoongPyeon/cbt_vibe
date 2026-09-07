[CmdletBinding()]
param(
  [ValidateSet("all", "worker", "web", "next")]
  [string]$Role = "all",
  [Alias("NextPort")]
  [ValidateRange(1, 65535)]
  [int]$WebPort = 3000,
  [ValidateRange(1, 65535)]
  [int]$WorkerPort = 8001
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Push-Location -LiteralPath $Root
try {
  if ($Role -eq "worker") {
    $python = Join-Path $Root ".venv\Scripts\python.exe"
    if (-not (Test-Path -LiteralPath $python)) {
      $python = (Get-Command python -ErrorAction Stop).Source
    }
    & $python -m uvicorn app.main:app --app-dir ai-worker --host 127.0.0.1 --port $WorkerPort
  } elseif ($Role -eq "web" -or $Role -eq "next") {
    $previousWorkerUrl = $env:AI_WORKER_URL
    try {
      $env:AI_WORKER_URL = "http://127.0.0.1:$WorkerPort"
      & npm run dev -- --port $WebPort
    } finally {
      $env:AI_WORKER_URL = $previousWorkerUrl
    }
  } else {
    & node scripts/start-all.mjs --port $WebPort --worker-port $WorkerPort
  }
  $exitCode = $LASTEXITCODE
} finally {
  Pop-Location
}
exit $exitCode
