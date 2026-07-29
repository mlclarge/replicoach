/**
 * Filtre les répliques pour n'isoler que les scènes où le comédien
 * interagit avec les partenaires sélectionnés.
 */
export const filterScenesByCharacterIds = (
  allReplicas,
  myCharacterId,
  partnerIds,
) => {
  if (!partnerIds || partnerIds.length === 0) return allReplicas;

  let blocks = [];
  let currentBlock = [];
  let currentCharacterIdsInBlock = new Set();

  allReplicas.forEach((replica, index) => {
    currentBlock.push(replica);

    if (replica.character_id) {
      currentCharacterIdsInBlock.add(replica.character_id);
    }

    // On cherche un indicateur de changement de scène dans le texte
    const textUpper = replica.text ? replica.text.toUpperCase() : "";
    const isSceneChange =
      textUpper.includes("SCÈNE ") ||
      textUpper.includes("SCENE ") ||
      textUpper.includes("ACTE ");

    // On clôture le bloc si c'est une nouvelle scène OU si c'est la fin du script
    if (isSceneChange || index === allReplicas.length - 1) {
      const hasMyRole = currentCharacterIdsInBlock.has(myCharacterId);
      const hasPartner = partnerIds.some((id) =>
        currentCharacterIdsInBlock.has(id),
      );

      // Si le comédien ET au moins un partenaire ciblé sont dans ce bloc
      if (hasMyRole && hasPartner) {
        // On ajoute un séparateur visuel (sauf s'il s'agit du tout premier bloc inséré)
        if (blocks.length > 0) {
          blocks.push({
            id: `divider-${index}`,
            type: "divider",
            text: "Scène suivante",
          });
        }
        blocks = [...blocks, ...currentBlock];
      }

      // On réinitialise pour analyser le bloc suivant
      currentBlock = [];
      currentCharacterIdsInBlock = new Set();
    }
  });

  return blocks;
};
