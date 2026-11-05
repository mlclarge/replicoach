# 🗺️ ROADMAP - Étapes Suivantes

## ✅ SPRINT 1 Complété
**Status** : Production Ready  
**Date** : 2026-11-05  
**Feature** : Mode Audio - Délais Configurables

---

## 📅 SPRINT 2 - Mode Lecture : Contexte des Répliques

### 🎯 Objectif
Quand on filtre "mes répliques uniquement" avec un exercice, afficher les répliques d'autres personnages juste avant la nôtre (en grisé, lecture-seule).

### 📋 Tasks

**Backend**
- [ ] Modifier query de ScriptDetail pour inclure N répliques avant
- [ ] Ajouter flag "is_context_only" pour les répliques de contexte
- [ ] Optimiser pour éviter les doublons

**Frontend**
- [ ] Créer composant `ReplicaContext.jsx` (grisé/désaturé)
- [ ] Ajouter expandable/collapsible pour le contexte
- [ ] Implémenter tap long → modal plein écran
- [ ] Visuellement différencier contexte vs "mon rôle"

**Paramètres**
- [ ] Toggle "Afficher le contexte avant"
- [ ] Dropdown nombre de répliques : 1, 2, 3, 5
- [ ] Persister dans prefs utilisateur

### 📊 Impact
- Lecture plus claire
- Pas de surcharge contextuelle
- Répliques accessibles au tap du doigt

### ⏱️ Estimation
2-3 jours

---

## 📅 SPRINT 3 - Groupes de Répliques : Édition SANS Régression

### 🎯 Objectif
Permettre de modifier le nombre de répliques dans un groupe déjà créé (ex: 10→5 ou 10→15)

### 📋 Tasks

**Phase 1 : Préparation**
- [ ] Audit des groupes existants en DB
- [ ] Créer migration de compatibilité (versioning)
- [ ] Test : groupes v1 se chargent sans erreur
- [ ] Ajouter versionning schema (composition_version, replicas_json)
- [ ] Créer table audit (optionnel mais recommandé)

**Phase 2 : Fonctionnalité**
- [ ] Modal "Réviser ce groupe" → "Modifier la composition"
- [ ] Spinner nombre de répliques : 1-999
- [ ] Aperçu : "Vous aviez 10, vous en aurez X" (delta +/-)
- [ ] Explications intelligentes (réduction/augmentation)
- [ ] Avertissements (exercices complétés, etc.)
- [ ] Transactionnalité stricte (START/COMMIT/ROLLBACK)
- [ ] Historique complet des modifications

**Frontend**
- [ ] Section "Ajouter/Retirer des répliques"
- [ ] Section "Ordre d'ajout" (Append / Custom)
- [ ] Section "Avertissements"
- [ ] Actions : Annuler / Valider / Historique

**Tests**
- [ ] Réduction (10→5) : 5 dernières retirées
- [ ] Augmentation (10→15) : 5 suivantes ajoutées
- [ ] Exercices complétés : persister via replica_id
- [ ] Sessions en cours : warning si active
- [ ] Rollback d'urgence : revert à version N-1

### 🛡️ Risk Mitigation
- Versioning strict
- Transactions DB
- Snapshot de l'ancien état
- Test regression suite

### ⏱️ Estimation
3-4 jours

---

## 📅 SPRINT 4 - PWA : Visibilité Offline

### 🎯 Objectif
Mettre en avant le mode hors ligne pour que les utilisateurs sachent qu'ils peuvent travailler sans Internet

### 📋 Tasks

**Banner Découverte**
- [ ] Sticky banner "📱 Utilisez Replicoach hors ligne"
- [ ] CTA "Installer" → guide rapide
- [ ] Dismissible (mémoriser le choix)
- [ ] Condition : navigateur PWA compatible + pas installée

**Paramètres**
- [ ] Nouvelle section "Stockage hors ligne"
- [ ] Statut : "🟢 Prête offline" / "🔴 Certains contenus en ligne"
- [ ] Espace utilisé : X MB / Y MB
- [ ] Bouton "Télécharger version offline"
- [ ] Liste des contenus cachés

**Home/UX**
- [ ] Card "Travailler partout" (offline capability)
- [ ] Icône 📶 + "✓ Fonctionne sans Internet"
- [ ] Installation guidée (2 clics max)

