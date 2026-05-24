import { SupabaseClient } from "@supabase/supabase-js";

type AuditLogParams = {
  supabase: SupabaseClient;
  action: string;
  module: string;
  description: string;
  tableName?: string;
  recordId?: string;
  oldData?: unknown;
  newData?: unknown;
};

export async function registerAuditLog({
  supabase,
  action,
  module,
  description,
  tableName,
  recordId,
  oldData,
  newData,
}: AuditLogParams) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase.from("audit_logs").insert({
    user_id: user.id,
    profile_id: profile?.id ?? null,
    user_name: profile?.full_name ?? null,
    user_email: profile?.email ?? user.email ?? null,
    action,
    module,
    table_name: tableName ?? null,
    record_id: recordId ?? null,
    description,
    old_data: oldData ?? null,
    new_data: newData ?? null,
  });

  if (error) {
    console.error("Erro ao registrar log de auditoria:", error);
  }
}
