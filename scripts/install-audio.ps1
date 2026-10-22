$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$venv = Join-Path $env:TEMP 'SiliconSenseAudio'
$python = Join-Path $venv 'Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
  python -m venv $venv
  if ($LASTEXITCODE -ne 0) { throw 'Не удалось создать окружение Python' }
}
& $python -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw 'Не удалось обновить pip' }
& $python -m pip install -r (Join-Path $project 'requirements-audio.txt')
if ($LASTEXITCODE -ne 0) { throw 'Не удалось установить аудиомодули' }
Write-Host 'Аудиомодули установлены. Запустите scripts/start-audio.ps1'
