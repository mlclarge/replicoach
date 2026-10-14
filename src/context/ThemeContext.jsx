import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export const THEMES = {
  DARK: "dark",
  PAPER: "paper",
  LIGHT: "light",
};

const THEME_CSS = `
/* =====================================================
   RÉPLICOACH THEMES CSS (PAPIER SÉPIA & CLAIR DAYLIGHT)
   ===================================================== */

/* 1. THÈME PAPIER SÉPIA (Livret de théâtre traditionnel) */
html.theme-paper,
html.theme-paper body,
body.theme-paper {
  background-color: #f7f3e6 !important;
  color: #241c14 !important;
}

.theme-paper .bg-darker,
.theme-paper .bg-gray-950 {
  background-color: #f7f3e6 !important;
  color: #241c14 !important;
}

.theme-paper .bg-gray-900,
.theme-paper .bg-gray-900\/95,
.theme-paper .bg-gray-900\/90,
.theme-paper .bg-gray-900\/80,
.theme-paper .bg-gray-900\/60,
.theme-paper .bg-gray-900\/50 {
  background-color: #ebdcb9 !important;
  color: #241c14 !important;
}

.theme-paper .bg-gray-800,
.theme-paper .bg-gray-800\/90,
.theme-paper .bg-gray-800\/80,
.theme-paper .bg-gray-800\/60,
.theme-paper .bg-gray-800\/40 {
  background-color: #e0cea8 !important;
  color: #241c14 !important;
}

.theme-paper .text-white,
.theme-paper .text-gray-100,
.theme-paper .text-gray-200,
.theme-paper .text-gray-300 {
  color: #241c14 !important;
}

.theme-paper .text-gray-400,
.theme-paper .text-gray-500 {
  color: #5c4d3c !important;
}

.theme-paper .border-gray-800,
.theme-paper .border-gray-700,
.theme-paper .border-gray-600 {
  border-color: #caa775 !important;
}

.theme-paper .bg-gray-950\/95,
.theme-paper .bg-gray-950\/90 {
  background-color: #f0e2be !important;
}

/* 2. THÈME CLAIR DAYLIGHT */
html.theme-light,
html.theme-light body,
body.theme-light {
  background-color: #f8fafc !important;
  color: #0f172a !important;
}

.theme-light .bg-darker,
.theme-light .bg-gray-950 {
  background-color: #f8fafc !important;
  color: #0f172a !important;
}

.theme-light .bg-gray-900,
.theme-light .bg-gray-900\/95,
.theme-light .bg-gray-900\/90,
.theme-light .bg-gray-900\/80,
.theme-light .bg-gray-900\/60,
.theme-light .bg-gray-900\/50 {
  background-color: #ffffff !important;
  color: #0f172a !important;
}

.theme-light .bg-gray-800,
.theme-light .bg-gray-800\/90,
.theme-light .bg-gray-800\/80,
.theme-light .bg-gray-800\/60,
.theme-light .bg-gray-800\/40 {
  background-color: #f1f5f9 !important;
  color: #0f172a !important;
}

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

.theme-light .border-gray-800,
.theme-light .border-gray-700,
.theme-light .border-gray-600 {
  border-color: #cbd5e1 !important;
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
