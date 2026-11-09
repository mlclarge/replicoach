# ==============================================================================
# REPLICOACH - Script d'automatisation des mises a jour & deploiement
# ==============================================================================

$ErrorActionPreference = "Stop"

function Prompt-User($message) {
    Write-Host ""
    Write-Host "[?] $message [O/n] (defaut: Oui): " -NoNewline -ForegroundColor Yellow
    $response = Read-Host
    if ($response -eq "" -or $response -match "^[oOyY]") {
        return $true
    }
    return $false
}

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " REPLICOACH - AUTOMATISATION DE LA MISE A JOUR " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# ETAPE 1 : Copie automatique des fichiers de mise a jour v2 / v3
Write-Host "`n[1/3] Recherche et application des nouveaux fichiers..." -ForegroundColor Cyan

$filesToCopy = @(
    @{ Source = "AudioMode-v3.jsx"; Dest = "src\pages\AudioMode.jsx" },
    @{ Source = "AudioMode-v2.jsx"; Dest = "src\pages\AudioMode.jsx" },
    @{ Source = "ScriptDetail-v3.jsx"; Dest = "src\pages\ScriptDetail.jsx" },
    @{ Source = "TtsBatchModal-v2.jsx"; Dest = "src\components\TtsBatchModal.jsx" },
    @{ Source = "TtsBatchButton-v2.jsx"; Dest = "src\components\TtsBatchButton.jsx" },
    @{ Source = "batchTtsService-v2.js"; Dest = "src\lib\batchTtsService.js" },
    @{ Source = "ListeningWorkflow-v2.jsx"; Dest = "src\components\ListeningWorkflow.jsx" },
    @{ Source = "PremiumVoicePicker-v2.jsx"; Dest = "src\components\PremiumVoicePicker.jsx" },
    @{ Source = "ttsVoices-v2.js"; Dest = "src\lib\ttsVoices.js" },
    @{ Source = "geminiOcrService-v2.js"; Dest = "src\lib\geminiOcrService.js" }
)

$copiedCount = 0
foreach ($item in $filesToCopy) {
    if (Test-Path $item.Source) {
        Copy-Item $item.Source $item.Dest -Force
        Write-Host "   [OK] Copie : $($item.Source) -> $($item.Dest)" -ForegroundColor Green
        $copiedCount++
    }
}

if ($copiedCount -eq 0) {
    Write-Host "   [INFO] Aucun nouveau fichier a la racine, conservation des fichiers existants." -ForegroundColor Gray
}
else {
    Write-Host "   [SUCCESS] $copiedCount fichier(s) mis a jour avec succes !" -ForegroundColor Green
}

# ETAPE 2 : Controle et compilation npm run build
if (-not (Prompt-User "Voulez-vous lancer la compilation locale (npm run build) ?")) {
    Write-Host "[!] Operation interrompue par l'utilisateur." -ForegroundColor Yellow
    exit
}

Write-Host "`n[2/3] Execution de 'npm run build'..." -ForegroundColor Cyan
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "Erreur de compilation" }
    Write-Host "[OK] Compilation reussie sans aucune erreur !" -ForegroundColor Green
}
catch {
    Write-Host "[ERROR] Le build a echoue ! La publication est annulee pour eviter toute regression." -ForegroundColor Red
    exit
}

# ETAPE 3 : Controle et Deploiement Git / Vercel
if (-not (Prompt-User "Le build est valide ! Voulez-vous commiter et publier sur Vercel (git push) ?")) {
    Write-Host "[!] Mise a jour locale terminee. Publication Vercel ignoree." -ForegroundColor Yellow
    exit
}

Write-Host "`nMessage de commit (Entree pour message par defaut) : " -NoNewline -ForegroundColor Yellow
$commitMsg = Read-Host
if ([string]::IsNullOrWhiteSpace($commitMsg)) {
    $commitMsg = "fix: pre-generation par lot (Batch TTS) et fallback audio local fluide"
}

Write-Host "`n[3/3] Publication sur Vercel via Git..." -ForegroundColor Cyan
git add .
git commit -m $commitMsg
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n======================================================" -ForegroundColor Green
    Write-Host " [SUCCESS] La mise a jour est en ligne sur Vercel !" -ForegroundColor Green
    Write-Host "======================================================" -ForegroundColor Green
}
else {
    Write-Host "[ERROR] Echec lors du push Git." -ForegroundColor Red
}
