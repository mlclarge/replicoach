# 1. Configuration du nom et de la date
$date = Get-Date -Format "yyyyMMdd-HHmm"
$nomDossier = Split-Path -Path (Get-Location) -Leaf
$destination = "..\$($nomDossier)_NoNode_$date.zip"

Write-Host "Analyse des fichiers a sauvegarder..." -ForegroundColor Cyan

# 2. Selection des fichiers (Exclusion de node_modules et .git)
$elements = Get-ChildItem -Path . -Force -Exclude "node_modules", ".git"

Write-Host "Compression en cours..." -ForegroundColor Cyan

# 3. Creation du ZIP
Compress-Archive -Path $elements.FullName -DestinationPath $destination -Force

Write-Host "Sauvegarde terminee : $destination" -ForegroundColor Green