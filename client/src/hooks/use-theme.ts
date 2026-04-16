import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ThemeColor = "zinc" | "rose" | "blue" | "green" | "orange";

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem("theme-mode") as ThemeMode) || "system";
  });
  
  const [color, setColor] = useState<ThemeColor>(() => {
    return (localStorage.getItem("theme-color") as ThemeColor) || "blue";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    
    // Process Mode
    if (mode === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(mode);
    }
    
    // Process Color
    root.classList.remove("theme-zinc", "theme-rose", "theme-blue", "theme-green", "theme-orange");
    root.classList.add(`theme-${color}`);
    
    localStorage.setItem("theme-mode", mode);
    localStorage.setItem("theme-color", color);
  }, [mode, color]);

  return { mode, setMode, color, setColor };
}
