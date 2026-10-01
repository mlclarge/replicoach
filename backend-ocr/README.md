# Backend OCR RépliCoach

Le parcours Premium `/api/extract-premium` utilise Gemini Vision pour extraire
automatiquement le titre, les personnages et les répliques d'un PDF. Le parcours
Standard effectue l'OCR localement dans le navigateur ; le backend n'expose pas
d'endpoint OCR générique.

## Configuration

Configurer ces variables dans l'environnement du service backend (Render en
production, variables locales en développement) :

- `SUPABASE_URL` et `SUPABASE_ANON_KEY` : validation de la session Supabase et
  lecture du champ `profiles.is_premium` avec les règles RLS de l'utilisateur.
- `GEMINI_API_KEY` : clé privée du serveur, jamais exposée au navigateur.
- `GEMINI_OCR_MODEL` : facultatif, `gemini-3.8-flash` par défaut. `gemini-2.5-flash`
  n'est plus utilisable en génération de contenu pour les nouveaux comptes Gemini
  (erreur 404 malgré sa présence dans le catalogue de modèles).
- `FRONTEND_ORIGINS` : origines frontend séparées par des virgules. Par défaut,
  seules les origines locales Vite sont autorisées.

Voir [.env.example](./.env.example) pour les noms de variables. Aucun secret ne
doit être commité.

## Contrôle d'accès

`/api/extract-premium` exige un jeton Bearer d'une session Supabase valide et
vérifie également le statut Premium dans `profiles` côté serveur ; un statut
envoyé par le navigateur n'est jamais accepté comme preuve d'accès. Les réponses
sont `401` si la session est absente/invalide et `403` si le compte n'est pas
Premium.

Les fichiers PDF sont limités à 50 Mio et supprimés du disque temporaire après
traitement. Le fichier temporaire transmis à Gemini est supprimé après
l'extraction ; en cas d'échec de suppression, le service le journalise.

## Progression du Scan Premium

`/api/extract-premium` renvoie les jalons vérifiés sous forme d'événements SSE :
réception du PDF, transfert et préparation par Gemini, début de génération,
réception puis validation du résultat. La génération Gemini ne fournit pas de
pourcentage exploitable ; l'interface indique donc qu'elle est en cours sans
simuler un pourcentage pendant cette étape.

## Lancement local

Depuis ce dossier, installer `requirements.txt`, renseigner les variables
backend ci-dessus, puis démarrer `uvicorn main:app --reload --port 8000`.

## OCR Standard

Le parcours Standard reste local au navigateur avec Tesseract.js. Il ne dépend
pas du backend et ne transmet pas de PDF à Gemini.
