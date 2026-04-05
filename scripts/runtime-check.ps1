$ErrorActionPreference = "Stop"

$root = "D:\flyeasy"
$logDir = Join-Path $root ".tmp\runtime-check"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
if (Test-Path (Join-Path $logDir "*")) {
  Remove-Item (Join-Path $logDir "*") -Force
}

$next = Start-Process -FilePath "npm.cmd" `
  -ArgumentList "run", "dev" `
  -WorkingDirectory $root `
  -RedirectStandardOutput (Join-Path $logDir "next.log") `
  -RedirectStandardError (Join-Path $logDir "next.err") `
  -PassThru

Start-Sleep -Seconds 12

$electron = Start-Process -FilePath "cmd.exe" `
  -ArgumentList "/c", "set FLYEASY_RENDERER_URL=http://127.0.0.1:3000&& npm run electron" `
  -WorkingDirectory $root `
  -RedirectStandardOutput (Join-Path $logDir "electron.log") `
  -RedirectStandardError (Join-Path $logDir "electron.err") `
  -PassThru

Start-Sleep -Seconds 10

try {
  $response = Invoke-WebRequest -Uri "http://127.0.0.1:3000" -UseBasicParsing
  $status = $response.StatusCode
}
catch {
  $status = "ERR"
}

$nextProc = Get-Process -Id $next.Id -ErrorAction SilentlyContinue
$electronProc = Get-Process -Id $electron.Id -ErrorAction SilentlyContinue

[pscustomobject]@{
  NextProcessId = $next.Id
  NextAlive = [bool]$nextProc
  ElectronProcessId = $electron.Id
  ElectronAlive = [bool]$electronProc
  HttpStatus = $status
} | Format-List

if ($electronProc) {
  Stop-Process -Id $electron.Id -Force
}

if ($nextProc) {
  Stop-Process -Id $next.Id -Force
}
