# ✅ CHECKLIST TEST - Sprint 1 Audio Delays

## 🧪 Tests à effectuer AVANT la production

### 1. Test du Build
- [ ] `npm run build` sans erreurs
- [ ] `dist/` généré correctement
- [ ] Aucun warning dans la console Vite

### 2. Test du Démarrage Dev
- [ ] `npm run dev` sur le port 5173
- [ ] Page charge sans erreur 
- [ ] Pas d'erreur dans la console du navigateur

### 3. Test d'Auth & Store
- [ ] Se connecter avec un compte
- [ ] Aller sur `Profile` → Onglet "🔊 Audio"
- [ ] Onglet apparaît correctement

### 4. Test du Composant AudioSettingsPanel
- [ ] Le composant s'affiche
- [ ] Les 6 boutons pour "Avant MA réplique" sont visibles
- [ ] Les 4 boutons pour "Après MA réplique" sont visibles
- [ ] Le résumé affiche : "0s avant, 0s après"

### 5. Test de Sélection des Délais
- [ ] Cliquer sur "1 seconde" (avant)
- [ ] Bouton passe en bleu
- [ ] Résumé affiche : "1s avant, 0s après"
- [ ] Cliquer sur "2 secondes" (après)
- [ ] Résumé affiche : "1s avant, 2s après"

### 6. Test de Sauvegarde
- [ ] Cliquer "💾 Sauvegarder"
- [ ] Alerte "✅ Paramètres audio sauvegardés" apparaît
- [ ] Rafraîchir la page (F5)
- [ ] Les délais sont toujours configurés (1s avant, 2s après)
- [ ] localStorage contient les bonnes valeurs

**Vérifier dans DevTools** :
```javascript
localStorage.getItem('audioPreferences')
// Doit retourner : {"delayBeforeMine":1,"delayAfterMine":2}
```

### 7. Test du Bouton Aperçu
- [ ] Cliquer "🎧 Aperçu des délais"
- [ ] Bouton se désactive avec spinner
- [ ] Message "Lecture..." s'affiche
- [ ] Après ~4-5 secondes, message change en "Aperçu terminé ✅"
- [ ] Après 2s, le panel disparaît

### 8. Test du Mode Audio
- [ ] Aller sur un script avec au moins 3 répliques
- [ ] Cliquer sur 🎤 "Mode Audio"
- [ ] Configurer : delayBeforeMine = 1.5s, delayAfterMine = 1s
- [ ] Revenir au script, attendre le chargement
- [ ] Sélectionner son rôle
- [ ] Lancer la lecture (bouton Play)
- [ ] ⏱️ Observer les pauses avant et après votre réplique

### 9. Test de Cohérence Temporelle
- [ ] Configuration : 1s avant, 2s après
- [ ] Déclencher play → remarquer pause de 1s avant la voix
- [ ] Voix du comédien ~1.5s
- [ ] ⏸️ Pause de 2s
- [ ] Voix du suivant
- [ ] **Total ajouté par réplique = 3s**

### 10. Test du Mode Manual
- [ ] Configurer mode "Manual" (réplique par réplique)
- [ ] Les délais NE DOIVENT PAS s'appliquer
- [ ] Cliquer sur chaque réplique individuellement
- [ ] Pas de pause entre les clics

### 11. Test de Réinitialisation
- [ ] Configurer : 3s avant, 3s après
- [ ] Cliquer "0 secondes" (avant)
- [ ] Cliquer "0 secondes" (après)
- [ ] Sauvegarder
- [ ] Résumé affiche "0s avant, 0s après"
- [ ] Comportement = état initial

### 12. Test sur Mobile
- [ ] Ouvrir sur téléphone/tablette
- [ ] Naviguer vers Profile → Audio
- [ ] Boutons s'affichent correctement sur petit écran
- [ ] Délais s'appliquent en mode audio
- [ ] Aperçu fonctionne

### 13. Test de Robustesse
- [ ] Configurer des délais
- [ ] Lancer une lecture
- [ ] Pausé avec le bouton ⏸️
- [ ] Reprendre la lecture
- [ ] **Aucun crash ni délai dupliqué**

- [ ] Changer de script pendant une lecture
- [ ] Revenir au premier script
- [ ] Les délais sont toujours appliqués

### 14. Test d'Edge Cases
- [ ] Sélectionner "0s" partout
- [ ] Aperçu devrait faire ~4s (sans délais ajoutés)
- [ ] Mode lecture en "repeat" avec délais longs
- [ ] Vérifier que la lecture ne s'arrête pas

### 15. Test de Performance
- [ ] Mode audio avec 100+ répliques
- [ ] Délais configurés
- [ ] Aucun lag ou saccade
- [ ] Transition fluide entre répliques

---

## 🔍 Vérifications Additionnelles

### Console Browser
- [ ] Aucune erreur rouge
- [ ] Aucun warning critique

### Network Tab
- [ ] Aucune requête non-résolue
- [ ] localStorage fonctionne

### Lighthouse
- [ ] Performance > 90
- [ ] Accessibility > 90

---

## 📋 Checklist de Livraison

- [ ] Build successful sans warnings
- [ ] Tous les tests manuels passent
- [ ] Documentation `SPRINT_1_AUDIO_DELAYS.md` créée
- [ ] Code commenté où nécessaire
- [ ] Pas de `console.log()` de debug dans le code
- [ ] Responsive design OK (mobile/tablet/desktop)
- [ ] Prefs persistantes OK
- [ ] Délais appliqués correctement

---

## 🎯 Points Critiques à Valider

| Point | OK | NOK | Note |
|-------|-----|------|------|
| Build | [ ] | [ ] | |
| Persistance localStorage | [ ] | [ ] | |
| Délai avant réplique | [ ] | [ ] | |
| Délai après réplique | [ ] | [ ] | |
| Mode Manual (pas de délai) | [ ] | [ ] | |
| Responsive mobile | [ ] | [ ] | |
| Onglet Audio visible | [ ] | [ ] | |
| Aperçu temporel | [ ] | [ ] | |

---

## 📞 Support & Debug

**Si un test échoue** :

1. **Vérifier l'état du store**
   ```javascript
   import { useAuthStore } from "./store/authStore";
   useAuthStore.getState().audioPreferences
   ```

2. **Vérifier localStorage**
   ```javascript
   JSON.parse(localStorage.getItem('audioPreferences') || '{}')
   ```

3. **Vérifier la personne est en mode "readMine"**
   - Son rôle doit être caché (hiddenCharacters)

4. **Vérifier que playAll() est appelé**
   - Pas en mode Manual
   - Pas en mode Italienne

---

**Date de test recommandée** : Après le premier déploiement  
**Responsable** : QA ou utilisateur bêta
