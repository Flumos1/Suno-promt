$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$python = Join-Path $env:TEMP 'SiliconSenseAudio\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
  throw 'Сначала запустите scripts/install-audio.ps1'
}
Push-Location $project
try {
  $env:AUDIO_PYTHON = $python
  $env:AUDIO_WORKSHOP_ENABLED = '1'
  if (Test-Path -LiteralPath '.env') {
    node --env-file=.env server.js
  } else {
    node server.js
  }
} finally {
  Pop-Location
}
