# 🔧 Guide d'intégration — Fichiers créés

Ce document décrit comment intégrer les nouveaux fichiers dans le code existant.

---

## 📂 Structure des fichiers créés

```
src/
├── components/
│   ├── GroupEditorModal.jsx           ← Modal édition groupes (Feature 4)
│   ├── AudioDelaySettings.jsx         ← Panel settings audio (Feature 2)
│   ├── OfflineIndicatorNew.jsx        ← Badge hors ligne (Feature 3)
│   └── ReplicaContextPreview.jsx      ← Modal contexte répliques (Feature 1)
│
├── hooks/
│   ├── useGroupEditor.js              ← Logic édition groupes (Feature 4)
│   ├── useAudioSettings.js            ← Load/save settings audio (Feature 2)
│   ├── useOnlineStatus.js             ← Détect online/offline (Feature 3)
│   └── useReplicaContext.js           ← Logic contexte répliques (Feature 1)
│
└── ...

ARCHITECTURE_FEATURES.md               ← Plan de développement complet
INTEGRATION_GUIDE.md                   ← Ce fichier
```

---

## 🎯 Intégration par Feature

### Feature 4 : Groupe de répliques — Édition ⭐ PRIORITÉ

#### Étape 1 : Vérifier l'API existante
**Fichier** : `src/lib/supabase.js`

Vérifier que `addReplicasToGroup` existe et fonctionne correctement :

```javascript
export const addReplicasToGroup = async (groupId, replicaIds) => {
  const items = replicaIds.map((replicaId, index) => ({
    group_id: groupId,
    replica_id: replicaId,
    order_index: index,
  }));

  const { error } = await supabase
    .from("replica_group_items")
    .upsert(items, { onConflict: "group_id,replica_id" });

  if (error) throw error;
};
```

✅ **C'est bon !** La fonction remplace complètement les répliques du groupe.

#### Étape 2 : Intégrer GroupEditorModal dans ReplicaGroups.jsx
**Fichier** : `src/components/ReplicaGroups.jsx`

**À ajouter en haut** :
```javascript
import GroupEditorModal from './GroupEditorModal';
import useGroupEditor from '../hooks/useGroupEditor';
```

**À ajouter dans le composant** (dans la fonction principale) :
```javascript
export function ReplicaGroupsManager({ ... }) {
  // ... état existant ...
  const { editingGroup, openEditor, closeEditor } = useGroupEditor();
```

**À modifier** : dans la boucle d'affichage des groupes, ajouter bouton ✏️ :

**AVANT** (Actuellement) :
```jsx
<button
  onClick={() => handleStartSelection(group)}
  className="p-2 text-gray-500 hover:text-primary-600"
>
  ✏️
</button>
```

**APRÈS** (Nouveau) :
```jsx
<button
  onClick={() => {
    openEditor(group);
    setSelectingForGroup(group);
  }}
  className="p-2 text-gray-500 hover:text-primary-600"
  title="Éditer le groupe"
>
  ✏️
</button>
```

**À ajouter en fin de JSX** (avant fermeture du composant principal) :
```jsx
{editingGroup && (
  <GroupEditorModal
    group={editingGroup}
    replicas={replicas}
    characters={characters}
    onSave={() => {
      closeEditor();
      loadData(); // Recharger les groupes
    }}
    onClose={closeEditor}
  />
)}
```

#### Étape 3 : Test
```bash
npm run dev
# Aller à ScriptDetail
# Cliquer "Sous-ensembles"
# Créer un groupe
# Cliquer ✏️ sur le groupe
# Modifier le nombre de répliques
# Cliquer "Sauvegarder"
# Vérifier que le groupe est mis à jour
```

---

### Feature 2 : Audio delays — Mode lecture

#### Étape 1 : Créer la table DB (Migration Supabase)

**Fichier** : `supabase/migrations/add_audio_settings.sql` (À créer)

```sql
-- Créer table des settings audio utilisateur
CREATE TABLE user_audio_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  delay_before_ms INT DEFAULT 1500 CHECK (delay_before_ms >= 1000 AND delay_before_ms <= 3000),
  delay_after_ms INT DEFAULT 1000 CHECK (delay_after_ms >= 500 AND delay_after_ms <= 2000),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- RLS Policy
ALTER TABLE user_audio_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read/write own audio settings"
  ON user_audio_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index
CREATE INDEX idx_user_audio_settings_user_id ON user_audio_settings(user_id);
```