**Perte Connexion**
- [ ] Toast notification "Mode offline activé"
- [ ] Fonctionnalités : ✓ Lecture ✓ Exercices ✓ Mémo
- [ ] Impossibilités : ✗ Sync ✗ IA Tuto
- [ ] Synchro auto quand connexion revient

### ⏱️ Estimation
2 jours

---

## 📅 SPRINT 5+ - Améliorations Long Terme

### Sprint 5: Délai avant réplique suivante
- [ ] Option "delayBeforeNext" (0-2s)
- [ ] Configuration dans AudioSettingsPanel
- [ ] Application dans playAll()

### Sprint 6: Profils prédéfinis
- [ ] Profil "Nerveux" : 2s avant, 1.5s après
- [ ] Profil "Lent" : 3s avant, 1s après
- [ ] Profil "Normal" : 1s avant, 0.5s après
- [ ] Profil "Rapide" : 0s avant, 0s après
- [ ] Sauvegarder/charger profils

### Sprint 7: Analytics
- [ ] Combien d'users utilisent les délais?
- [ ] Quels délais sont les plus populaires?
- [ ] Temps gagné en répétition?

### Sprint 8: Groupes avancés
- [ ] Selection custom de répliques (pas sequential)
- [ ] Groupes intelligents (par personnage, par scène)
- [ ] Fusion de groupes
- [ ] Duplication de groupes

---

## 🔧 Checklists de Démarrage par Sprint

### Avant de commencer un sprint
```bash
# 1. Créer une branche
git checkout -b sprint-X-feature-name

# 2. Vérifier que main est à jour
git pull origin main

# 3. Lire la documentation du sprint
# dans SPRINT_X_*.md

# 4. Faire un test du build existant
npm run build

# 5. Démarrer le dev
npm run dev
```

### Après terminer un sprint
```bash
# 1. Vérifier le build
npm run build

# 2. Tester tous les scénarios
# (voir TEST_CHECKLIST_SPRINT_X.md)

# 3. Commiter les changements
git add .
git commit -m "Sprint X: Description"

# 4. Pusher la branche
git push origin sprint-X-feature-name

# 5. Créer un Pull Request
# (sur GitHub)

# 6. Merging après review
git checkout main
git merge sprint-X-feature-name
git push origin main
```

---

## 📊 Timeline Estimée

```
Semaine 1 : Sprint 1 ✅ (Mode Audio - Délais)
Semaine 2 : Sprint 2 (Mode Lecture - Contexte)
Semaine 3 : Sprint 3 (Groupes - Édition)
Semaine 4 : Sprint 4 (PWA - Offline)

Total : 1 mois pour les 4 sprints principaux
```

---

## 🎯 Points Critiques à Surveiller

### Sprint 2
- ⚠️ Query performance avec N répliques supplémentaires
- ⚠️ Mobile UX avec beaucoup de répliques visibles

### Sprint 3
- ⚠️ Pas de perte de données existantes
- ⚠️ Exercices complétés doivent survivre
- ⚠️ Transactions BD robustes

### Sprint 4
- ⚠️ Taille du cache PWA (peut être volumineux)
- ⚠️ Gestion des mises à jour offline

---

## 📚 Documentation à Maintenir

Après chaque sprint, mettre à jour :
- [ ] SPRINT_X_*.md (description technique)
- [ ] TEST_CHECKLIST_SPRINT_X.md (scenarios)
- [ ] Ce fichier (ROADMAP.md)

---

## 💡 Conseils pour les Développeurs

### Code Quality
- Toujours utiliser TypeScript/JSDoc pour les nouvelles fonctions
- Écrire des tests pour chaque scenario clé
- Documenter les assumptions

### Git Workflow
- 1 commit = 1 feature (atomique)
- Messages clairs en FR ou EN
- Rebase avant merge (pas de merge commits)

### Testing
- Tests manuels d'abord (rapide feedback)
- Puis regression suite (pas de breakage)
- Toujours tester sur mobile

---

**Roadmap créée par** : Copilot  
**Date** : 2026-11-05  
**Dernière mise à jour** : 2026-11-05  
**Version** : 1.0
