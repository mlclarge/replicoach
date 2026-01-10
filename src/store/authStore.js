import { create } from "zustand";
import { supabase } from "../lib/supabase";

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    // Éviter double initialisation
    if (get().initialized) return;
    set({ initialized: true });

    try {
      // Récupérer la session existante
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        set({ user: session.user, loading: false });
      } else {
        set({ user: null, loading: false });
      }

      // Écouter les changements d'état d'authentification
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        console.log("Auth state changed:", event);

        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          set({ user: session?.user || null, loading: false });
        } else if (event === "SIGNED_OUT") {
          set({ user: null, loading: false });
        } else if (event === "INITIAL_SESSION") {
          set({ user: session?.user || null, loading: false });
        }
      });

      // Vérifier la session périodiquement (toutes les 5 minutes)
      const sessionCheckInterval = setInterval(async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          // Rafraîchir le token si nécessaire
          const { data, error } = await supabase.auth.refreshSession();
          if (error) {
            console.error("Session refresh error:", error);
          } else if (data.session) {
            // Ne mettre à jour que si l'utilisateur a changé
            const currentUser = get().user;
            if (!currentUser || currentUser.id !== data.session.user.id) {
              set({ user: data.session.user });
            }
          }
        }
      }, 5 * 60 * 1000); // 5 minutes

      // Rafraîchir la session quand l'onglet redevient visible (mais pas trop souvent)
      let lastVisibilityCheck = Date.now();
      const handleVisibilityChange = async () => {
        if (document.visibilityState === "visible") {
          // Éviter de rafraîchir trop souvent (max 1 fois par minute)
          if (Date.now() - lastVisibilityCheck < 60000) return;
          lastVisibilityCheck = Date.now();

          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user) {
            const { data, error } = await supabase.auth.refreshSession();
            if (!error && data.session) {
              set({ user: data.session.user });
            }
          }
        }
      };

      document.addEventListener("visibilitychange", handleVisibilityChange);

      // Rafraîchir quand on revient en ligne
      const handleOnline = async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          const { data, error } = await supabase.auth.refreshSession();
          if (!error && data.session) {
            set({ user: data.session.user });
          }
        }
      };

      window.addEventListener("online", handleOnline);

      // Cleanup function
      return () => {
        subscription?.unsubscribe();
        clearInterval(sessionCheckInterval);
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange
        );
        window.removeEventListener("online", handleOnline);
      };
    } catch (error) {
      console.error("Auth initialization error:", error);
      set({ user: null, loading: false });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      set({ loading: false });
      return { error };
    }

    set({ user: data.user, loading: false });
    return { data };
  },

  signUp: async (email, password) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    set({ loading: false });
    if (error) return { error };
    return { data };
  },

  signInWithGoogle: async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { data, error };
  },

  signOut: async () => {
    set({ loading: true });
    await supabase.auth.signOut();
    set({ user: null, loading: false });
  },

  refreshSession: async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) {
      set({ user: data.session.user });
    }
    return { data, error };
  },
}));
