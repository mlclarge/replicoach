import { useState, useEffect } from 'react';

/**
 * Hook pour gérer le contexte des répliques (affichage des répliques précédentes)
 * Utilisé en mode lecture avec filtres exercices
 */
export const useReplicaContext = (replicas, currentReplicaIndex, contextSize = 1) => {
  const [contextReplicas, setContextReplicas] = useState([]);

  useEffect(() => {
    if (!replicas || replicas.length === 0 || currentReplicaIndex === undefined) {
      setContextReplicas([]);
      return;
    }

    // Récupérer les répliques qui précèdent l'actuelle
    const startIndex = Math.max(0, currentReplicaIndex - contextSize);
    const context = replicas.slice(startIndex, currentReplicaIndex);
    
    setContextReplicas(context);
  }, [replicas, currentReplicaIndex, contextSize]);

  return {
    contextReplicas,
    hasContext: contextReplicas.length > 0,
    contextSize: contextReplicas.length,
  };
};

export default useReplicaContext;
