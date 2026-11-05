# 📋 Plan de Développement Replicoach - 4 Fonctionnalités

## Vue d'ensemble
```
P0 (Urgent)  : 4. Groupe de répliques - Édition du nombre de répliques
P1 (CT)      : 2. Audio delays + 1. Contexte lecture avec filtres
P2 (Nice)    : 3. Offline badge UI
```

---

## 🎯 FONCTIONNALITÉ 1 : MODE LECTURE - Contexte amélioré

### Objectif
Afficher les répliques précédentes en mode lecture quand :
- Filtre exercice + tri par auteur unique activé
- Filtre "mes répliques uniquement" + exercice
- Affichage complet au tap du doigt (modal light-box)

### Pourquoi
Éviter de surcharger le contexte quand un long texte précède l'intervention du comédien

### Architecture
```
ScriptDetail.jsx (existant)
  ├── État : showFullReplicaPreview, replicaIndexInContext
  ├── Logique : charger X répliques précédentes (param 1-3)
  └── Composant : <ReplicaContextPreview />
  
ReplicaContextPreview.jsx (NOUVEAU)
  ├── Modal light-box au tap
  ├── Affiche texte complet de chaque réplique
  └── Navigation : prev/next réplique
```

### Fichiers à créer
- `src/components/ReplicaContextPreview.jsx` — Modal overlay
- `src/hooks/useReplicaContext.js` — Logic pour charger contexte

### Fichiers à modifier
- `src/pages/ScriptDetail.jsx` — Intégrer hook + passer contexte
- `src/lib/listeningFilter.js` — Enrichir logique de filtrage

### Specs d'implémentation
```javascript
// Params
const contextReplicasCount = 1; // ou 2, ou 3

// State
{
  showFullReplicaPreview: boolean,
  replicaIndexInContext: number,
  contextReplicas: Array<Replica> // Les X répliques avant
}

// Trigger
Au tap sur réplique → modal s'ouvre
Modal: [← Réplique N-2] Réplique actuelle [Réplique N-1 →]
```

---

## 🔊 FONCTIONNALITÉ 2 : MODE AUDIO - Délais personnalisables

### Objectif
Ajouter pause **avant** et **après** la réplique du comédien en lecture audio avec filtrage personnel

### Pourquoi
Permet au comédien d'avoir le temps de dire sa réplique en situation réelle (1-3 répliques avant/après)

### Architecture
```
Settings.jsx
  └── AudioDelaySettings.jsx (NOUVEAU)
      ├── Select : délai avant [1.0s, 1.5s, 2s, 2.5s, 3s]
      ├── Select : délai après [0.5s, 1s, 1.5s, 2s]
      └── Preview : chrono simulation

Supabase
  └── user_preferences / user_audio_settings
      ├── user_id (FK)
      ├── delay_before: float (default 1.5)
      ├── delay_after: float (default 1.0)
      └── updated_at

audioPlayer.js (MODIFIÉ)
  └── injecter setTimeout avant/après lecture
```

### Fichiers à créer
- `src/components/AudioDelaySettings.jsx` — UI settings
- `src/hooks/useAudioSettings.js` — Load/save settings
- `src/lib/audioPlayer.js` (ou `audioStorage.js`) — Logic délai

### Fichiers à modifier
- `src/pages/Settings.jsx` — Intégrer `AudioDelaySettings`
- `src/pages/AudioMode.jsx` — Utiliser settings de délai
- `src/lib/supabase.js` — Ajouter CRUD user_audio_settings
- `supabase/migrations/*.sql` — Table user_audio_settings

### Specs d'implémentation
```javascript
// DB Migration
CREATE TABLE user_audio_settings (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  delay_before_ms INT DEFAULT 1500,
  delay_after_ms INT DEFAULT 1000,
  updated_at TIMESTAMP DEFAULT now()
);

// API
export const getUserAudioSettings = async (userId)
export const updateUserAudioSettings = async (userId, delayBefore, delayAfter)

// audioPlayer.js
async function playReplicaWithDelays(replica, settings) {
  await sleep(settings.delay_before_ms);
  await playAudio(replica);
  await sleep(settings.delay_after_ms);
}
```

---

## 📶 FONCTIONNALITÉ 3 : MODE HORS LIGNE (PWA) - UI Mise en avant

### Objectif
Signaler clairement à l'utilisateur que l'appli fonctionne sans internet

### Pourquoi
Transparence : utilisateur sait qu'il utilise le cache et ne perdra pas ses données

### Architecture
```
Header.jsx (MODIFIÉ)
  ├── OfflineIndicator.jsx (MODIFIÉ)
  │   ├── Hook: useOnlineStatus()
  │   ├── Badge: "Hors ligne ✓" (vert/orange)
  │   └── Tooltip: "Données synchro le [date]"
  │
Settings.jsx
  └── Rubrique Offline
      ├── Badge: sync status
      └── Bouton: "Resync maintenant"

sw.js (existant PWA)
  └── Tracking last sync date
```

