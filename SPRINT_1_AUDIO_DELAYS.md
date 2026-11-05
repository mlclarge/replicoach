# 🎤 SPRINT 1 : Mode Audio - Délais Configurables

**Status** : ✅ **IMPLÉMENTÉ** (Build réussi)  
**Date** : 2026-11-05  
**Objectif** : Permettre aux comédiens de configurer des délais avant/après leur réplique en mode audio

---

## 📋 Modifications Apportées

### 1. **Store (State Management) - `authStore.js`**

#### Ajouts :
- **`DEFAULT_AUDIO_PREFERENCES`** : Objet contenant les valeurs par défaut
  - `delayBeforeMine: 0` (0-3 secondes) ⏳
  - `delayAfterMine: 0` (0-3 secondes) ⏸️
  - `delayBeforeNext: 0` (réservé pour v2)

- **Nouvel état** : `audioPreferences` dans le store Zustand

- **Nouvelles méthodes** :
  - `updateAudioPreferences(prefs)` : Met à jour les prefs ET persiste dans localStorage
  - `loadAudioPreferences()` : Charge depuis localStorage (appelée dans `initialize()`)

#### Avantages :
✅ Prefs persistantes (survivent aux rafraîchissements)  
✅ Centralisées dans le store d'auth  
✅ Sauvegarde automatique  

---

### 2. **Mode Audio - `AudioMode.jsx`**

#### Modifications :

**Import des prefs audio** :
```javascript
const { user, isPremium, audioPreferences, loadAudioPreferences } = useAuthStore();
```

**Chargement au montage** :
```javascript
useEffect(() => {
  loadAudioPreferences();
}, [loadAudioPreferences]);
```

**Application dans `playAll()`** : Deux points critiques ajoutés

**Avant MA réplique** (quand le comédien doit parler) :
```javascript
if (audioPreferences?.delayBeforeMine > 0) {
  await new Promise((r) => setTimeout(r, audioPreferences.delayBeforeMine * 1000));
  if (!isActive()) break;
}
```

**Après MA réplique** (quand le comédien a fini de parler) :
```javascript
if (audioPreferences?.delayAfterMine > 0) {
  await new Promise((r) => setTimeout(r, audioPreferences.delayAfterMine * 1000));
  if (!isActive()) break;
}
```

**Emplacements** :
- ✅ Avant `await speak(...)` (ligne 1173 & 1213)
- ✅ Après `await speak(...)` (ligne 1181 & 1219)
- ✅ Deux contextes : réplique normale + réplique de "readMine"

---

### 3. **Composant UI - `AudioSettingsPanel.jsx` (NOUVEAU)**

#### Fonctionnalités :

**🎯 Section "Avant MA réplique"**
- 6 boutons de sélection rapide (0s, 1s, 1.5s, 2s, 2.5s, 3s)
- État visuel sélectionné (fond bleu)
- Conseil : "Recommandé : 1-2s"
- Explication : Permet de se préparer mentalement

**🎯 Section "Après MA réplique"**
- 4 boutons (0s, 1s, 2s, 3s)
- État visuel sélectionné
- Conseil : "Recommandé : 1s"
- Cas d'usage : Respiration entre répliques

**📊 Résumé en temps réel**
- Affiche les délais actuellement sélectionnés
- Calcul du temps total ajouté par réplique

**🎧 Aperçu audio**
- Bouton "Aperçu des délais"
- Simule une séquence complète (1s voix, délai, 2s voix, délai, 1.5s voix)
- Affiche le temps total simulé

**💾 Bouton Sauvegarder**
- Confirmation visuelle après sauvegarde
- Persiste dans localStorage

#### Styles & UX :
- Design cohérent avec le reste de l'app (Tailwind)
- Cartes avec bordures de couleur
- Zones d'info "💡 Astuce"
- Emojis pour lisibilité rapide

---

### 4. **Intégration dans Profile - `Profile.jsx`**

#### Ajouts :

**Import** :
```javascript
import AudioSettingsPanel from "../components/AudioSettingsPanel";
```

**Nouvel onglet** : "🔊 Audio"
- Ajouté après l'onglet "📅 Historique"
- État conditionnel : `activeTab === "audio"`
- Affiche `<AudioSettingsPanel />`

