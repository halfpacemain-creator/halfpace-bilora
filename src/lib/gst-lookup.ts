import { INDIAN_STATES } from "./india";

// Modular GST lookup service.
// Providers can be swapped without touching the UI — see registerGstProvider.

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function isValidGstinFormat(g: string): boolean {
  return GSTIN_REGEX.test((g ?? "").toUpperCase().trim());
}

export interface GstLookupResult {
  legal_name?: string;
  trade_name?: string;
  pan?: string;
  constitution?: string;
  registration_type?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  district?: string;
  state?: string;
  state_code?: string;
  pincode?: string;
  date_of_registration?: string;
  /** Where the data came from, surfaced in the UI. */
  source: "derived" | "official" | "third-party";
}

export interface GstLookupProvider {
  name: string;
  lookup(gstin: string): Promise<GstLookupResult | null>;
}

/**
 * Local provider — derives the state and PAN from the GSTIN itself.
 * Always available, zero cost, no network call.
 */
const localProvider: GstLookupProvider = {
  name: "local-derive",
  async lookup(gstin: string) {
    const g = gstin.toUpperCase().trim();
    if (!isValidGstinFormat(g)) return null;
    const stateCode = g.slice(0, 2);
    const pan = g.slice(2, 12);
    const state = INDIAN_STATES.find((s) => s.code === stateCode);
    return {
      pan,
      state: state?.name,
      state_code: stateCode,
      source: "derived",
    };
  },
};

let providers: GstLookupProvider[] = [localProvider];

/**
 * Register an upstream provider (official GSTN, third-party API, etc.).
 * Registered providers run BEFORE the local fallback and may return richer
 * data such as legal name, trade name, and address.
 */
export function registerGstProvider(p: GstLookupProvider) {
  providers = [p, ...providers.filter((x) => x.name !== p.name)];
}

const cache = new Map<string, GstLookupResult>();

export async function lookupGstin(gstin: string): Promise<GstLookupResult | null> {
  const g = gstin.toUpperCase().trim();
  if (!isValidGstinFormat(g)) return null;
  const cached = cache.get(g);
  if (cached) return cached;
  for (const p of providers) {
    try {
      const r = await p.lookup(g);
      if (r) {
        cache.set(g, r);
        return r;
      }
    } catch {
      // try next provider
    }
  }
  return null;
}