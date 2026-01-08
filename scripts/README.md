Usage

PowerShell (Windows) :

```powershell
# Exécute avec le message de commit par défaut
.\scripts\deploy.ps1

# Ou avec un message personnalisé
.\scripts\deploy.ps1 -Message "Votre message de commit"
```

VS Code : Ouvrez la palette (`Terminal: Run Task`) et choisissez `Deploy: git push main`.

Notes
- Le script suppose que `git` est installé et accessible depuis le PATH.
- Vous serez éventuellement invité à vous authentifier (SSH agent ou credential helper).
