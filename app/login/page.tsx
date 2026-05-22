"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasDashboardAccess } from "@/lib/permissions";

type RoleRow = {
  roles:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setStatus("Verificando acesso...");

    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const message = error.message?.toLowerCase() || "";

      if (message.includes("email not confirmed") || message.includes("not confirmed")) {
        setStatus(
          "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada e confirme o e-mail antes de acessar o sistema."
        );
      } else {
        setStatus("E-mail ou senha inválidos. Verifique os dados e tente novamente.");
      }

      setLoading(false);
      return;
    }

    if (!data.user?.email_confirmed_at) {
      await supabase.auth.signOut();
      setStatus(
        "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada e confirme o e-mail antes de acessar o sistema."
      );
      setLoading(false);
      return;
    }

    const user = data.user;
    const metadata = user.user_metadata || {};

    const fullName =
      typeof metadata.full_name === "string" && metadata.full_name.trim()
        ? metadata.full_name
        : user.email || "Usuário";

    const userEmail = user.email || email;

    let { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profileData) {
      const { data: createdProfile, error: createProfileError } = await supabase
        .from("profiles")
        .insert({
          user_id: user.id,
          full_name: fullName,
          email: userEmail,
          status: "ativo",
        })
        .select("id, full_name, email, status")
        .single();

      if (createProfileError || !createdProfile) {
        console.error("Erro ao criar perfil:", createProfileError);
        setStatus(
          "Login realizado, mas não foi possível preparar seu perfil. Procure o suporte."
        );
        setLoading(false);
        return;
      }

      profileData = createdProfile;
      profileError = null;
    }

    if (profileError || !profileData) {
      setStatus("Não foi possível carregar seu perfil.");
      setLoading(false);
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("roles(name)")
      .eq("profile_id", profileData.id);

    const roleNames =
      ((roleData as unknown as RoleRow[] | null) ?? [])
        .map((item) => {
          if (Array.isArray(item.roles)) {
            return item.roles[0]?.name;
          }

          return item.roles?.name;
        })
        .filter((name): name is string => Boolean(name)) ?? [];

    setStatus("Login realizado com sucesso. Redirecionando...");

    if (hasDashboardAccess(roleNames)) {
      window.location.href = "/dashboard";
      return;
    }

    window.location.href = "/area";
  }

  return (
    <main className="min-h-screen bg-[#f8f7f4] text-[#13233a]">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-5 py-8 md:px-8">
        <div className="border-b border-[#e6ded2] pb-5">
          <Link
            href="/"
            className="text-[11px] font-black uppercase tracking-[0.28em] text-[#a98246] transition hover:text-[#13233a]"
          >
            AAD Direito 2028
          </Link>
        </div>

        <div className="grid gap-10 py-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <section>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#a98246]">
              Acesso restrito
            </p>

            <h1 className="mt-5 max-w-xl text-5xl font-black leading-[0.95] tracking-[-0.07em] text-[#13233a] md:text-6xl">
              Entrar no sistema
            </h1>

            <p className="mt-6 max-w-md text-base font-medium leading-8 text-[#596579]">
              Informe suas credenciais para acessar a área do associado ou o
              painel administrativo, conforme seu perfil de acesso.
            </p>

            <p className="mt-6 max-w-md border-l-2 border-[#c7a56b] pl-4 text-sm font-medium leading-7 text-[#596579]">
              O acesso é liberado conforme o perfil definido no sistema. Usuários
              administrativos serão direcionados ao painel.
            </p>
          </section>

          <section className="rounded-[1.75rem] border border-[#e6ded2] bg-white p-5 shadow-xl shadow-slate-900/8 md:p-7">
            <div className="flex items-center justify-between gap-4 border-b border-[#eee7db] pb-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#a98246]">
                  Login
                </p>

                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#13233a]">
                  Dados de acesso
                </h2>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f1eadf] text-xs font-black text-[#a98246]">
                AAD
              </div>
            </div>

            <form onSubmit={handleLogin} className="mt-6 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">E-mail</span>

                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-[#e6ded2] bg-[#fcfcfd] px-4 py-3 text-sm font-bold text-[#13233a] outline-none transition focus:border-[#c7a56b] focus:bg-white"
                  placeholder="seuemail@exemplo.com"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">Senha</span>

                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-[#e6ded2] bg-[#fcfcfd] px-4 py-3 text-sm font-bold text-[#13233a] outline-none transition focus:border-[#c7a56b] focus:bg-white"
                  placeholder="Digite sua senha"
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 rounded-xl bg-[#13233a] px-6 py-3 text-[12px] font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-slate-900/12 transition hover:bg-[#0d1a2d] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>

              {status && (
                <div className="rounded-xl border border-[#e6ded2] bg-[#f8f7f4] px-4 py-3 text-sm font-bold leading-6 text-[#596579]">
                  {status}
                </div>
              )}
            </form>

            <div className="mt-6 border-t border-[#eee7db] pt-4">
              <Link
                href="/"
                className="text-xs font-black uppercase tracking-[0.14em] text-[#596579] underline decoration-[#d8cbb7] decoration-2 underline-offset-8 transition hover:text-[#13233a]"
              >
                Voltar para a página inicial
              </Link>
            </div>
          </section>
        </div>

        <footer className="border-t border-[#e6ded2] pt-5">
          <div className="flex flex-col gap-2 text-xs font-bold text-[#596579] md:flex-row md:items-center md:justify-between">
            <p>AAD Direito 2028 · Ambiente restrito.</p>
            <p>Acesso conforme perfil autorizado.</p>
          </div>
        </footer>
      </section>
    </main>
  );
}