### Fichiers à créer
- `src/hooks/useOnlineStatus.js` — Hook online/offline
- `src/hooks/useLastSyncDate.js` — Fetch last sync timestamp

### Fichiers à modifier
- `src/components/layout/Header.jsx` — Ajouter OfflineIndicator
- `src/components/OfflineIndicator.jsx` — Enrichir (badge + tooltip)
- `src/pages/Settings.jsx` — Section Offline

### Specs d'implémentation
```javascript
// useOnlineStatus.js
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  useEffect(() => {
    window.addEventListener('online', () => setIsOnline(true));
    window.addEventListener('offline', () => setIsOnline(false));
  }, []);
  
  return isOnline;
};

// OfflineIndicator.jsx UI
<div className={isOnline ? "text-green-600" : "text-orange-600"}>
  {isOnline ? "📶 Connecté" : "📵 Hors ligne"}
</div>

// Tooltip
"Dernière synchro : 2025-11-05 10:23"
```

---

## ⭐ FONCTIONNALITÉ 4 : GROUPE DE RÉPLIQUES - Édition nombre répliques

### Objectif
**Pouvoir modifier le nombre de répliques dans un groupe déjà créé**

### Problème actuel (voir image)
- ✅ Créer groupe : sélectionner répliques en checkbox
- ✅ "Réviser ce groupe" : lire groupe (read-only)
- ❌ **Impossible de modifier le nombre de répliques après création**

### Solution
Ajouter bouton ✏️ "Éditer" qui ouvre modal édition avec checkbox sélectables

### Architecture

```
ReplicaGroups.jsx (MODIFIÉ)
  ├── Mode sélection : existant ✅
  ├── Mode révision : ajouter bouton ✏️
  └── handleStartSelection(group) → ouvre mode édition
      
GroupEditorModal.jsx (NOUVEAU - peut être intégré dans ReplicaGroups)
  ├── Header : "Éditer [GroupName]"
  ├── Liste répliques :
  │   ├── Checkbox pour chaque réplique
  │   ├── Affiche déjà sélectionnées (pré-checked)
  │   ├── Bouton ➕ "Ajouter réplique"
  │   └── Icône 🗑️ pour retirer
  ├── Footer :
  │   ├── Count : "X répliques sélectionnées"
  │   └── Boutons : [Annuler] [Sauvegarder]
  └── onSave → API PUT /replica-groups/{id}
```

### Fichiers à créer
- `src/components/GroupEditorModal.jsx` — Modal édition (optionnel : peut être dans ReplicaGroups)
- `src/hooks/useGroupEditor.js` — Logic CRUD groupe

### Fichiers à modifier
- `src/components/ReplicaGroups.jsx` — Ajouter logique édition
- `src/lib/supabase.js` — Vérifier/enrichir `updateReplicaGroup()`
- `supabase/migrations/*.sql` — Ensure table structure

### User Flow
```
1. User clique "Réviser ce groupe" → affiche groupe en lecture
2. Clique crayon ✏️ (nouveau) → modal édition s'ouvre
3. Modal affiche toutes répliques du script avec checkbox
4. Répliques déjà dans groupe : pré-cochées ✓
5. User ajoute/retire répliques
6. Clique "Sauvegarder" → API PUT
7. Toast : "Groupe mis à jour (12 répliques)"
8. Modal ferme, affichage révision mis à jour
```

### Specs d'implémentation

**Database (Supabase)**
```sql
-- Table existante (vérifier structure)
CREATE TABLE replica_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id UUID NOT NULL REFERENCES scripts(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366F1',
  tag_id UUID REFERENCES user_tags(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE replica_group_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES replica_groups(id) ON DELETE CASCADE,
  replica_id UUID NOT NULL REFERENCES replicas(id) ON DELETE CASCADE,
  order_index INT DEFAULT 0,
  UNIQUE(group_id, replica_id)
);
```

**API (supabase.js)**
```javascript
// Existant → adapter si nécessaire
export const updateReplicaGroup = async (groupId, updates) => {
  // Met à jour le groupe (name, color, tag_id, etc.)
  return await supabase
    .from("replica_groups")
    .update(updates)
    .eq("id", groupId)
    .select()
    .single();
};

// Existant → adapter si nécessaire
export const addReplicasToGroup = async (groupId, replicaIds) => {
  // Remplace complètement la liste des répliques du groupe
  // 1. Supprimer tous les items existants
  // 2. Insérer les nouveaux
  
  await supabase
    .from("replica_group_items")
    .delete()
    .eq("group_id", groupId);
  
  const items = replicaIds.map((id, idx) => ({
    group_id: groupId,
    replica_id: id,
    order_index: idx
  }));
  
  return await supabase
    .from("replica_group_items")
    .insert(items);
};
```

