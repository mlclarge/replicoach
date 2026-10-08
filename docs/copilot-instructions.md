# Contexte projet RépliCoach

Ce fichier regroupe le plan d'audit et le résumé technique de fin de session (mis à jour le 7 octobre 2026).

---

# Partie 1 — Plan d'audit V2

Excellente question, et vous avez raison de na pas vous arrêter là-dessus — c'est un choix d'architecture qui mérite d'être tranché consciemment. Voici mon analyse.


## Imparato n'a pas un meilleur OCR — il n'a pas d'OCR du tout


C'est le point clé à bien comprendre : Imparato **ne fait aucune reconnaissance visuelle**. Il exige un PDF/Word à texte déjà numérique et sélectionnable, plus une syntaxe structurée (`@Personnage`, `# Scène`, didascalies entre parenthèses) que l'utilisateur doit respecter — ou faire finaliser sur leur back-office web. C'est rapide et fiable *parce que ça élimine le problème difficile* (comprendre visuellement qui parle), pas parce que leur moteur de vision est supérieur.


**Copier cette approche serait une régression pour vous** : votre propre comparatif identifie l'OCR de scripts scannés comme un **avantage compétitif réel** de RépliCoach (beaucoup de textes de théâtre circulent en photocopies, scans de vieilles éditions, PDF image sans couche texte). Y renoncer pour "faire comme Imparato" ferait perdre ce différenciateur sans raison technique valable.


## Le vrai problème n'est pas l'OCR — c'est l'architecture en deux étapes séparées


En regardant le pipeline actuel (`PaddleOCR` détection de texte → `context_correction.py`/`rapidfuzz` pour rattacher chaque ligne à un personnage via correspondance floue), je vois la faiblesse structurelle : **c'est un pipeline de vision classique (OCR brut) suivi d'heuristiques de reconstruction**, deux problèmes traités séparément alors qu'ils sont liés. Pire : le backend actuel (`main.py`) exige que vous lui fournissiez la liste des personnages *avant* de lancer l'analyse (`characters: str = Form(...)` obligatoire) — ce qui **contredit frontalement** votre exigence Premium "aucune intervention utilisateur, pas de saisie des personnages". L'architecture actuelle ne peut pas atteindre cet objectif sans refonte, optimisation ou pas.


## Ma recommandation : modèles multimodaux (vision-LLM) en un seul passage, pas de l'OCR classique + règles


Là où un modèle comme Gemini 2.5/GPT-4o vision (ou un service Document AI managé type Google Document AI/Azure Document Intelligence) excelle, c'est précisément sur ce genre de document : reconnaître visuellement le texte **et** comprendre sa structure (qui parle, où sont les scènes, qu'est-ce qui est une didascalie) **en une seule passe**, sans liste de personnages fournie a priori. C'est exactement votre besoin Premium.


Comparaison des 3 options :