#### Étape 2 : Ajouter API dans supabase.js

**Fichier** : `src/lib/supabase.js` (Ajouter en fin de fichier)

```javascript
// =====================================================
// AUDIO SETTINGS (Délais avant/après réplique)
// =====================================================

export const getUserAudioSettings = async (userId) => {
  const { data, error } = await supabase
    .from("user_audio_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  
  return data || {
    delay_before_ms: 1500,
    delay_after_ms: 1000,
  };
};

export const updateUserAudioSettings = async (userId, delayBeforeMs, delayAfterMs) => {
  const { data, error } = await supabase
    .from("user_audio_settings")
    .upsert({
      user_id: userId,
      delay_before_ms: delayBeforeMs,
      delay_after_ms: delayAfterMs,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
};
```

#### Étape 3 : Mettre à jour useAudioSettings.js

**Fichier** : `src/hooks/useAudioSettings.js` (Décommenter les calls DB)

```javascript
// Dans le useEffect de loadSettings :
const stored = localStorage.getItem(`audio_settings_${userId}`);
if (stored) {
  // ... existing ...
} else {
  try {
    // ✅ DÉCOMMENTER CES LIGNES
    const data = await getUserAudioSettings(userId);
    setSettings(prev => ({
      ...prev,
      delayBeforeMs: data.delay_before_ms,
      delayAfterMs: data.delay_after_ms,
      loading: false,
    }));
  } catch (err) {
    // fallback localStorage
  }
}

// Dans saveSettings :
// ✅ AJOUTER
import { updateUserAudioSettings } from '../lib/supabase';

// Puis décommenter :
// await updateUserAudioSettings(userId, delayBeforeMs, delayAfterMs);
```

#### Étape 4 : Intégrer AudioDelaySettings dans Settings.jsx

**Fichier** : `src/pages/Settings.jsx`

**À ajouter en haut** :
```javascript
import AudioDelaySettings from '../components/AudioDelaySettings';
```

**À ajouter dans JSX** (section paramètres) :
```jsx
<section className="mb-8">
  <h3 className="text-2xl font-bold mb-4">🔊 Audio</h3>
  <AudioDelaySettings userId={user?.id} />
</section>
```

#### Étape 5 : Utiliser les settings en AudioMode.jsx

**Fichier** : `src/pages/AudioMode.jsx`

**À ajouter en haut** :
```javascript
import useAudioSettings from '../hooks/useAudioSettings';
```

**Dans le composant** :
```javascript
const { delayBeforeMs, delayAfterMs } = useAudioSettings(user?.id);

// Dans la fonction de lecture audio (à adapter selon votre code) :
async function playReplicaWithDelays(replica, audioData) {
  // Attendre avant
  await new Promise(resolve => setTimeout(resolve, delayBeforeMs));
  
  // Jouer l'audio
  const audio = new Audio(audioData);
  await audio.play();
  
  // Attendre après
  await new Promise(resolve => setTimeout(resolve, delayAfterMs));
}
```

#### Étape 6 : Test
```bash
npm run dev
# Aller à Settings
# Trouver section "🔊 Audio"
# Modifier délais
# Cliquer "Sauvegarder"
# Aller à AudioMode
# Vérifier que les délais s'appliquent
```

---

### Feature 1 : Contexte répliques — Mode lecture

#### Étape 1 : Intégrer useReplicaContext dans ScriptDetail.jsx

**Fichier** : `src/pages/ScriptDetail.jsx`

**À ajouter en haut** :
```javascript
import useReplicaContext from '../hooks/useReplicaContext';
import ReplicaContextPreview from '../components/ReplicaContextPreview';
```

**Dans le composant** (avec les autres états) :
```javascript
const [currentReplicaIndex, setCurrentReplicaIndex] = useState(null);
const [showContextPreview, setShowContextPreview] = useState(false);
const { contextReplicas, hasContext } = useReplicaContext(
  replicas, 
  currentReplicaIndex,
  1  // nombre de répliques précédentes à afficher
);
```

#### Étape 2 : Ajouter bouton pour afficher contexte

