Param(
    [string]$Message = "feat: audio italienne, 3 mots, copie perso, groupes, consignes, monitoring"
)

Write-Host "Staging changes..."
git add . 2>&1 | Write-Host

Write-Host "Committing..."
$commitOutput = git commit -m "$Message" 2>&1
if ($LASTEXITCODE -ne 0) {
    if ($commitOutput -match "nothing to commit") {
        Write-Host "Rien à committer."
    } else {
        Write-Host "Échec du commit:"
        Write-Host $commitOutput
        exit $LASTEXITCODE
    }
} else {
    Write-Host $commitOutput
}

Write-Host "Pushing to origin/main..."
git push origin main 2>&1 | Write-Host
if ($LASTEXITCODE -ne 0) { Write-Host "Push échoué"; exit $LASTEXITCODE }
Write-Host "Push terminé."
