// Validated default palette (dataviz skill) — hex values used directly as
// Recharts fill/stroke colors, keyed by light/dark mode.

export const categorical = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
};

export const sequentialBlue = {
  light: ["#cde2fb", "#9ec5f4", "#5598e7", "#2a78d6", "#184f95"],
  dark: ["#cde2fb", "#9ec5f4", "#5598e7", "#3987e5", "#184f95"],
};

export const status = {
  good: { light: "#0ca30c", dark: "#0ca30c" },
  warning: { light: "#fab219", dark: "#fab219" },
  serious: { light: "#ec835a", dark: "#ec835a" },
  critical: { light: "#d03b3b", dark: "#d03b3b" },
};

export const chrome = {
  light: {
    surface: "#fcfcfb",
    page: "#f9f9f7",
    ink: "#0b0b0b",
    inkSecondary: "#52514e",
    inkMuted: "#898781",
    gridline: "#e1e0d9",
    baseline: "#c3c2b7",
    border: "rgba(11,11,11,0.10)",
  },
  dark: {
    surface: "#1a1a19",
    page: "#0d0d0d",
    ink: "#ffffff",
    inkSecondary: "#c3c2b7",
    inkMuted: "#898781",
    gridline: "#2c2c2a",
    baseline: "#383835",
    border: "rgba(255,255,255,0.10)",
  },
};

export type Mode = "light" | "dark";
