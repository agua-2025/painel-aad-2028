"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";
import { createClient } from "@/lib/supabase/client";
import { useDashboardPermissions } from "@/lib/useDashboardPermissions";

type Associate = {
  id: string;
  profile_id: string | null;
  full_name: string;
  email: string | null;
  status: string;
};

type Profile = {
  id: string;
  full_name: string;
  email: string;
  status: string;
};

type Role = {
  id: string;
  name: string;
  description: string | null;
};

type UserRoleRow = {
  profile_id: string;
  role_id: string;
  roles:
    | {
        id: string;
        name: string;
        description: string | null;
      }
    | {
        id: string;
        name: string;
        description: string | null;
      }[]
    | null;
};

type AccessRow = {
  associate: Associate;
  profile: Profile | null;
  administrativeRole: string;
};

const administrativeRoleNames = [
  "administrador",
  "presidente",
  "vice_presidente",
  "secretaria",
  "tesoureira",
  "comissao_fiscal",
];

const roleLabels: Record<string, string> = {
  administrador: "Administrador",
  presidente: "Presidente",
  vice_presidente: "Vice-presidente",
  secretaria: "Secretaria",
  tesoureira: "Tesoureira",
  comissao_fiscal: "Comissão Fiscal",
};

function normalizeEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function formatRole(value: string) {
  return roleLabels[value] ?? value.replaceAll("_", " ");
}

