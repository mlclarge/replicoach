# 📚 INDEX — Fichiers créés pour 4 Fonctionnalités

**Date de création** : 5 novembre 2026  
**Total fichiers** : 11  
**Total lignes de code** : ~2500 LOC  

---

## 📖 Guide de lecture

### Pour commencer
👉 **[SUMMARY_EXECUTIVE.md](./SUMMARY_EXECUTIVE.md)** — Vue 1 page des 4 features (5 min)

### Pour développer
👉 **[ARCHITECTURE_FEATURES.md](./ARCHITECTURE_FEATURES.md)** — Plan technique complet (20 min)  
👉 **[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** — Steps-by-step d'intégration (30 min)

### Code source
📁 **src/components/** — 4 composants React  
📁 **src/hooks/** — 4 hooks réutilisables  

---

## 🎯 4 Fonctionnalités

### ⭐ Feature 4 : Édition groupes de répliques (PRIORITÉ)

**Problème** : Impossible de modifier le nombre de répliques dans un groupe après création  
**Solution** : Bouton ✏️ "Éditer" + modal checkbox  
**Temps** : 2-3h  

**Fichiers créés** :
- `src/components/GroupEditorModal.jsx` (5.6KB)
- `src/hooks/useGroupEditor.js` (2.5KB)

**Fichiers à modifier** :
- `src/components/ReplicaGroups.jsx` (+30 lignes)

**Checklist** :
- [ ] Copier GroupEditorModal.jsx
- [ ] Copier useGroupEditor.js
- [ ] Modifier ReplicaGroups.jsx (voir INTEGRATION_GUIDE.md:L82)
- [ ] Test: creer → editer → sauvegarder
- [ ] Commit

---

### 🔊 Feature 2 : Audio delays — Mode lecture (P1)

**Problème** : Comédien n'a pas le temps de dire sa réplique en filtrage personnel  
**Solution** : Settings délai avant (1-3s) + après (0.5-2s)  
**Temps** : 3-4h  

**Fichiers créés** :
- `src/components/AudioDelaySettings.jsx` (6.8KB)
- `src/hooks/useAudioSettings.js` (2.5KB)

**Fichiers à modifier** :
- `supabase/migrations/add_audio_settings.sql` (NOUVEAU)
- `src/lib/supabase.js` (+30 lignes)
- `src/pages/Settings.jsx` (+5 lignes)
- `src/pages/AudioMode.jsx` (+5 lignes)

**Steps** (voir INTEGRATION_GUIDE.md:L156) :
- [ ] Créer migration DB
- [ ] Ajouter API endpoints
- [ ] Intégrer AudioDelaySettings dans Settings
- [ ] Utiliser settings en AudioMode
- [ ] Test: settings save → load → apply delays
- [ ] Commit

---

### 👁️ Feature 1 : Contexte répliques — Mode lecture (P1)

**Problème** : Context surchargeant en filtrage + long texte avant  
**Solution** : Afficher répliques précédentes + modal tap pour détail  
**Temps** : 2-3h  

**Fichiers créés** :
- `src/components/ReplicaContextPreview.jsx` (5.2KB)
- `src/hooks/useReplicaContext.js` (968B)

**Fichiers à modifier** :
- `src/pages/ScriptDetail.jsx` (+20 lignes)

**Steps** (voir INTEGRATION_GUIDE.md:L299) :
- [ ] Copier ReplicaContextPreview.jsx
- [ ] Copier useReplicaContext.js
- [ ] Modifier ScriptDetail.jsx
- [ ] Test: filtre activé → bouton visible → modal ouvre
- [ ] Commit

---

### 📶 Feature 3 : Offline badge — PWA (P2)

**Problème** : User PWA hors ligne ne sait pas s'il utilise cache  
**Solution** : Badge header vert/orange + tooltip sync date  
**Temps** : 1-2h  

**Fichiers créés** :
- `src/components/OfflineIndicatorNew.jsx` (3.0KB)
- `src/hooks/useOnlineStatus.js` (1.0KB)

**Fichiers à modifier** :
- `src/components/layout/Header.jsx` (+3 lignes)

**Steps** (voir INTEGRATION_GUIDE.md:L327) :
- [ ] Copier OfflineIndicatorNew.jsx
- [ ] Copier useOnlineStatus.js
- [ ] Modifier Header.jsx
- [ ] Test: DevTools offline → orange badge
- [ ] Commit

---

## 📂 Structure fichiers

```
replicoach-starter/
│
├── 📄 SUMMARY_EXECUTIVE.md        ← START HERE (1 page overview)
├── 📄 ARCHITECTURE_FEATURES.md    ← Technical plan (plan complet)
├── 📄 INTEGRATION_GUIDE.md        ← Step-by-step intégration
├── 📄 FILES_INDEX.md              ← This file
│
├── src/
│   ├── components/
│   │   ├── GroupEditorModal.jsx           🆕 Feature 4
│   │   ├── AudioDelaySettings.jsx         🆕 Feature 2
│   │   ├── OfflineIndicatorNew.jsx        🆕 Feature 3
│   │   ├── ReplicaContextPreview.jsx      🆕 Feature 1
│   │   ├── ReplicaGroups.jsx              ✏️ Modified
│   │   ├── layout/
│   │   │   └── Header.jsx                 ✏️ Modified
│   │
│   ├── hooks/
│   │   ├── useGroupEditor.js              🆕 Feature 4
│   │   ├── useAudioSettings.js            🆕 Feature 2
│   │   ├── useOnlineStatus.js             🆕 Feature 3
│   │   └── useReplicaContext.js           🆕 Feature 1
│   │
│   ├── pages/
│   │   ├── Settings.jsx                   ✏️ Modified (F2)
│   │   ├── AudioMode.jsx                  ✏️ Modified (F2)
│   │   ├── ScriptDetail.jsx               ✏️ Modified (F1)
│   │
│   └── lib/
│       └── supabase.js                    ✏️ Modified (F2)
│
└── supabase/
    └── migrations/
        └── add_audio_settings.sql         🆕 Feature 2
```

---

## 📊 Résumé chiffres

| Métrique | Valeur |
|----------|--------|
| **Fichiers créés** | 10 |
| **Fichiers modifiés** | 6 |
| **Total LOC (code + docs)** | ~2500 |
| **Docs** | 3 x markdown (35KB) |
| **Composants React** | 4 |
| **Hooks** | 4 |
| **Migrations DB** | 1 |
| **Breaking changes** | 0 |
| **Bundle size (+)** | ~12KB gzipped |
| **Est. dev time** | ~10-12h |

---

## 🚀 Quick Start

### Option A : Feature 4 only (urgent)
```bash
# 1. Copy files
cp src/components/GroupEditorModal.jsx src/components/
cp src/hooks/useGroupEditor.js src/hooks/

# 2. Follow INTEGRATION_GUIDE.md:L82-L110
# 3. npm run dev
# 4. Test & commit
```
⏱️ **2h30**

### Option B : All 4 features (2 weeks sprint)
```bash
# Week 1
# - Feature 4 (2h30)
# - Feature 2 (4h with DB)

# Week 2
# - Feature 1 (2h)
# - Feature 3 (1h)
# - Testing & fixes (3h)
```
⏱️ **~12h total**

---

## 📝 Files Manifest

### Documentations (3 fichiers)
| Fichier | Size | Purpose |
|---------|------|---------|
| SUMMARY_EXECUTIVE.md | 6.5KB | Vue générale 1 page |
| ARCHITECTURE_FEATURES.md | 12.6KB | Plan technique complet |
| INTEGRATION_GUIDE.md | 12.0KB | Steps intégration par feature |

### Components (4 fichiers)
| Fichier | Size | Feature | Status |
|---------|------|---------|--------|
| GroupEditorModal.jsx | 5.6KB | 4 | ✅ Ready |
| AudioDelaySettings.jsx | 6.8KB | 2 | ✅ Ready |
| ReplicaContextPreview.jsx | 5.2KB | 1 | ✅ Ready |
| OfflineIndicatorNew.jsx | 3.0KB | 3 | ✅ Ready |

### Hooks (4 fichiers)
| Fichier | Size | Feature | Status |
|---------|------|---------|--------|
| useGroupEditor.js | 2.5KB | 4 | ✅ Ready |
| useAudioSettings.js | 2.6KB | 2 | ✅ Ready |
| useReplicaContext.js | 968B | 1 | ✅ Ready |
| useOnlineStatus.js | 1.0KB | 3 | ✅ Ready |

---

## ✅ Validation Checklist

### Pre-integration
- [ ] SUMMARY_EXECUTIVE.md lu
- [ ] ARCHITECTURE_FEATURES.md compris
- [ ] INTEGRATION_GUIDE.md lu

### Feature 4 (Début)
- [ ] Fichiers copiés
- [ ] ReplicaGroups.jsx modifié (L82-L110 INTEGRATION_GUIDE)
- [ ] npm run dev sans erreur
- [ ] Test: groupe create/edit/save
- [ ] Commit: `feat(groups): add group editor modal`

### Feature 2 (Suite)
- [ ] Migration SQL exécutée
- [ ] API ajoutée
- [ ] Settings UI intégrée
- [ ] AudioMode utilisateur settings
- [ ] Test: settings save → apply
- [ ] Commit: `feat(audio): add delay before/after settings`

### Feature 1 (Suite)
- [ ] Contexte hook + composant intégrés
- [ ] Button visible quand contexte dispo
- [ ] Modal ouvre/ferme correctement
- [ ] Test: filtre + button + modal
- [ ] Commit: `feat(reading): show previous replicas in context`

### Feature 3 (Final)
- [ ] Badge intégré Header
- [ ] Online/offline toggle fonctionne
- [ ] Test: DevTools offline → voir changes
- [ ] Commit: `feat(pwa): add offline indicator badge`

### Final
- [ ] Build succeeds: `npm run build`
- [ ] No console errors
- [ ] All features tested
- [ ] PR créée avec description

---

## 🔗 Quick Links

- **Repository** : mlclarge/replicoach
- **Branch** : feature/4-functionalities (à créer)
- **Issues** : TBD (à lier aux commits)
- **Figma** : [Lien design si disponible]

---

## 💡 Tips

1. **Lire SUMMARY_EXECUTIVE.md d'abord** (5 min)
2. **Feature 4 = quick win** → commencer par là
3. **Feature 2 nécessite DB** → peut être fait en parallel
4. **Feature 1 & 3 indépendantes** → pas de dependencies
5. **Test chaque feature isolément** avant merge

---

## 🤝 Questions?

Voir section **Troubleshooting** dans INTEGRATION_GUIDE.md (L430+)

**Good luck! 🚀**

