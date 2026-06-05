"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RedefinirSenhaPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [canUpdate, setCanUpdate] = useState(false);

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        setCanUpdate(true);
        return;
      }

      setStatus("Link inválido ou expirado. Solicite novamente a recuperação de senha.");
    }

    checkSession();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canUpdate) {
      setStatus("Link inválido ou expirado. Solicite novamente a recuperação de senha.");
      return;
    }

    if (password.length < 6) {
      setStatus("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("As senhas informadas não coincidem.");
      return;
    }

    setLoading(true);
    setStatus("Atualizando senha...");

    const supabase = createClient();

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      console.error("Erro ao redefinir senha:", error);
      setStatus(
        "Não foi possível redefinir a senha. Solicite um novo link e tente novamente."
      );
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();

    setStatus("Senha redefinida com sucesso. Você já pode entrar com a nova senha.");
    setPassword("");
    setConfirmPassword("");
    setCanUpdate(false);
    setLoading(false);
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
            Redefinir senha
          </h1>

          <p className="mt-1.5 text-sm font-medium leading-6 text-[#596579]">
            Crie uma nova senha para recuperar o acesso ao sistema.
          </p>
        </div>

        <section className="rounded-3xl border border-[#e6ded2] bg-white p-5 shadow-xl shadow-slate-900/10">
          <form onSubmit={handleSubmit} className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#596579]">
                Nova senha
              </span>

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                disabled={!canUpdate || loading}
                className="w-full rounded-xl border border-[#e6ded2] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[#13233a] outline-none transition focus:border-[#c7a56b] focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Mínimo 6 caracteres"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#596579]">
                Confirmar nova senha
              </span>

              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                disabled={!canUpdate || loading}
                className="w-full rounded-xl border border-[#e6ded2] bg-[#f8fafc] px-4 py-3 text-sm font-semibold text-[#13233a] outline-none transition focus:border-[#c7a56b] focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="Repita a nova senha"
              />
            </label>

            <button
              type="submit"
              disabled={!canUpdate || loading}
              className="rounded-xl bg-[#13233a] px-6 py-3 text-[12px] font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-slate-900/15 transition hover:bg-[#0d1a2d] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Redefinindo..." : "Redefinir senha"}
            </button>

            {status && (
              <div className="rounded-xl border border-[#e6ded2] bg-[#f8f7f4] px-4 py-3 text-sm font-bold leading-6 text-[#596579]">
                {status}
              </div>
            )}
          </form>

          <div className="mt-5 border-t border-[#eee7db] pt-4">
            <Link
              href="/login"
              className="text-xs font-black uppercase tracking-[0.14em] text-[#596579] underline decoration-[#d8cbb7] decoration-2 underline-offset-8 transition hover:text-[#13233a]"
            >
              Voltar para o login
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