**Frontend (ReplicaGroups.jsx)**
```javascript
// État existant → ajouter flag édition
const [editingGroup, setEditingGroup] = useState(null);

// Nouvelles méthodes
const handleEditGroup = (group) => {
  setEditingGroup(group);
  setSelectingForGroup(group);  // Réutiliser logique sélection
};

const handleSaveEditedGroup = async (replicaIds) => {
  await addReplicasToGroup(editingGroup.id, replicaIds);
  setEditingGroup(null);
  loadData();  // Recharger
};

// UI : ajouter bouton ✏️
<button onClick={() => handleEditGroup(group)}>
  ✏️ Éditer
</button>
```

### Screens UI - Avant/Après
```
AVANT (actuel)
─────────────────────────────
┌─────────────────────────────┐
│ 📚 Sous-ensembles           │
├─────────────────────────────┤
│ ● Scene 1                   │
│ 10 réplique(s)              │
│                             │
│ [📖 Réviser ce groupe] (une │
│ seule action possible)      │
└─────────────────────────────┘


APRÈS (nouveau)
─────────────────────────────
┌─────────────────────────────┐
│ 📚 Sous-ensembles           │
├─────────────────────────────┤
│ ● Scene 1                   │
│ 10 réplique(s)              │
│ [✏️] [🗑️]                   │
│                             │
│ [📖 Réviser ce groupe]      │
└─────────────────────────────┘

Au tap sur ✏️ :
┌─────────────────────────────┐
│ ✏️ Éditer Scene 1            │
├─────────────────────────────┤
│ ☑️ Réplique #1 - ALBA       │
│ ☑️ Réplique #2 - GRISHKA   │
│ ☐ Réplique #3 - AYA        │
│ ☑️ Réplique #4 - LINA      │
│ ... (scroll)                │
├─────────────────────────────┤
│ 3 répliques sélectionnées   │
│ [Annuler] [Sauvegarder]     │
└─────────────────────────────┘
```

---

## 📊 Résumé des fichiers à créer/modifier

### À CRÉER
| Fichier | Feature | Type | Priorité |
|---------|---------|------|----------|
| `src/components/ReplicaContextPreview.jsx` | 1 | Component | P1 |
| `src/hooks/useReplicaContext.js` | 1 | Hook | P1 |
| `src/components/AudioDelaySettings.jsx` | 2 | Component | P1 |
| `src/hooks/useAudioSettings.js` | 2 | Hook | P1 |
| `src/hooks/useOnlineStatus.js` | 3 | Hook | P2 |
| `src/hooks/useLastSyncDate.js` | 3 | Hook | P2 |
| `supabase/migrations/add_audio_settings.sql` | 2 | Migration | P1 |

### À MODIFIER
| Fichier | Feature | Changes |
|---------|---------|---------|
| `src/pages/ScriptDetail.jsx` | 1 | Intégrer contexte |
| `src/lib/listeningFilter.js` | 1 | Enrichir logique |
| `src/pages/Settings.jsx` | 2, 3 | Ajouter sections |
| `src/pages/AudioMode.jsx` | 2 | Utiliser settings |
| `src/lib/supabase.js` | 2, 4 | CRUD settings |
| `src/components/ReplicaGroups.jsx` | 4 | Ajouter édition |
| `src/components/layout/Header.jsx` | 3 | Ajouter badge |
| `src/components/OfflineIndicator.jsx` | 3 | Enrichir |

---

## 🚀 Ordre de développement recommandé

```
PHASE 1 (Court terme)
  1. Feature 4 : Groupe édition (MVP 2h)
     - Modifier ReplicaGroups.jsx
     - Tester logique addReplicasToGroup
     - Validé ✓

  2. Feature 2 : Audio delays (4h)
     - Créer AudioDelaySettings.jsx
     - Migration DB
     - Intégrer AudioMode.jsx
     - Validé ✓

PHASE 2 (Moyen terme)
  3. Feature 1 : Contexte lecture (3h)
     - Créer ReplicaContextPreview.jsx
     - Intégrer ScriptDetail.jsx
     - Tester avec filtres

PHASE 3 (Nice to have)
  4. Feature 3 : Offline badge (1h)
     - Créer hooks
     - Modifier Header + Settings
```

---

## ✅ Checklist validation

- [ ] Feature 1 : Contexte affiche + tap ouvre modal
- [ ] Feature 2 : Settings sauvegardé + délai appliqué en audio
- [ ] Feature 3 : Badge affiche online/offline
- [ ] Feature 4 : ✏️ ouvre modal édition + sauvegarder met à jour groupe
- [ ] Build succeeds
- [ ] No console errors
