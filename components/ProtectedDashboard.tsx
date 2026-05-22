"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { canAccessDashboardPath, hasDashboardAccess } from "@/lib/permissions";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  status: string;
};

type RoleRow = {
  roles:
    | {
        name: string;
        description: string | null;
      }
    | {
        name: string;
        description: string | null;
      }[]
    | null;
};

type ProtectedDashboardProps = {
  children: React.ReactNode;
};

export function ProtectedDashboard({ children }: ProtectedDashboardProps) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadUserData() {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = "/login";
        return;
      }

      if (!user.email_confirmed_at) {
        await supabase.auth.signOut();
        setErrorMessage("Confirme seu e-mail antes de acessar o painel administrativo.");
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email, status")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profileData) {
        setErrorMessage("Não foi possível carregar o perfil do usuário.");
        setLoading(false);
        return;
      }

      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("roles(name, description)")
        .eq("profile_id", profileData.id);

      if (roleError) {
        setErrorMessage("Perfil carregado, mas não foi possível carregar as funções.");
        setLoading(false);
        return;
      }

      const roleNames =
        ((roleData as unknown as RoleRow[] | null) ?? [])
          .map((item) => {
            if (Array.isArray(item.roles)) {
              return item.roles[0]?.name;
            }

            return item.roles?.name;
          })
          .filter((name): name is string => Boolean(name)) ?? [];

      const canAccessDashboard = hasDashboardAccess(roleNames);

      if (!canAccessDashboard) {
        window.location.href = "/area";
        return;
      }

      if (!canAccessDashboardPath(roleNames, pathname)) {
        window.location.href = "/dashboard";
        return;
      }

      setProfile(profileData);
      setRoles(roleNames);
      setLoading(false);
    }

    loadUserData();
  }, [pathname]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-6 text-[#13233a]">
        <div className="rounded-3xl border border-[#e8dccb] bg-white p-8 shadow-sm">
          <p className="font-bold">Carregando painel...</p>
        </div>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-6 text-[#13233a]">
        <div className="max-w-xl rounded-3xl border border-red-200 bg-red-50 p-8 shadow-sm">
          <p className="font-bold text-red-700">{errorMessage}</p>
        </div>
      </main>
    );
  }

  return (
    <DashboardLayout
      userName={profile?.full_name}
      userEmail={profile?.email}
      roles={roles}
    >
      {children}
    </DashboardLayout>
  );
}