export default function ConfiguracoesPage() {
  const permissions = useDashboardPermissions("configuracoes");
  const [loading, setLoading] = useState(true);
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [userRoles, setUserRoles] = useState<UserRoleRow[]>([]);

  const roleByName = useMemo(() => {
    return new Map(roles.map((role) => [role.name, role]));
  }, [roles]);

  const administrativeRoleIds = useMemo(() => {
    return roles.map((role) => role.id);
  }, [roles]);

  const accessRows = useMemo<AccessRow[]>(() => {
    const profileById = new Map(
      profiles.map((profile) => [profile.id, profile])
    );

    const profileByEmail = new Map(
      profiles.map((profile) => [normalizeEmail(profile.email), profile])
    );

    return associates.map((associate) => {
      const profile =
        (associate.profile_id ? profileById.get(associate.profile_id) : null) ??
        profileByEmail.get(normalizeEmail(associate.email)) ??
        null;

      const profileRoles = profile
        ? userRoles.filter((item) => item.profile_id === profile.id)
        : [];

      const administrativeRole =
        profileRoles
          .map((item) => {
            if (Array.isArray(item.roles)) {
              return item.roles[0]?.name;
            }

            return item.roles?.name;
          })
          .filter((name): name is string => Boolean(name))
          .find((name) => administrativeRoleNames.includes(name)) ?? "";

      return {
        associate,
        profile,
        administrativeRole,
      };
    });
  }, [associates, profiles, userRoles]);

  async function loadData() {
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { data: rolesData, error: rolesError } = await supabase
      .from("roles")
      .select("id, name, description")
      .in("name", administrativeRoleNames)
      .order("name", { ascending: true });

    if (rolesError) {
      console.error("Erro ao carregar funções:", rolesError);
      setMessage("Não foi possível carregar as funções de acesso.");
      setLoading(false);
      return;
    }

    const { data: associatesData, error: associatesError } = await supabase
      .from("associates")
      .select("id, profile_id, full_name, email, status")
      .eq("status", "ativo")
      .order("full_name", { ascending: true });

    if (associatesError) {
      console.error("Erro ao carregar associados:", associatesError);
      setMessage("Não foi possível carregar os associados.");
      setLoading(false);
      return;
    }

    const profileIdsFromAssociates =
      associatesData
        ?.map((item) => item.profile_id)
        .filter((id): id is string => Boolean(id)) ?? [];

    const emails =
      associatesData
        ?.map((item) => normalizeEmail(item.email))
        .filter(Boolean) ?? [];

    let profilesData: Profile[] = [];

    if (profileIdsFromAssociates.length > 0 || emails.length > 0) {
      let query = supabase
        .from("profiles")
        .select("id, full_name, email, status");

      if (profileIdsFromAssociates.length > 0 && emails.length > 0) {
        query = query.or(
          `id.in.(${profileIdsFromAssociates.join(",")}),email.in.(${emails.join(",")})`
        );
      } else if (profileIdsFromAssociates.length > 0) {
        query = query.in("id", profileIdsFromAssociates);
      } else {
        query = query.in("email", emails);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Erro ao carregar perfis:", error);
        setMessage("Associados carregados, mas não foi possível carregar os perfis.");
        setLoading(false);
        return;
      }

      profilesData = data ?? [];
    }

    const profileIds = profilesData.map((profile) => profile.id);

    let userRolesData: UserRoleRow[] = [];

    if (profileIds.length > 0) {
      const { data, error } = await supabase
        .from("user_roles")
        .select("profile_id, role_id, roles(id, name, description)")
        .in("profile_id", profileIds);

      if (error) {
        console.error("Erro ao carregar permissões:", error);
        setMessage("Perfis carregados, mas não foi possível carregar as permissões.");
        setLoading(false);
        return;
      }

      userRolesData = (data as unknown as UserRoleRow[]) ?? [];
    }

    setRoles(rolesData ?? []);
    setAssociates(associatesData ?? []);
    setProfiles(profilesData);
    setUserRoles(userRolesData);
    setLoading(false);
  }

  async function updateAdministrativeRole(profile: Profile, newRoleName: string) {
    if (!permissions.canUpdate) {
      setMessage("Seu perfil não tem permissão para alterar permissões de acesso.");
      return;
    }

    setSavingProfileId(profile.id);
    setMessage("Atualizando permissão...");

    const supabase = createClient();

    if (administrativeRoleIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("profile_id", profile.id)
        .in("role_id", administrativeRoleIds);

      if (deleteError) {
        console.error("Erro ao remover permissões anteriores:", deleteError);
        setMessage(deleteError.message || "Não foi possível remover a permissão anterior.");
        setSavingProfileId(null);
        return;
      }
    }

    if (newRoleName) {
      const selectedRole = roleByName.get(newRoleName);

      if (!selectedRole) {
        setMessage("Função selecionada não encontrada na tabela roles.");
        setSavingProfileId(null);
        return;
      }

      const { error: insertError } = await supabase.from("user_roles").insert({
        profile_id: profile.id,
        role_id: selectedRole.id,
      });

      if (insertError) {
        console.error("Erro ao atribuir permissão:", insertError);
        setMessage(insertError.message || "Não foi possível atribuir a nova permissão.");
        setSavingProfileId(null);
        return;
      }
    }

    setMessage("Permissão atualizada com sucesso.");
    setSavingProfileId(null);
    await loadData();
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Administração
          </p>

          <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            Configurações
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
            Gerencie permissões de acesso dos associados que também exercem função administrativa na associação.
          </p>
        </section>

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
                Permissões de acesso
              </h2>

              <p className="text-xs font-bold text-[#596579]">
                Primeiro aprove o cadastro como associado. Depois, atribua aqui a função administrativa, se houver.
              </p>
            </div>

            <button
              type="button"
              onClick={loadData}
              className="w-fit rounded-full border border-[#e8dccb] bg-white px-5 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#13233a] hover:bg-[#f7f8fa]"
            >
              Atualizar
            </button>
          </div>

          {permissions.isReadOnly && !permissions.loadingPermissions && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
              Seu perfil pode visualizar esta tela, mas não pode alterar permissões de acesso.
            </div>
          )}

          {message && (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-3 text-sm font-bold text-[#596579]">
              {message}
            </div>
          )}

          {loading ? (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-4 text-sm font-bold text-[#596579]">
              Carregando configurações...
            </div>
          ) : accessRows.length === 0 ? (
            <div className="mt-4 rounded-xl bg-[#f7f8fa] px-4 py-4 text-sm font-bold text-[#596579]">
              Nenhum associado ativo encontrado.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
              <div className="hidden grid-cols-12 border-b border-[#eee7db] bg-[#fafafa] px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#596579] xl:grid">
                <div className="col-span-4">Associado</div>
                <div className="col-span-3">Conta de acesso</div>
                <div className="col-span-2">Situação</div>
                <div className="col-span-3">Perfil administrativo</div>
              </div>

              <div className="divide-y divide-[#eee7db]">
                {accessRows.map((row) => (
                  <article
                    key={row.associate.id}
                    className="grid gap-3 px-3 py-3 text-sm xl:grid-cols-12 xl:items-center"
                  >
                    <div className="xl:col-span-4">
                      <p className="font-black text-[#13233a]">
                        {row.associate.full_name}
                      </p>

                      <p className="mt-1 text-xs font-bold text-[#596579]">
                        {row.associate.email || "Sem e-mail cadastrado"}
                      </p>
                    </div>

                    <div className="font-bold text-[#596579] xl:col-span-3">
                      {row.profile ? (
                        <>
                          <p>{row.profile.full_name}</p>
                          <p className="text-xs">{row.profile.email}</p>
                        </>
                      ) : (
                        <span className="text-xs text-amber-700">
                          Sem conta/perfil vinculado pelo e-mail
                        </span>
                      )}
                    </div>

                    <div className="xl:col-span-2">
                      <span className="inline-flex rounded-full bg-[#f7f8fa] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                        {row.profile
                          ? row.associate.status === "ativo"
                            ? "Associado ativo"
                            : row.associate.status
                          : "Pendente"}
                      </span>
                    </div>

                    <div className="xl:col-span-3">
                      <select
                        value={row.administrativeRole}
                        disabled={
                          !row.profile ||
                          savingProfileId === row.profile.id ||
                          permissions.loadingPermissions ||
                          !permissions.canUpdate
                        }
                        onChange={(event) => {
                          if (!row.profile) return;
                          updateAdministrativeRole(row.profile, event.target.value);
                        }}
                        className="w-full rounded-xl border border-[#e8dccb] bg-white px-3 py-2 text-sm font-bold text-[#13233a] outline-none transition focus:border-[#c7a56b] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="">Sem acesso administrativo</option>
                        {administrativeRoleNames.map((roleName) => (
                          <option
                            key={roleName}
                            value={roleName}
                            disabled={!roleByName.has(roleName)}
                          >
                            {formatRole(roleName)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </ProtectedDashboard>
  );
}
