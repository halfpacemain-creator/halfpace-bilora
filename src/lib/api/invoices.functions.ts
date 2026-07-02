import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const nextInvoiceNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ company_id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: result, error } = await (context.supabase as any).rpc("next_invoice_number", {
      _company_id: data.company_id,
    });
    if (error) throw new Error(error.message);
    return { invoice_number: result as string };
  });