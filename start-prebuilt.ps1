$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$envPath = Join-Path $PSScriptRoot '.env'
$examplePath = Join-Path $PSScriptRoot '.env.example'
if (-not (Test-Path -LiteralPath $envPath)) {
    Copy-Item -LiteralPath $examplePath -Destination $envPath
}

$lines = [System.Collections.Generic.List[string]]::new()
$lines.AddRange([string[]](Get-Content -LiteralPath $envPath))

function Set-EnvValue([string]$Name, [string]$Value) {
    $pattern = '^\s*' + [regex]::Escape($Name) + '='
    $found = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match $pattern) {
            $lines[$i] = "$Name=$Value"
            $found = $true
            break
        }
    }
    if (-not $found) { $lines.Add("$Name=$Value") }
}

function Get-EnvValue([string]$Name) {
    $pattern = '^\s*' + [regex]::Escape($Name) + '=(.*)$'
    foreach ($line in $lines) {
        if ($line -match $pattern) { return $Matches[1].Trim().Trim('"') }
    }
    return ''
}

foreach ($name in @('BETTER_AUTH_SECRET', 'BACKEND_AUTH_SECRET', 'APP_SETTINGS_ENCRYPTION_KEY')) {
    $value = Get-EnvValue $name
    if (-not $value -or $value -match 'change_me|dev_secret') {
        $bytes = New-Object byte[] 32
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        $rng.GetBytes($bytes)
        $secret = [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
        $rng.Dispose()
        Set-EnvValue $name $secret
    }
}

Set-EnvValue 'NODE_ENV' 'production'
Set-EnvValue 'TRANSCRIPTION_PROVIDER' 'assemblyai'
Set-EnvValue 'BACKEND_CPU_ONLY' 'true'
Set-EnvValue 'BACKEND_PLATFORM' 'linux/amd64'
Set-EnvValue 'LLM' 'google-gla:gemini-3-flash-preview'

# Write UTF-8 without a BOM so Docker Compose reads the .env file reliably.
[System.IO.File]::WriteAllLines($envPath, $lines, [System.Text.UTF8Encoding]::new($false))

$assemblyKey = Get-EnvValue 'ASSEMBLY_AI_API_KEY'
$llm = Get-EnvValue 'LLM'
$providerKeyName = if ($llm -match '^openai:') { 'OPENAI_API_KEY' }
    elseif ($llm -match '^anthropic:') { 'ANTHROPIC_API_KEY' }
    elseif ($llm -match '^openrouter:') { 'OPENROUTER_API_KEY' }
    elseif ($llm -match '^google-gla:') { 'GOOGLE_API_KEY' }
    else { '' }
$providerKey = if ($providerKeyName) { Get-EnvValue $providerKeyName } else { 'configured' }

if (-not $assemblyKey -or -not $providerKey) {
    Write-Host ''
    Write-Host 'Add your API keys to .env, save it, then run this script again:'
    Write-Host '  ASSEMBLY_AI_API_KEY=  (get it from assemblyai.com)'
    if ($providerKeyName) { Write-Host "  $providerKeyName= (for the provider in LLM=$llm)" }
    else { Write-Host "  Set LLM to a supported provider:model value and add that provider's key." }
    Write-Host 'The generated app secrets are already filled in.'
    Start-Process notepad.exe -ArgumentList $envPath
    exit 2
}

docker compose version | Out-Host
docker compose config --quiet
docker compose pull
docker compose up -d --no-build --pull always
docker compose ps

Write-Host ''
Write-Host 'Waiting for SupoClip at http://localhost:3107 ...'
$ready = $false
for ($attempt = 0; $attempt -lt 36; $attempt++) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3107/api/auth/get-session' -TimeoutSec 5
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
            $ready = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 5
}
if (-not $ready) {
    docker compose ps
    throw 'SupoClip did not become ready. Check logs with: docker compose logs --tail=100 frontend backend worker'
}
Write-Host 'SupoClip is running: http://localhost:3107'
