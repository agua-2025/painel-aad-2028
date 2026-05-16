"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("vivendamirassol@gmail.com");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setStatus("Verificando acesso...");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus("E-mail ou senha inválidos. Verifique os dados e tente novamente.");
      setLoading(false);
      return;
    }

    setStatus("Login realizado com sucesso. Redirecionando...");
    window.location.href = "/dashboard";
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-6 py-10 text-[#13233a]">
      <section className="mx-auto flex min-h-[calc(100vh-80px)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-[#e8dccb] bg-white shadow-xl shadow-slate-900/8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-[#13233a] p-10 text-white">
            <Link
              href="/"
              className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#c7a56b] text-sm font-black text-[#13233a]"
            >
              AAD
            </Link>

            <h1 className="mt-10 text-4xl font-black tracking-[-0.05em]">
              Painel AAD 2028
            </h1>

            <p className="mt-5 leading-7 text-white/75">
              Acesso restrito aos usuários autorizados da Associação.
            </p>

            <div className="mt-10 rounded-2xl border border-white/10 bg-white/8 p-5 text-sm leading-6 text-white/75">
              Use o e-mail e a senha cadastrados no Supabase Auth.
            </div>
          </div>

          <div className="p-8 md:p-10">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
              Entrar no sistema
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-[-0.04em]">
              Informe seus dados de acesso
            </h2>

            <form onSubmit={handleLogin} className="mt-8 grid gap-5">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">E-mail</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="rounded-2xl border border-[#e8dccb] bg-white px-5 py-4 outline-none transition focus:border-[#c7a56b]"
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
                  className="rounded-2xl border border-[#e8dccb] bg-white px-5 py-4 outline-none transition focus:border-[#c7a56b]"
                  placeholder="Digite sua senha"
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-[#13233a] px-8 py-4 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>

              {status && (
                <div className="rounded-2xl bg-[#f7f8fa] p-4 text-sm font-bold text-[#596579]">
                  {status}
                </div>
              )}
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
