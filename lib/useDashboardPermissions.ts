"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  canApprove,
  canCreate,
  canDelete,
  canUpdate,
  type DashboardModule,
} from "@/lib/permissions";

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

export function useDashboardPermissions(module: DashboardModule) {
  const [loadingPermissions, setLoadingPermissions] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    async function loadPermissions() {
      setLoadingPermissions(true);

      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setRoles([]);
        setLoadingPermissions(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) {
        setRoles([]);
        setLoadingPermissions(false);
        return;
      }

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("roles(name, description)")
        .eq("profile_id", profile.id);

      const roleNames =
        ((roleData as unknown as RoleRow[] | null) ?? [])
          .map((item) => {
            if (Array.isArray(item.roles)) {
              return item.roles[0]?.name;
            }

            return item.roles?.name;
          })
          .filter((name): name is string => Boolean(name)) ?? [];

      setRoles(roleNames);
      setLoadingPermissions(false);
    }

    loadPermissions();
  }, []);

  return useMemo(
    () => ({
      loadingPermissions,
      roles,
      canCreate: canCreate(roles, module),
      canUpdate: canUpdate(roles, module),
      canDelete: canDelete(roles, module),
      canApprove: canApprove(roles, module),
      isReadOnly:
        !canCreate(roles, module) &&
        !canUpdate(roles, module) &&
        !canDelete(roles, module) &&
        !canApprove(roles, module),
    }),
    [loadingPermissions, roles, module]
  );
}
