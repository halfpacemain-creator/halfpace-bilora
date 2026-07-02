// Invoice theme tokens — drive both on-screen preview and PDF render.
// No component should hardcode a colour or font; pull from this map.

export type InvoiceThemeKey =
  | "modern-blue"
  | "corporate-black"
  | "premium-gold"
  | "minimal-white";

export interface InvoiceTheme {
  key: InvoiceThemeKey;
  label: string;
  // High-contrast accent used for the heading band, totals, links
  accent: string;
  accentForeground: string;
  // Soft background used for "Bill to" / "Place of supply" boxes
  surface: string;
  // Ink / body text
  ink: string;
  muted: string;
  border: string;
  // Font stacks (web-safe so they work in @react-pdf/renderer too)
  fontHeading: string;
  fontBody: string;
  // Visual treatment hints
  headerStyle: "band" | "ribbon" | "minimal";
  // Sample swatch preview (3 dots in settings picker)
  swatches: [string, string, string];
}

export const INVOICE_THEMES: Record<InvoiceThemeKey, InvoiceTheme> = {
  "modern-blue": {
    key: "modern-blue",
    label: "Modern Blue",
    accent: "#3b5bdb",
    accentForeground: "#ffffff",
    surface: "#f5f8ff",
    ink: "#0f172a",
    muted: "#64748b",
    border: "#e2e8f0",
    fontHeading: "Helvetica",
    fontBody: "Helvetica",
    headerStyle: "band",
    swatches: ["#3b5bdb", "#dde6ff", "#0f172a"],
  },
  "corporate-black": {
    key: "corporate-black",
    label: "Corporate Black",
    accent: "#0f172a",
    accentForeground: "#ffffff",
    surface: "#f5f5f5",
    ink: "#111111",
    muted: "#555555",
    border: "#d4d4d4",
    fontHeading: "Times-Roman",
    fontBody: "Helvetica",
    headerStyle: "ribbon",
    swatches: ["#0f172a", "#cccccc", "#ffffff"],
  },
  "premium-gold": {
    key: "premium-gold",
    label: "Premium Gold",
    accent: "#a67c00",
    accentForeground: "#1a1206",
    surface: "#fbf7ec",
    ink: "#2b1d09",
    muted: "#7a6948",
    border: "#e6d8b3",
    fontHeading: "Times-Roman",
    fontBody: "Times-Roman",
    headerStyle: "ribbon",
    swatches: ["#a67c00", "#f3e5b8", "#2b1d09"],
  },
  "minimal-white": {
    key: "minimal-white",
    label: "Minimal White",
    accent: "#111111",
    accentForeground: "#ffffff",
    surface: "#ffffff",
    ink: "#111111",
    muted: "#737373",
    border: "#e5e5e5",
    fontHeading: "Helvetica",
    fontBody: "Helvetica",
    headerStyle: "minimal",
    swatches: ["#111111", "#ffffff", "#e5e5e5"],
  },
};

export const DEFAULT_THEME: InvoiceThemeKey = "modern-blue";

export const themeFor = (key: string | null | undefined): InvoiceTheme =>
  INVOICE_THEMES[(key as InvoiceThemeKey) ?? DEFAULT_THEME] ?? INVOICE_THEMES[DEFAULT_THEME];

export const THEME_LIST = Object.values(INVOICE_THEMES);