// Single source of truth for product branding.
// Anywhere you'd write "Bilora" or "HalfPace Bilora", import from here instead.
export const BRAND = {
  name: "HalfPace Bilora",
  short: "Bilora",
  tagline: "Free forever GST billing.",
  description:
    "HalfPace Bilora is a 100% free Indian GST billing platform — automatic CGST/SGST/IGST, premium PDF exports, UPI QR payments and e-Way Bill prep. No subscriptions, no premium plans, no feature limits, ever.",
} as const;

export const pageTitle = (label: string) => `${label} · ${BRAND.name}`;