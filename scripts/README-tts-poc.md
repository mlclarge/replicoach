# POC voix de synthèse Premium

Ce banc d'essai compare Google Cloud Text-to-Speech, Azure AI Speech et ElevenLabs avec des extraits sélectionnés d'un script. Il ne modifie pas le lecteur audio de l'application.

## 1. Extraire le texte localement

Depuis la racine du dépôt, lancer l'OCR du PDF choisi :

```powershell
node scripts/tts-poc.mjs --ocr "depit amoureux.pdf" --output "$env:TEMP\replicoach-tts-poc-ocr.json"
```

L'OCR français est exécuté localement avec Tesseract.js. Le modèle linguistique peut être téléchargé au premier lancement ; le PDF et le texte reconnu ne sont pas transmis à un service OCR distant.
Le JSON OCR contient le texte reconnu du document entier : il reste dans `%TEMP%` pour permettre la sélection et n'est pas nettoyé automatiquement.

Relire le fichier JSON OCR, choisir jusqu'à six passages courts (500 caractères maximum chacun), puis créer manuellement un fichier d'échantillons, par exemple dans `%TEMP%` :

```json
{
  "samples": [
    {
      "id": "replique-feminine-1",
      "gender": "FEMALE",
      "text": "Texte du passage choisi."
    },
    {
      "id": "replique-masculine-1",
      "gender": "MALE",
      "text": "Texte d'un autre passage choisi."
    }
  ]
}
```

Ne pas mettre le texte du script dans un fichier suivi par Git. Les extraits seront envoyés aux trois fournisseurs lors de l'étape de génération.

## 2. Configurer les accès localement

Ajouter ces entrées dans le fichier `.env.local` à la racine, qui est ignoré par Git :

```dotenv
GOOGLE_TTS_API_KEY=
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=
ELEVENLABS_API_KEY=
```

La clé Google doit avoir accès à l'API Cloud Text-to-Speech. Le compte ElevenLabs doit exposer des voix françaises homme et femme via l'API et l'abonnement doit autoriser la génération API à partir de voix de la bibliothèque. Les clés restent locales ; ne pas les coller dans le chat ni les ajouter à un fichier versionné.
Pour ElevenLabs, utiliser la valeur secrète complète de la clé API, qui commence par `sk_`, et non l'identifiant de clé affiché dans la liste. La clé secrète est un secret ; si elle n'est plus visible, créer une nouvelle clé depuis les [paramètres des clés API](https://elevenlabs.io/app/settings/api-keys) et la copier immédiatement dans `.env.local`.

## 3. Générer les échantillons

```powershell
node scripts/tts-poc.mjs --run "$env:TEMP\replicoach-tts-poc-samples.json"
```

Le script choisit automatiquement une voix française par genre dans chaque catalogue, puis génère les MP3 séquentiellement. Les fichiers audio sont conservés dans `%LOCALAPPDATA%\Replicoach\tts-poc\audio-cache`; les résultats ne contiennent que le fournisseur, la voix, l'identifiant du sample, le nombre de caractères, la latence et la taille audio. Le texte n'est ni affiché ni enregistré dans les résultats.
Des copies pour l'écoute sont placées dans `%LOCALAPPDATA%\Replicoach\tts-poc\listen`, avec des noms explicites par fournisseur et sample ; les chemins figurent aussi dans le JSON de résultats.

Relancer la commande permet de vérifier les hits du cache local sans nouvel appel payant. Pour comparer à nouveau avec d'autres voix ou paramètres, vider uniquement le répertoire `audio-cache` après avoir écouté/téléchargé les résultats utiles.

## Limites du POC

- Les latences mesurées incluent le réseau et peuvent varier ; lancer le test sur le même réseau, puis le répéter pour comparer.
- Le premier passage explore les voix cataloguées et ne couvre pas les coûts fixes, les quotas, les conditions de conservation des données ni les droits commerciaux. Vérifier les conditions et tarifs en vigueur avant toute décision produit.
- Un compte ElevenLabs gratuit peut lister des voix sans avoir le droit de les utiliser en synthèse API ; l'API peut refuser la génération HTTP 402. Aucune voix féminine française n'est garantie dans le catalogue d'un compte.
- Le cache est strictement local à ce POC. Il ne constitue pas le mécanisme de cache partagé/authentifié qui sera nécessaire en production.
