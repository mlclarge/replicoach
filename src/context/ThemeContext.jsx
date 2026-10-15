import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export const THEMES = {
  DARK: "dark",
  PAPER: "paper",
  LIGHT: "light",
};

const THEME_CSS = `
/* =====================================================
   RÉPLICOACH THEMES CSS (SÉPIA PARCHEMIN & CLAIR DAYLIGHT)
   ===================================================== */

/* 1. THÈME PARCHEMIN SÉPIA (Livret de théâtre traditionnel) */
html.theme-paper,
html.theme-paper body,
body.theme-paper {
  background-color: #f2e7ce !important;
  color: #2b1d0f !important;
}

.theme-paper .bg-darker,
.theme-paper .bg-gray-950,
.theme-paper .bg-black {
  background-color: #f2e7ce !important;
  color: #2b1d0f !important;
}

.theme-paper .bg-gray-900,
.theme-paper .bg-gray-900\/95,
.theme-paper .bg-gray-900\/90,
.theme-paper .bg-gray-900\/80,
.theme-paper .bg-gray-900\/60,
.theme-paper .bg-gray-900\/50,
.theme-paper .bg-gray-900\/40 {
  background-color: #ebd8b0 !important;
  color: #2b1d0f !important;
}

.theme-paper .bg-gray-800,
.theme-paper .bg-gray-800\/90,
.theme-paper .bg-gray-800\/80,
.theme-paper .bg-gray-800\/60,
.theme-paper .bg-gray-800\/50,
.theme-paper .bg-gray-800\/40 {
  background-color: #dfcb9e !important;
  color: #2b1d0f !important;
}

.theme-paper .bg-gray-950\/95,
.theme-paper .bg-gray-950\/90 {
  background-color: #e5d3aa !important;
  color: #2b1d0f !important;
}

/* Textes sur conteneurs Parchemin Sépia */
.theme-paper .text-white,
.theme-paper .text-gray-100,
.theme-paper .text-gray-200,
.theme-paper .text-gray-300 {
  color: #2b1d0f !important;
}

.theme-paper .text-gray-400,
.theme-paper .text-gray-500 {
  color: #5e452e !important;
}

.theme-paper .text-amber-100,
.theme-paper .text-amber-200,
.theme-paper .text-amber-300,
.theme-paper .text-amber-400 {
  color: #78350f !important;
}

.theme-paper .text-purple-100,
.theme-paper .text-purple-200,
.theme-paper .text-purple-300,
.theme-paper .text-purple-400 {
  color: #581c87 !important;
}

.theme-paper .text-yellow-300,
.theme-paper .text-yellow-400 {
  color: #78350f !important;
}

.theme-paper .border-gray-800,
.theme-paper .border-gray-700,
.theme-paper .border-gray-600 {
  border-color: #c2a672 !important;
}


/* 2. THÈME CLAIR DAYLIGHT */
html.theme-light,
html.theme-light body,
body.theme-light {
  background-color: #f8fafc !important;
  color: #0f172a !important;
}

.theme-light .bg-darker,
.theme-light .bg-gray-950,
.theme-light .bg-black {
  background-color: #f8fafc !important;
  color: #0f172a !important;
}

.theme-light .bg-gray-900,
.theme-light .bg-gray-900\/95,
.theme-light .bg-gray-900\/90,
.theme-light .bg-gray-900\/80,
.theme-light .bg-gray-900\/60,
.theme-light .bg-gray-900\/50,
.theme-light .bg-gray-900\/40 {
  background-color: #ffffff !important;
  color: #0f172a !important;
}

.theme-light .bg-gray-800,
.theme-light .bg-gray-800\/90,
.theme-light .bg-gray-800\/80,
.theme-light .bg-gray-800\/60,
.theme-light .bg-gray-800\/50,
.theme-light .bg-gray-800\/40 {
  background-color: #f1f5f9 !important;
  color: #0f172a !important;
}

.theme-light .bg-gray-950\/95,
.theme-light .bg-gray-950\/90 {
  background-color: #f8fafc !important;
  color: #0f172a !important;
}

/* Textes sur conteneurs Clair Daylight */
.theme-light .text-white,
.theme-light .text-gray-100,
.theme-light .text-gray-200,
.theme-light .text-gray-300 {
  color: #0f172a !important;
}

.theme-light .text-gray-400,
.theme-light .text-gray-500 {
  color: #475569 !important;
}

.theme-light .text-amber-100,
.theme-light .text-amber-200,
.theme-light .text-amber-300,
.theme-light .text-amber-400 {
  color: #92400e !important;
}

.theme-light .text-purple-100,
.theme-light .text-purple-200,
.theme-light .text-purple-300,
.theme-light .text-purple-400 {
  color: #6b21a8 !important;
}

.theme-light .text-yellow-300,
.theme-light .text-yellow-400 {
  color: #854d0e !important;
}

.theme-light .border-gray-800,
.theme-light .border-gray-700,
.theme-light .border-gray-600 {
  border-color: #cbd5e1 !important;
}


/* =====================================================
   PROTECTIONS (Boutons sombres, Header, Répliques)
   ===================================================== */

header,
header h1,
header p,
header span,
header a,
.theme-paper header,
.theme-paper header h1,
.theme-paper header p,
.theme-paper header span,
.theme-paper header a,
.theme-light header,
.theme-light header h1,
.theme-light header p,
.theme-light header span,
.theme-light header a {
  color: #ffffff !important;
}

header p.text-gold-400,
.theme-paper header p.text-gold-400,
.theme-light header p.text-gold-400 {
  color: #fbbf24 !important;
}

/* Bulles de répliques : texte reste blanc lumineux sur fonds colorés de personnages */
.theme-paper [class*="rounded-2xl"][style*="background"],
.theme-light [class*="rounded-2xl"][style*="background"],
.theme-paper [class*="rounded-2xl"][style*="background"] *,
.theme-light [class*="rounded-2xl"][style*="background"] * {
  color: #ffffff !important;
}

/* Boutons sombres, CTA et badges colorés */
.theme-paper .btn-primary,
.theme-light .btn-primary,
.theme-paper .bg-purple-600,
.theme-light .bg-purple-600,
.theme-paper .bg-purple-700,
.theme-light .bg-purple-700,
.theme-paper .bg-purple-900,
.theme-light .bg-purple-900,
.theme-paper .bg-primary-600,
.theme-light .bg-primary-600,
.theme-paper .bg-primary-700,
.theme-light .bg-primary-700,
.theme-paper .bg-primary-800,
.theme-light .bg-primary-800,
.theme-paper .bg-primary-900,
.theme-light .bg-primary-900,
.theme-paper .bg-blue-600,
.theme-light .bg-blue-600,
.theme-paper .bg-rose-600,
.theme-light .bg-rose-600,
.theme-paper .bg-emerald-600,
.theme-light .bg-emerald-600 {
  color: #ffffff !important;
}

.theme-paper .btn-primary *,
.theme-light .btn-primary *,
.theme-paper .bg-purple-600 *,
.theme-light .bg-purple-600 *,
.theme-paper .bg-purple-700 *,
.theme-light .bg-purple-700 *,
.theme-paper .bg-primary-600 *,
.theme-light .bg-primary-600 *,
.theme-paper .bg-primary-700 *,
.theme-light .bg-primary-700 *,
.theme-paper .bg-blue-600 *,
.theme-light .bg-blue-600 *,
.theme-paper .bg-rose-600 *,
.theme-light .bg-rose-600 *,
.theme-paper .bg-emerald-600 *,
.theme-light .bg-emerald-600 * {
  color: #ffffff !important;
}

/* Boutons Or / Ambre -> texte foncé contrasté */
.theme-paper .bg-amber-500,
.theme-light .bg-amber-500,
.theme-paper .bg-gold-500,
.theme-light .bg-gold-500,
.theme-paper .btn-gold,
.theme-light .btn-gold {
  color: #0f172a !important;
}

.theme-paper .text-amber-300,
.theme-light .text-amber-300,
.theme-paper .text-amber-400,
.theme-light .text-amber-400 {
  color: #b45309 !important;
}

.theme-paper .text-purple-300,
.theme-light .text-purple-300,
.theme-paper .text-purple-400,
.theme-light .text-purple-400 {
  color: #7e22ce !important;
}
`;

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("replicoach-theme") || THEMES.DARK;
    } catch {
      return THEMES.DARK;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-dark", "theme-paper", "theme-light", "dark");

    if (theme === THEMES.PAPER) {
      root.classList.add("theme-paper");
    } else if (theme === THEMES.LIGHT) {
      root.classList.add("theme-light");
    } else {
      root.classList.add("theme-dark", "dark");
    }

    try {
      localStorage.setItem("replicoach-theme", theme);
    } catch (e) {
      console.warn("localStorage non accessible", e);
    }

    let styleEl = document.getElementById("replicoach-theme-styles");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "replicoach-theme-styles";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = THEME_CSS;
  }, [theme]);

  const cycleTheme = () => {
    if (theme === THEMES.DARK) setTheme(THEMES.PAPER);
    else if (theme === THEMES.PAPER) setTheme(THEMES.LIGHT);
    else setTheme(THEMES.DARK);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme, THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: THEMES.DARK,
      setTheme: () => {},
      cycleTheme: () => {},
      THEMES,
    };
  }
  return context;
}
