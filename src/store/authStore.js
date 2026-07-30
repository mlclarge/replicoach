import { create } from "zustand";
import { supabase } from "../lib/supabase";

// Nouvelle fonction utilitaire pour récupérer le profil Premium
const fetchProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("is_premium")
      .eq("id", userId)
      .single();

    if (error && error.code !== "PGRST116")
      console.error("Erreur profil:", error);
    return data;
  } catch (err) {
    return null;
  }
};

export const useAuthStore = create((set, get) => ({
  user: null,
  isPremium: false, // Nouvel état
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
        const profile = await fetchProfile(session.user.id);
        set({
          user: session.user,
          isPremium: profile?.is_premium || false,
          loading: false,
        });
      } else {
        set({ user: null, isPremium: false, loading: false });
      }

      // Écouter les changements d'état d'authentification
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("Auth state changed:", event);

        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "INITIAL_SESSION"
        ) {
          if (session?.user) {
            const profile = await fetchProfile(session.user.id);
            set({
              user: session.user,
              isPremium: profile?.is_premium || false,
              loading: false,
            });
          }
        } else if (event === "SIGNED_OUT") {
          set({ user: null, isPremium: false, loading: false });
        }
      });

      // Vérifier la session périodiquement (toutes les 5 minutes)
      const sessionCheckInterval = setInterval(
        async () => {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user) {
            const { data, error } = await supabase.auth.refreshSession();
            if (error) {
              console.error("Session refresh error:", error);
            } else if (data.session) {
              const currentUser = get().user;
              if (!currentUser || currentUser.id !== data.session.user.id) {
                const profile = await fetchProfile(data.session.user.id);
                set({
                  user: data.session.user,
                  isPremium: profile?.is_premium || false,
                });
              }
            }
          }
        },
        5 * 60 * 1000,
      );

      // Rafraîchir la session quand l'onglet redevient visible
      let lastVisibilityCheck = Date.now();
      const handleVisibilityChange = async () => {
        if (document.visibilityState === "visible") {
          if (Date.now() - lastVisibilityCheck < 60000) return;
          lastVisibilityCheck = Date.now();

          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.user) {
            const { data, error } = await supabase.auth.refreshSession();
            if (!error && data.session) {
              // Pas besoin de refetch le profil ici, on rafraîchit juste le token
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
          handleVisibilityChange,
        );
        window.removeEventListener("online", handleOnline);
      };
    } catch (error) {
      console.error("Auth initialization error:", error);
      set({ user: null, isPremium: false, loading: false });
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

    const profile = await fetchProfile(data.user.id);
    set({
      user: data.user,
      isPremium: profile?.is_premium || false,
      loading: false,
    });
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
    set({ user: null, isPremium: false, loading: false });
  },

  refreshSession: async () => {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) {
      set({ user: data.session.user });
    }
    return { data, error };
  },
}));
