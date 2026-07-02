import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Company {
  id: string;
  owner_id: string;
  name: string;
  legal_name: string | null;
  gstin: string | null;
  pan: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  state_code: string | null;
  pincode: string | null;
  country: string | null;
  logo_url: string | null;
  signature_url: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  upi_id: string | null;
  invoice_prefix: string | null;
  invoice_terms: string | null;
  invoice_notes: string | null;
  invoice_theme: string | null;
}

export function useCompany() {
  return useQuery({
    queryKey: ["company"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from("companies" as any))
        .select("*").maybeSingle();
      if (error) throw error;
      return data as Company | null;
    },
  });
}