| Option | Vitesse | Précision attribution personnages | Contrainte "0 saisie utilisateur" | Coût |
|---|---|---|---|---|
| **A. Copier Imparato** (pas d'OCR, syntaxe imposée) | Rapide | N/A (l'utilisateur structure lui-même) | ❌ Ne respecte pas votre exigence | Nul |
| **B. Garder l'existant optimisé** (PaddleOCR self-hosted + parallélisation) | Moyenne (toujours CPU 1-thread bridé) | Moyenne (fuzzy matching, fragile sur gros casting) | ❌ Nécessite toujours la liste au départ | Infra fixe (déjà payée) |
| **C. Vision-LLM en un seul appel** (Gemini/GPT-4o vision ou Document AI managé) | Élevée (1 appel au lieu d'un pipeline séquentiel + chunking) | Élevée (compréhension contextuelle, pas de correspondance floue) | ✅ Détecte personnages/scènes nativement | Variable à l'usage → **Premium uniquement**, cohérent avec votre règle "0 API payante en Standard" |


**Recommandation : Option C pour le Premium.** Cela remplace `paddleOcrService.js` + le backend Python PaddleOCR par un appel direct à une API vision-LLM (ou Document AI managé), ce qui :
- supprime le découpage séquentiel en chunks de 5 pages (les modèles récents gèrent des documents entiers ou de très larges contextes) → gain de vitesse mécanique ;
- supprime la dépendance à une infra self-hosted CPU bridée (plus besoin de maintenir/scaler le conteneur `backend-ocr`) ;
- répond nativement à "aucune intervention utilisateur" puisque ces modèles n'ont pas besoin de la liste de personnages en entrée ;
- reste cohérent avec votre séparation Standard (Tesseract.js local, gratuit) / Premium (API payante assumée par l'abonnement).


Le flux natif-texte actuel (pdfjs-dist, gratuit, instantané) reste inchangé dans les deux versions — c'est déjà optimal, rien à toucher là.


**Conséquence sur le plan** : cela transforme le point #12 (upgrade infra) et une partie du #11 (auto-détection) en un seul chantier de remplacement d'architecture plutôt que deux briques séparées, et rend probablement `backend-ocr/` obsolète à terme (à conserver un temps en fallback pendant la transition, ou à supprimer une fois validé).


Demander à l’utilisateur
Completed with input: {
  "choices": [
    "Oui, partons sur cette architecture (vision-LLM/Document AI) pour le Premium",
    "Je veux d'abord un comparatif chiffré (coût/latence) entre options avant de trancher",
    "Gardons PaddleOCR mais amélioré/parallélisé, je ne veux pas tout remplacer"
  ],
  "question": "Êtes-vous d'accord pour orienter le pipeline OCR Premium vers un modèle vision-LLM en un seul appel (Gemini/GPT-4o vision ou Document AI managé) plutôt que de continuer à optimiser l'architecture PaddleOCR existante ?"
}


Je vais rassembler des données de tarification et de latence à jour pour ces options avant de vous proposer un comparatif chiffré fiable.


[https://ai.google.dev/gemini-api/docs/pricing](https://ai.google.dev/gemini-api/docs/pricing) a été récupéré
Completed with input: {"url":"https://ai.google.dev/gemini-api/docs/pricing"}


[https://cloud.google.com/document-ai/pricing](https://cloud.google.com/document-ai/pricing) a été récupéré
Completed with input: {"url":"https://cloud.google.com/products/document-ai/pricing"}


[https://aws.amazon.com/textract/pricing/](https://aws.amazon.com/textract/pricing/) a été récupéré
Completed with input: {"url":"https://aws.amazon.com/textract/pricing/"}


[https://azure.microsoft.com/en-us/pricing/details/ai-document-intelligence/](https://azure.microsoft.com/en-us/pricing/details/ai-document-intelligence/) a été récupéré
Completed with input: {"url":"https://azure.microsoft.com/en-us/pricing/details/document-intelligence/"}


Voici les données de tarification/latence que j'ai pu vérifier, avec les limites de précision inhérentes (tarifs qui varient par volume/région, et dépendent aussi de la longueur réelle de vos scripts) :


## Comparatif chiffré — coût & latence par option


| Option | Modèle de coût | Coût estimé pour un script de ~30 pages | Latence typique | Ce qu'il faut faire en plus |
|---|---|---|---|---|
| **A. PaddleOCR self-hosted (actuel)** | Infra fixe (hébergement conteneur) déjà payée, 0 coût variable par script | **0 €/script** en apparence, mais coût caché : CPU 1-thread bridé = lenteur, + temps de maintenance/scaling du service | Élevée : 6 chunks séquentiels × (upload + inference CPU + retour) → typiquement **30s à plusieurs minutes** selon nombre de pages | Toujours besoin d'un post-traitement heuristique (fuzzy matching) pour attribuer les répliques → fragile sur gros casting |
| **B. AWS Textract** (Detect Document Text) | $0,0015/page (1er million de pages/mois), $0,05/page si option "Forms" activée | ~30 pages × 0,0015 $ = **0,045 $/script** (texte brut) ; jusqu'à ~1,5 $/script avec extraction structurée | Rapide, quelques secondes par page, traitement parallélisable par API | **Ne fait pas l'attribution personnage/réplique** : il faudrait quand même coder une couche heuristique ou LLM par-dessus → ne résout pas seul votre exigence "0 saisie utilisateur" |
| **C. Google Document AI** | Tarification par page, comparable à Textract pour l'OCR de base (page = 1 unité), plus cher sur les processeurs "Form Parser"/Enterprise OCR spécialisés | Ordre de grandeur similaire à Textract pour l'OCR pur | Rapide, comparable à Textract | Même limite que B : bon en OCR brut, pas en compréhension "qui parle" |
| **D. Gemini vision (multimodal, 1 appel)** | Facturé au token : ~0,75 $/1M tokens entrée (jusqu'à fin 2026), ~3,75 $/1M tokens sortie (le JSON structuré personnages+répliques coûte en sortie) | Pour un script de 30 pages (~15-20k mots), sortie JSON ~30-50k tokens → **environ 0,15 à 0,30 $/script** | **1 seul appel réseau** (pas de chunking séquentiel) → potentiellement plus rapide en bout-en-bout malgré un temps d'inférence par requête un peu plus long | Rien : fait OCR + structuration + attribution personnages en une passe |
| **E. GPT-4o vision (1 appel)** | Ordre de grandeur comparable à D (tarifs légèrement différents, mêmes principes) | Similaire, quelques dizaines de centimes par script | Similaire à D | Idem D |


## Mon interprétation


- **B et C (Textract/Document AI) sont très bon marché et rapides pour l'OCR brut**, mais ils ne résolvent qu'une moitié du problème : vous récupérez du texte propre, mais l'attribution "qui dit quoi" reste à coder par-dessus (heuristiques ou appel LLM supplémentaire) — donc en pratique, les combiner avec un LLM revient à payer les deux coûts, pas à en économiser un.
- **D/E (vision-LLM en un seul appel) coûtent un peu plus par script (~0,15-0,30 $) mais suppriment une étape complète du pipeline** (plus besoin du service PaddleOCR self-hosted, ni du fuzzy-matching de personnages, ni du chunking séquentiel) — et répondent nativement à votre contrainte "aucune intervention utilisateur".
- **L'option A actuelle n'est pas réellement gratuite** : le coût est déplacé vers votre temps de maintenance et une latence subie par l'utilisateur, ce qui va à l'encontre de l'objectif "OCR ultra-rapide" du Premium.


**Ma recommandation reste D (Gemini vision)**, car à ~0,15-0,30 $/script c'est un coût variable maîtrisable pour un abonnement Premium payant, et l'architecture est nettement plus simple à maintenir qu'un service Python OCR self-hosted + heuristiques.


⚠️ **Réserve honnête** : ces chiffres sont des ordres de grandeur basés sur les grilles tarifaires publiques actuelles, pas une mesure réelle sur vos scripts. Avant de trancher définitivement, je recommande un **POC rapide** (5-10 scripts réels de tailles variées, mesurer coût réel + précision d'attribution + latence bout-en-bout) plutôt que de décider sur la seule base de ce tableau.


Demander à l’utilisateur
Completed with input: {
  "choices": [
    "Oui, faisons un POC comparé (Gemini vision vs Textract+règles) sur quelques scripts réels avant de trancher",
    "Non, je valide directement l'option D (Gemini vision) sans POC préalable",
    "Je veux d'abord voir le détail cout/latence pour GPT-4o vision aussi avant de choisir entre D et E"
  ],
  "question": "Souhaitez-vous qu'on lance un petit POC chiffré sur vos propres scripts avant de valider l'architecture OCR Premium, ou préférez-vous trancher directement sur la base de ce comparatif ?"
}


[https://openai.com/api/pricing/](https://openai.com/api/pricing/) a été récupéré
Completed with input: {"url":"https://openai.com/business/pricing/#api"}


[https://platform.openai.com/docs/pricing](https://platform.openai.com/docs/pricing) a été récupéré
Completed with input: {"url":"https://developers.openai.com/api/docs/pricing"}


Read 
Completed with input: {
  "path": "C:\\Users\\moz26\\AppData\\Local\\Temp\\1790701065854-copilot-tool-output-178ec36c6c994d5093e52edab7738a88.txt"
}


Search for `gpt-4o|GPT-4o|gpt-5|4\.1`


Read 
Completed with input: {
  "path": "C:\\Users\\moz26\\AppData\\Local\\Temp\\1790701065854-copilot-tool-output-178ec36c6c994d5093e52edab7738a88.txt"
}


Read , lines 1 to 60
Completed with input: {
  "path": "C:\\Users\\moz26\\AppData\\Local\\Temp\\1790701065854-copilot-tool-output-178ec36c6c994d5093e52edab7738a88.txt",
  "view_range": [
    1,
    60
  ]
}


Voici les données GPT-4o vérifiées (tarifs API OpenAI officiels) :


## Complément — GPT-4o vision


| | Input | Output |
|---|---|---|
| **GPT-4o** | 2,50 $ / 1M tokens | **10,00 $ / 1M tokens** |
| **Gemini (comparable)** | 0,75 $ / 1M tokens | 3,75 $ / 1M tokens |


Pour votre cas d'usage (beaucoup de **tokens de sortie** : le JSON structuré personnages+répliques d'un script complet, potentiellement 30-50k tokens), c'est le **prix de sortie qui domine le coût total** — et GPT-4o y est environ **2,5 à 2,7× plus cher** que Gemini.


## Tableau final consolidé


| Option | Coût estimé / script (30 pages) | Latence | Attribution personnages incluse | Verdict |
|---|---|---|---|---|
| A. PaddleOCR self-hosted (actuel) | ~0 € direct, coût caché en lenteur/maintenance | Lente (30s-plusieurs min, séquentiel) | Fragile (fuzzy matching) | ❌ À abandonner à terme |
| B. AWS Textract | ~0,05-1,5 $/script | Rapide | ❌ Non | Nécessite un LLM en plus → double coût |
| C. Google Document AI | Ordre similaire à B | Rapide | ❌ Non | Idem B |
| **D. Gemini vision (1 appel)** | **~0,15-0,30 $/script** | Rapide (1 appel, pas de chunking) | ✅ Oui | **Meilleur rapport coût/simplicité** |
| E. GPT-4o vision (1 appel) | **~0,35-0,55 $/script** (2,5× plus cher que D sur la sortie) | Comparable à D | ✅ Oui | Fonctionnellement équivalent à D mais plus coûteux |


**Conclusion** : à fonctionnalités égales (les deux font OCR + structuration + attribution personnages en un seul appel, sans saisie utilisateur), **Gemini vision est moins cher que GPT-4o** sur ce cas d'usage précis (sortie JSON volumineuse), pour un résultat équivalent. C'est aussi cohérent avec l'infrastructure déjà en place chez vous (vous utilisez déjà l'API Gemini pour le coaching IA — même fournisseur, une seule clé API à gérer).


Demander à l’utilisateur
Completed with input: {
  "choices": [
    "Valider Gemini vision comme architecture OCR Premium (sans POC préalable)",
    "Faire d'abord un petit POC sur quelques-uns de mes scripts réels pour confirmer précision/latence avant de valider",
    "Attendre, je veux encore réfléchir avant de trancher"
  ],
  "question": "Avec ce comparatif complet (D moins cher qu'E, tous deux bien plus simples que l'architecture actuelle), comment souhaitez-vous procéder ?"
}


Parfait, c'est acté : **Gemini vision en un seul appel** devient l'architecture cible de l'OCR Premium, en remplacement progressif de PaddleOCR self-hosted.


## Mise à jour du plan — chantiers #10/#11/#12 fusionnés


| # | Chantier | Priorité | Difficulté |
|---|---|---|---|
| 10-12 (fusionnés) | **Remplacer le pipeline PaddleOCR par un appel Gemini vision unique** : envoi direct du PDF/image à l'API Gemini avec un prompt de structuration (titre, personnages, scènes, répliques) — reprend et adapte le prompt déjà existant dans `geminiPdfProcessor.js` (actuellement code mort, à réactiver et fiabiliser plutôt qu'à jeter) | P0 | 🟡 |
| | → Supprimer le découpage en chunks séquentiels côté client (`paddleOcrService.js`), plus nécessaire avec un appel unique | P0 | 🟢 |
| | → Supprimer les champs obligatoires `characters`/`acts` du flux Premium (l'auto-détection remplace la saisie) | P0 | 🟢 |
| | → Conserver `backend-ocr/` en fallback temporaire le temps de valider la fiabilité en production, puis déprécier | P2 | 🟢 |
| | → Gérer les coûts/quotas API Gemini par utilisateur Premium (suivi de consommation, limites raisonnables par abonnement) | P1 | 🟡 |


Ce chantier devient plus simple qu'initialement prévu : au lieu de "paralléliser + changer d'infra", c'est un **remplacement net et plus léger** — moins de code à maintenir au final (suppression du service Python + Docker + fuzzy matching).


Voici le plan complet mis à jour dans son ensemble :


### Socle transverse (Standard + Premium)
| # | Chantier | Priorité | Difficulté |
|---|---|---|---|
| 1 | Audio arrière-plan + Media Session API (écran verrouillé) | P0 | 🔴 |
| 2 | Diagnostic PWA outillé (Lighthouse, tests réels) | P0 | 🟢 |
| 3 | Refonte navigation/UI (bottom-nav contextuelle, sélection personnage, menu scènes) | P1 | 🟡 |
| 4 | Téléchargement local auto à l'ouverture (hors-ligne proactif) | P1 | 🟡 |
| 5 | Mini-carte latérale de navigation | P2 | 🔴 |
| 6 | Silences calibrés / gestion majuscules-acronymes | P2 | 🟢 |
| 7 | Espace metteur en scène — socle de base | P2 | 🟡 |


### Standard uniquement
| # | Chantier | Priorité | Difficulté |
|---|---|---|---|
| 8 | Nettoyage code mort / libellés trompeurs | P0 | 🟢 |
| 9 | Coaching pré-écrit (banque de conseils génériques, sans LLM) | P1 | 🟢 |


### Premium uniquement
| # | Chantier | Priorité | Difficulté |
|---|---|---|---|
| 10-12 | **Migration OCR vers Gemini vision (1 appel, auto-détection totale)** | P0 | 🟡 |
| 13 | Voix de synthèse françaises premium (choix fournisseur + cache audio) | P1 | 🔴 |
| 14 | Espace metteur en scène avancé (revocalisation, synchro troupe) | P2 | 🔴 |
| 15 | Bruitages/effets sonores | P2 | 🟡 |
| 16 | Redéfinir le contrôle d'accès Premium (`is_premium` étendu) | P0 | 🟢 |


Souhaitez-vous que je consigne ce plan en todos structurés pour le suivi, ou qu'on démarre directement l'implémentation d'un chantier (par exemple #10-12 la migration OCR, ou #1 l'audio arrière-plan) ?

---

# Partie 2 — Résumé technique de fin de session

# Résumé technique : RépliCoach (fin de session)


## Architecture
- Front : React + Vite (PWA), déployé sur Vercel depuis `main`.
- Backend OCR : FastAPI sur Render, déployé depuis `main`.
- Base : nouveau projet Supabase (ancien bloqué par `exceed_storage_size_quota`).
- Authentification : Google. Ton e-mail effectif est `consulting@mauricelargeron.com`.


## Supabase
- Schéma complet exécuté : `supabase/full_schema.sql`, soit 23 tables, RLS et 4 buckets. **Ce fichier n'est pas commité.**
- Profil de `consulting@mauricelargeron.com` : `is_premium=true`, rôle `dev` dans `user_roles`.
- Variables Vercel mises à jour : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Les variables `VITE_*` sont figées au build.


## Accès et Premium
- L'accès à l'import dépend de la liste `ADMIN_EMAILS`, codée en dur dans `src/pages/Upload.jsx`, et non de `user_roles`. Tout nouvel utilisateur doit y être ajouté.
- Le Premium dépend de `profiles.is_premium`, lu par le backend avec le jeton de l'utilisateur.


## Scan Premium (Gemini)
- Le code est dans `backend-ocr/ocr/gemini_ocr.py`, l'endpoint SSE `/api/extract-premium` dans `backend-ocr/main.py`.
- Le PDF est découpé en tranches de 9 pages (`GEMINI_PAGES_PER_CHUNK`), traitées en parallèle, 6 appels au maximum (`GEMINI_MAX_PARALLEL`). La découpe utilise `pypdf`, ajouté à `requirements.txt`.
- La progression affichée est réelle (« n/6 parties terminées »).
- Résultats sur ton PDF : de 2 min 50 s à environ 45 s, avec 14 personnages et 917 répliques.
- `_merge_chunk_results` rattache à la réplique précédente toute première réplique `INCONNU` d'une tranche (hors la première) et retire les personnages sans réplique.
- Tests : 19 OK dans `backend-ocr/ocr/tests/test_gemini_ocr.py`.


## Interface
- Sous-titres des deux modes mis à jour : « Rapide et gratuit • Vous indiquez les personnages » pour Classique, « Personnages détectés automatiquement • PDF scannés acceptés • ~45 s » pour Premium.
- `hasNativeText` (`src/lib/pdfProcessor.js`) lit les 3 premières pages avec pdf.js (seuil de 200 caractères). Si le PDF a du texte natif, un message discret s'affiche pendant l'analyse Premium : « le Scan Classique (gratuit) suffit ». Rien n'est bloqué ni redirigé.
- Je n'ai pas testé ce message dans le navigateur, seulement le build Vite.


## Documentation
- `docs/FAQ.md` contient la comparaison Classique / Premium. Elle servira de base au futur menu Aide, qui remplacera le tutoriel en pop-up. Cette pop-up n'a pas été modifiée.


## Git
- Branche `feature/premium-paywall`, dernier commit `1cf0c08`.
- Commits de la session : `ddc331e` (e-mail admin), `e0de9ec` (parallèle), `20d1585` (correctif INCONNU), `1cf0c08` (libellés, texte natif, FAQ).
- Je n'ai pas confirmé la fusion de la PR dans `main`. Ton test de production a montré 14 personnages et plus d'« Inconnu », donc le correctif y est probablement déjà. Vérifie sur GitHub que la PR est fusionnée et que `main` contient `1cf0c08`.
- Les outils de création de PR ne fonctionnent pas ici (`gh` n'est pas installé). Il faut passer par : https://github.com/mlclarge/replicoach/compare/main...feature/premium-paywall.


## Environnement local
- Python 3.12, Windows, PowerShell sans `&&`. `pypdf` et `google-genai` sont installés.
- Les avertissements LF/CRLF de git donnent un code de sortie 1 sans erreur réelle.
- Piège : un remplacement de texte multiligne en PowerShell échoue avec les fins de ligne CRLF. Utiliser l'outil d'édition.


## Dette technique et pistes futures
1. Migrer `ADMIN_EMAILS` vers `user_roles`.
2. Limiter la taille des PDF stockés et les purger (cause du quota Supabase).
3. Fusionner ou répartir les personnages « groupes » (« TOUT LE MONDE », « SAM + NOLAN »), conservés tels quels aujourd'hui.
4. Commiter `supabase/full_schema.sql`.
5. Relancer le support Supabase pour l'ancien projet.
6. Redesign : menu Aide basé sur `docs/FAQ.md`, en remplacement de la pop-up de tutoriel.
7. Piste écartée : un modèle plus léger (gain faible à 45 s, risque sur les noms). Le routage strict vers Classique reste possible via `hasNativeText`.
8. Risque non observé : la limite de débit du quota gratuit de Gemini avec 6 appels simultanés.


## Mise à jour — 6 octobre, 16h29

### État local Git (non commité)
- Branche `feature/premium-paywall`, alignée avec `origin/feature/premium-paywall`.
- Fichiers suivis modifiés : `src/App.jsx`, `src/store/authStore.js`, `src/store/scriptStore.js`, `src/sw.js`, `vite.config.js`.
- Fichiers non suivis pertinents pour le code/déploiement : `src/lib/offlineDataCache.js` et `supabase/full_schema.sql`.
- Le présent résumé et `Audit_diag_plan V2 _ replicoach.txt` sont également non suivis.
- Le répertoire contient aussi des documents, PDF, images, exports et archives non suivis. Ne pas les inclure dans un commit sans sélection/validation explicite.
- Ces changements sont préexistants à la préparation du POC voix ; ne pas les écraser, réinitialiser ou inclure dans un commit lié au POC sans accord explicite.

### Voix de synthèse Premium — décision de cadrage
- Le POC d'écoute désigne Google Cloud Text-to-Speech comme fournisseur préféré ; le choix de production reste à confirmer après vérification des coûts, quotas et conditions d'utilisation.
- Objectifs à mesurer : qualité/naturel en français, stabilité des voix par personnage, latence, coût par script et faisabilité du cache audio.
- Accord donné pour tester des extraits de vrais scripts auprès des fournisseurs cloud ; le PDF sélectionné est `depit amoureux.pdf`.
- Fournisseurs retenus pour le comparatif : Google Cloud Text-to-Speech, Azure AI Speech et ElevenLabs.
- Banc d'essai local créé dans `scripts/tts-poc.mjs` ; protocole documenté dans `scripts/README-tts-poc.md`. OCR local effectué sur les 4 pages du PDF (confiance 87–91 %). Les quatre extraits ont été transmis à Google et Azure avec l'accord donné.
- Le JSON OCR complet se trouve dans le `%TEMP%` local sous `replicoach-tts-poc-ocr.json`, pour examen et choix des courts extraits. Il contient le texte reconnu du document et n'est pas supprimé automatiquement.
- Quatre courts extraits (2 voix féminines, 2 masculines; 189 caractères au total) ont été sélectionnés et préparés dans `%TEMP%\replicoach-tts-poc-samples.json`.
- Google Cloud TTS (Chirp 3 HD : Achird/Achernar) et Azure AI Speech (HenriNeural/DeniseNeural) ont chacun généré les quatre extraits. Après écoute, préférence utilisateur pour Google (« google est le meilleur »).
- Latences de génération initiales : Google 417–621 ms ; Azure 192–424 ms. Les générations abouties sont conservées en cache local. Une relance a confirmé les hits de cache, sans nouvelle facturation.
- Les audios prêts à écouter sont dans `%LOCALAPPDATA%\Replicoach\tts-poc\listen`; métadonnées sans extrait de texte dans `%LOCALAPPDATA%\Replicoach\tts-poc\results.json`.
- Après mise à jour locale de la clé ElevenLabs et activation de `voices_read`, le catalogue est accessible. Le compte expose 3 voix françaises, toutes masculines et classées « professional », aucune féminine. La génération d'une voix de bibliothèque a renvoyé HTTP 402 : le compte gratuit ne peut pas utiliser ces voix de bibliothèque via l'API. Pas d'audio ElevenLabs généré.
- Pour compléter le comparatif ElevenLabs, il faut un abonnement autorisant la synthèse API de voix de bibliothèque ainsi que l'accès à une voix féminine française ; vérifier le coût avant toute mise à niveau.
- Les tarifs/coûts par script, quotas de génération et conditions de conservation/utilisation des textes par fournisseur restent à vérifier avant de décider la mise en production de Google.
- Après POC : `scripts/tts-poc.mjs` conserve les mesures de latence dans les métadonnées du cache et produit des copies d'écoute nommées par fournisseur/sample.