**Responsive** :
- Onglets sur 2 lignes sur mobile
- `flex-wrap` + `min-w-[100px]`

---

## 🧪 Validation

### ✅ Build
```bash
npm run build
```
**Résultat** : ✓ 623 modules transformés, 0 erreur  
**Taille finale** : ~387KB (gzippé : 111KB)

### 🧪 Tests Recommandés

#### 1. Charger les prefs audio
```javascript
// Dans DevTools Console
localStorage.getItem('audioPreferences')
// Doit retourner : {"delayBeforeMine":0,"delayAfterMine":0}
```

#### 2. Tester les délais en mode audio
- Aller sur un script
- Cliquer sur 🎤 Mode Audio
- Aller dans Profile → Onglet "🔊 Audio"
- Configurer : delayBeforeMine = 2s, delayAfterMine = 1s
- Revenir au script
- Cliquer sur "Jouer" sur une scène
- Observer les pauses avant/après la réplique

#### 3. Vérifier la persistance
- Configurer les délais
- Rafraîchir la page (F5)
- Les délais doivent rester configurer

#### 4. Test du bouton "Aperçu"
- Cliquer "🎧 Aperçu des délais"
- Bouton reste désactivé pendant la simulation
- Message affiche le temps total

---

## 📊 Comportement Audio

### Flux de lecture actuel (avec délais) :

```
┌─────────────────────────────────────────────────────────┐
│ 1. Réplique autre comédien (ALBA)                       │ 1s
├─────────────────────────────────────────────────────────┤
│ 2. ⏳ DÉLAI AVANT MA RÉPLIQUE                            │ 0-3s
├─────────────────────────────────────────────────────────┤
│ 3. 🎤 MA RÉPLIQUE (LINA) lue par TTS                   │ ~2s
├─────────────────────────────────────────────────────────┤
│ 4. ⏸️ DÉLAI APRÈS MA RÉPLIQUE                           │ 0-3s
├─────────────────────────────────────────────────────────┤
│ 5. Réplique suivant (AYA)                               │ 1.5s
└─────────────────────────────────────────────────────────┘
```

### Cas d'usage :

| Cas | delayBefore | delayAfter | Raison |
|-----|-------------|-----------|--------|
| Lecture rapide | 0s | 0s | Flux naturel |
| Acteur nerveux | 2s | 1s | Temps de préparation |
| Scène dramatique | 1.5s | 2s | Silences importants |
| Diction lente | 3s | 1s | Plus de temps à lire |

---

## 🔄 Migration de Données

**Historique de compatibilité** :
- ✅ Aucune migration BD requise
- ✅ Valeurs par défaut (0s) = comportement actuel
- ✅ Premiers utilisateurs : prefs vides → defaults appliqués

---

## 📝 Code Généré

### Fichiers créés :
- `src/components/AudioSettingsPanel.jsx` (274 lignes)

### Fichiers modifiés :
- `src/store/authStore.js` (+30 lignes)
- `src/pages/AudioMode.jsx` (+60 lignes)
- `src/pages/Profile.jsx` (+2 lignes import, +1 ligne onglet, +3 lignes contenu)

### Total : ~100 lignes nettes + 1 composant

---

## 🚀 Prochaines Étapes (SPRINT 2)

- [ ] Mode Lecture : Affichage du contexte des répliques précédentes
- [ ] Tooltip affichant le délai restant pendant la lecture
- [ ] Profils prédéfinis (Nerveux, Lent, Normal, etc.)
- [ ] Synchronisation des délais entre tous les appareils
- [ ] Analytics : combien d'utilisateurs utilisent les délais

---

## 🐛 Notes pour Debugging

Si les délais ne fonctionnent pas :
1. Vérifier localStorage : `console.log(localStorage.getItem('audioPreferences'))`
2. Vérifier le state du store : `useAuthStore.getState().audioPreferences`
3. Vérifier que `loadAudioPreferences` est appelé dans `App.jsx`
4. Vérifier que AudioMode utilise `audioPreferences` du store

---

**Développé par** : Copilot  
**Date d'implémentation** : 2026-11-05  
**Version** : 1.0
