# 🎭 RépliCoach

Application d'apprentissage de texte pour comédiens. Permet de mémoriser facilement ses répliques avec différents modes d'apprentissage.

## 🚀 Quick Start

### 1. Installer les dépendances

```bash
npm install
```

### 2. Configurer Supabase

1. Crée un projet sur [supabase.com](https://supabase.com)
2. Exécute le script SQL dans `supabase/migrations/001_initial_schema.sql`
3. Copie `.env.example` en `.env.local` et remplis les valeurs

```bash
cp .env.example .env.local
```

### 3. Lancer en développement

```bash
npm run dev
```

L'app sera disponible sur http://localhost:5173

## 📦 Stack Technique

- **Frontend** : React 18 + Vite + Tailwind CSS
- **Backend** : Supabase (Auth + PostgreSQL + Storage)
- **State** : Zustand
- **Routing** : React Router

## 🗂️ Structure

```
src/
├── components/     # Composants réutilisables
├── lib/           # Configuration (Supabase)
├── pages/         # Pages de l'app
└── store/         # État global (Zustand)
```

## 🚀 Déploiement

### Vercel (recommandé)

1. Push le code sur GitHub
2. Importe le repo sur [vercel.com](https://vercel.com)
3. Configure les variables d'environnement
4. Deploy !

N'oublie pas de mettre à jour l'URL du site dans Supabase Authentication.

## 📝 Prochaines étapes

- [ ] Page Upload avec OCR (Tesseract.js)
- [ ] Parsing des scripts théâtraux
- [ ] Modes d'apprentissage (trous, indices, etc.)
- [ ] Synthèse vocale (Web Speech API)
- [ ] Système de partage

## 📄 License

MIT
