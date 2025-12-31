import { create } from "zustand";
import { supabase } from "../lib/supabase";

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    // Éviter les initialisations multiples
    if (get().initialized) {
      return;
    }

    try {
      // 1. Récupérer la session existante
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("Session error:", sessionError);
      }

      set({ 
        user: session?.user || null, 
        loading: false,
        initialized: true 
      });

      // 2. Configurer le listener pour les changements d'état
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          console.log("Auth state changed:", event);
          
          switch (event) {
            case 'SIGNED_IN':
              set({ user: session?.user || null });
              break;
            
            case 'SIGNED_OUT':
              set({ user: null });
              break;
            
            case 'TOKEN_REFRESHED':
              // Session rafraîchie automatiquement
              set({ user: session?.user || null });
              break;
            
            case 'USER_UPDATED':
              set({ user: session?.user || null });
              break;

            case 'INITIAL_SESSION':
              // Session initiale chargée
              set({ user: session?.user || null });
              break;

            default:
              // Pour tous les autres événements
              set({ user: session?.user || null });
          }
        }
      );

      // 3. Vérifier périodiquement que la session est valide (toutes les 5 min)
      const checkSession = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session && get().user) {
            // Session expirée, essayer de rafraîchir
            const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
            if (!refreshedSession) {
              set({ user: null });
            }
          }
        } catch (error) {
          console.error("Session check error:", error);
        }
      };

      // Vérifier la session toutes les 5 minutes
      const intervalId = setInterval(checkSession, 5 * 60 * 1000);

      // Vérifier aussi quand l'onglet redevient visible
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          checkSession();
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Vérifier quand on revient online
      const handleOnline = () => {
        checkSession();
      };
      window.addEventListener('online', handleOnline);

      // Cleanup function (pour React StrictMode)
      return () => {
        subscription?.unsubscribe();
        clearInterval(intervalId);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('online', handleOnline);
      };

    } catch (error) {
      console.error("Auth init error:", error);
      set({ user: null, loading: false, initialized: true });
    }
  },

  // Rafraîchir manuellement la session
  refreshSession: async () => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error("Refresh session error:", error);
        return { error };
      }
      set({ user: session?.user || null });
      return { data: session };
    } catch (error) {
      console.error("Refresh session exception:", error);
      return { error };
    }
  },

  signIn: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      set({ user: data.user });
      return { data };
    } catch (error) {
      console.error("Sign in error:", error);
      return { error };
    }
  },

  signUp: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        console.error("Sign up error:", error);
        return { error };
      }

      return { data };
    } catch (error) {
      console.error("Sign up exception:", error);
      return { error };
    }
  },

  signInWithGoogle: async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) {
        console.error("Google sign in error:", error);
        return { error };
      }

      return { data };
    } catch (error) {
      console.error("Google sign in exception:", error);
      return { error };
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
      set({ user: null });
    } catch (error) {
      console.error("Sign out error:", error);
    }
  },

  // Réinitialiser le store (utile pour les tests ou le logout forcé)
  reset: () => {
    set({ user: null, loading: false, initialized: false });
  },
}));
