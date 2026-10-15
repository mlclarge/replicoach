import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export const THEMES = {
  DARK: "dark",
};

export function ThemeProvider({ children }) {
  const [theme] = useState(THEMES.DARK);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-paper", "theme-light");
    root.classList.add("theme-dark", "dark");
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: THEMES.DARK,
      THEMES,
    };
  }
  return context;
}
