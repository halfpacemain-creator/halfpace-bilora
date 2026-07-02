import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const onboardingSchema = z.object({
  fullName: z.string().trim().optional().default(""),
  companyName: z.string().trim().optional().default(""),
  rollbackOnFailure: z.boolean().optional().default(false),
});

export const completeSignupOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(onboardingSchema)
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("complete_user_onboarding" as never, {
      _full_name: data.fullName,
      _company_name: data.companyName || null,
    } as never);

    if (error) {
      if (data.rollbackOnFailure) {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.auth.admin.deleteUser(context.userId);
        } catch (rollbackError) {
          console.error("Signup rollback failed", rollbackError);
        }
      }
      throw new Error(`Profile setup failed: ${error.message}`);
    }

    return result as { profile_id: string; company_id: string; ready: boolean };
  });