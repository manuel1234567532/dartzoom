# DartZoom Build Script (Windows)
# Erstellt obfuskierte Version im dist\ Ordner

Write-Host "🎯 DartZoom Build Script" -ForegroundColor Blue
Write-Host "========================="

# Pfade
$SrcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DistDir = Join-Path $SrcDir "dist"

# dist Ordner erstellen/leeren
if (Test-Path $DistDir) {
    Remove-Item -Recurse -Force $DistDir
}
New-Item -ItemType Directory -Path $DistDir | Out-Null

Write-Host "📁 Kopiere statische Dateien..." -ForegroundColor Green
Copy-Item "$SrcDir\manifest.json" $DistDir
Copy-Item "$SrcDir\popup.html" $DistDir
Copy-Item "$SrcDir\popup.css" $DistDir
Copy-Item "$SrcDir\*.png" $DistDir -ErrorAction SilentlyContinue

Write-Host "🔐 Obfuskiere JavaScript..." -ForegroundColor Green

# JavaScript Dateien obfuskieren
$jsFiles = @("background.js", "popup.js", "pageScript.js", "injector.js")
foreach ($file in $jsFiles) {
    $srcFile = Join-Path $SrcDir $file
    if (Test-Path $srcFile) {
        Write-Host "  → $file"
        $destFile = Join-Path $DistDir $file
        & npx javascript-obfuscator $srcFile `
            --output $destFile `
            --compact true `
            --control-flow-flattening true `
            --control-flow-flattening-threshold 0.7 `
            --dead-code-injection true `
            --dead-code-injection-threshold 0.3 `
            --string-array true `
            --string-array-encoding base64 `
            --string-array-threshold 0.75 `
            --split-strings true `
            --split-strings-chunk-length 10 `
            2>$null
    }
}

Write-Host "📦 Erstelle ZIP..." -ForegroundColor Green
$zipPath = Join-Path $SrcDir "dartzoom-release.zip"
if (Test-Path $zipPath) {
    Remove-Item $zipPath
}
Compress-Archive -Path "$DistDir\*" -DestinationPath $zipPath

Write-Host ""
Write-Host "✅ Build fertig!" -ForegroundColor Green
Write-Host ""
Write-Host "Ordner-Struktur:"
Write-Host "  dartzoom\           <- Original (Entwicklung)"
Write-Host "  dartzoom\dist\      <- Obfuskiert (Release)"
Write-Host "  dartzoom-release.zip <- Fertige Extension"
Write-Host ""
Get-Item $zipPath | Select-Object Name, Length