**Dans le rendu de chaque réplique** :
```jsx
{hasContext && (
  <button
    onClick={() => setShowContextPreview(true)}
    className="text-sm text-primary-600 hover:text-primary-700 ml-2"
  >
    👁️ Voir contexte ({contextReplicas.length})
  </button>
)}
```

#### Étape 3 : Ajouter modal

**En fin de JSX** :
```jsx
{showContextPreview && (
  <ReplicaContextPreview
    replicas={contextReplicas}
    characters={characters}
    currentReplicaIndex={currentReplicaIndex}
    onClose={() => setShowContextPreview(false)}
  />
)}
```

---

### Feature 3 : Offline badge — PWA

#### Étape 1 : Intégrer dans Header.jsx

**Fichier** : `src/components/layout/Header.jsx`

**À ajouter en haut** :
```javascript
import OfflineIndicator from '../OfflineIndicatorNew';
```

**Dans le header** (à côté d'autres contrôles) :
```jsx
<div className="flex items-center gap-3">
  <OfflineIndicator />
  {/* ... autres éléments ... */}
</div>
```

#### Étape 2 : Test
```bash
npm run dev
# Badge doit s'afficher en haut
# Mode offline (DevTools > Network > Offline)
# Badge devient orange
# Redevient vert quand online
```

---

## 🧪 Validation

### Checklist par feature

**Feature 1 ✅**
- [ ] Hook useReplicaContext charge les répliques précédentes
- [ ] Modal s'ouvre au tap du bouton
- [ ] Navigation prev/next fonctionne
- [ ] Fermeture sans erreur

**Feature 2 ✅**
- [ ] Table DB créée avec succès
- [ ] AudioDelaySettings sauvegarde les settings
- [ ] useAudioSettings charge depuis DB
- [ ] Délais appliqués en AudioMode
- [ ] Timeline simulation affiche correctement

**Feature 3 ✅**
- [ ] Badge affiche en header
- [ ] Couleur vert quand online
- [ ] Couleur orange quand offline
- [ ] Tooltip affiche date sync

**Feature 4 ✅** (Priorité)
- [ ] Bouton ✏️ visible sur chaque groupe
- [ ] Modal édition ouvre au tap
- [ ] Répliques existantes pré-cochées
- [ ] Ajouter/retirer répliques fonctionne
- [ ] "Sauvegarder" met à jour groupe
- [ ] Toast de confirmation affiche
- [ ] Pas d'erreur console

---

## 🐛 Troubleshooting

### Feature 4 : Groupe ne se met pas à jour
1. Vérifier que `addReplicasToGroup` est appelé
2. Vérifier les logs DB : `console.log(replicaIds)`
3. Tester directement depuis `supabase.js` :
```javascript
// Dans la console du navigateur
import { addReplicasToGroup } from './lib/supabase';
await addReplicasToGroup('group-id', ['replica-1', 'replica-2']);
```

### Feature 2 : Settings ne se sauvegardent pas
1. Migration DB exécutée ? → Vérifier Supabase Dashboard
2. RLS policy correcte ? → Vérifier auth.uid()
3. Vérifier localStorage : `localStorage.getItem('audio_settings_USER_ID')`

### Feature 3 : Badge ne change pas en offline
1. Ouvrir DevTools > Network > Work Offline
2. Vérifier event listeners :
```javascript
// Dans console
window.addEventListener('offline', () => console.log('OFFLINE'));
window.addEventListener('online', () => console.log('ONLINE'));
```

---

## 📝 Notes de développement

- **Feature 4** utilise `addReplicasToGroup` existante → remplace complètement la liste
- **Feature 2** stocke en localStorage en fallback si DB down
- **Feature 3** utilise `navigator.onLine` — portable mais parfois bugué en 4G
- **Feature 1** charge les répliques **avant** la réplique actuelle seulement

---

## ✅ Prochaines étapes

1. ✅ Créer les fichiers (FAIT)
2. ⏳ **Feature 4 : Intégration ReplicaGroups** (2h)
3. ⏳ **Feature 2 : Migration DB + Settings** (3h)
4. ⏳ **Feature 1 : Intégration ScriptDetail** (2h)
5. ⏳ **Feature 3 : Header + offline** (1h)
6. ⏳ Tests et validation (2h)

