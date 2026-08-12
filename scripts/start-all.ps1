[CmdletBinding()]
param(
  [ValidateSet("all", "worker", "next")]
  [string]$Role = "all",
  [int]$NextPort = 3000,
  [int]$WorkerPort = 8001
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

function Test-ListeningPort {
  param([int]$Port)

  return $null -ne (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Get-PythonCommand {
  $venvPython = Join-Path $Root ".venv\Scripts\python.exe"

  if (Test-Path $venvPython) {
    return $venvPython
  }

  $python = Get-Command python -ErrorAction Stop
  return $python.Source
}

if ($Role -eq "worker") {
  $python = Get-PythonCommand
  & $python -m uvicorn app.main:app --app-dir ai-worker --host 127.0.0.1 --port $WorkerPort
  exit $LASTEXITCODE
}

if ($Role -eq "next") {
  & npm run dev -- --port $NextPort
  exit $LASTEXITCODE
}

if (Test-ListeningPort $WorkerPort) {
  throw "Worker 포트 $WorkerPort가 이미 사용 중입니다. 기존 Worker를 종료한 뒤 다시 실행하세요."
}

while (Test-ListeningPort $NextPort) {
  $NextPort++
}

# 두 프로세스의 로그를 별도 창에서 확인하고 종료할 수 있게 실행합니다.
Start-Process powershell.exe -WorkingDirectory $Root -ArgumentList @(
  "-NoExit",
  "-ExecutionPolicy", "Bypass",
  "-File", $PSCommandPath,
  "-Role", "worker",
  "-WorkerPort", $WorkerPort
)

Start-Process powershell.exe -WorkingDirectory $Root -ArgumentList @(
  "-NoExit",
  "-ExecutionPolicy", "Bypass",
  "-File", $PSCommandPath,
  "-Role", "next",
  "-NextPort", $NextPort
)

Write-Host "CBT Worker: http://127.0.0.1:$WorkerPort"
Write-Host "CBT Web:    http://127.0.0.1:$NextPort"
Write-Host "두 서버가 별도 PowerShell 창에서 시작되었습니다."
