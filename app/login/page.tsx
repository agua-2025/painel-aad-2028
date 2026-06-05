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
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-5 py-8 text-[#13233a]">
      <section className="w-full max-w-[430px]">
        <div className="mb-4 text-center">
          <Link href="/" className="mb-3 flex justify-center">
            <img
              src="/brand/aad-login-logo.png"
              alt="AAD Direito 2028"
              className="h-auto max-h-[44px] w-full max-w-[260px] object-contain"
            />
          </Link>

          <h1 className="mt-3 text-2xl font-black tracking-[-0.04em] text-[#13233a]">
            Entrar no sistema
          </h1>

          <p className="mt-1.5 text-sm font-medium leading-6 text-[#596579]">
            Informe seu e-mail e senha para acessar.
          </p>
        </div>

        <section className="rounded-3xl border border-[#e6ded2] bg-white p-5 shadow-xl shadow-slate-900/10">
          <form onSubmit={handleLogin} className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#596579]">E-mail</span>

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-xl border border-[#e6ded2] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[#13233a] outline-none transition focus:border-[#c7a56b] focus:bg-white"
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
                className="w-full rounded-xl border border-[#e6ded2] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[#13233a] outline-none transition focus:border-[#c7a56b] focus:bg-white"
                placeholder="Digite sua senha"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[#13233a] px-6 py-3 text-[12px] font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-slate-900/15 transition hover:bg-[#0d1a2d] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>

            {status && (
              <div className="rounded-xl border border-[#e6ded2] bg-[#f8f7f4] px-4 py-3 text-sm font-bold leading-6 text-[#596579]">
                {status}
              </div>
            )}
          </form>

          <div className="mt-5 grid gap-2 border-t border-[#eee7db] pt-4 sm:grid-cols-2">
            <Link
              href="/esqueci-senha"
              className="rounded-xl border border-[#e6ded2] bg-[#f8f7f4] px-4 py-2.5 text-center text-xs font-black uppercase tracking-[0.1em] text-[#596579] transition hover:bg-white hover:text-[#13233a]"
            >
              Esqueci minha senha
            </Link>

            <Link
              href="/cadastro"
              className="rounded-xl border border-[#e6ded2] bg-[#fffaf1] px-4 py-2.5 text-center text-xs font-black uppercase tracking-[0.1em] text-[#13233a] transition hover:bg-white"
            >
              Criar cadastro
            </Link>
          </div>
        </section>

        <div className="mt-5 text-center">
          <Link
            href="/"
            className="text-xs font-black uppercase tracking-[0.14em] text-[#596579] underline decoration-[#d8cbb7] decoration-2 underline-offset-8 transition hover:text-[#13233a]"
          >
            Voltar para a página inicial
          </Link>
        </div>
      </section>
    </main>
  );
}
