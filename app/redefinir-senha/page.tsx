"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RedefinirSenhaPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("Validando link de recuperação...");
  const [loading, setLoading] = useState(false);
  const [canUpdate, setCanUpdate] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setCanUpdate(true);
        setStatus("Informe sua nova senha.");
      }
    });

    async function prepareRecoverySession() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error("Erro ao validar link de recuperação:", error);
          setCanUpdate(false);
          setStatus(
            "Não foi possível validar o link de recuperação. Solicite um novo link e tente novamente."
          );
          return;
        }

        window.history.replaceState({}, document.title, "/redefinir-senha");

        setCanUpdate(true);
        setStatus("Informe sua nova senha.");
        return;
      }

      const { data } = await supabase.auth.getSession();

      if (data.session) {
        setCanUpdate(true);
        setStatus("Informe sua nova senha.");
        return;
      }

      setCanUpdate(false);
      setStatus(
        "Link inválido ou expirado. Solicite novamente a recuperação de senha."
      );
    }

    prepareRecoverySession();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canUpdate) {
      setStatus("Solicite um novo link de recuperação de senha.");
      return;
    }

    if (password.length < 6) {
      setStatus("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("A confirmação de senha não confere.");
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
    <main className="min-h-screen bg-[#f8f7f4] text-[#13233a]">
      <section className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center px-5 py-8 md:px-8">
        <div className="border-b border-[#e6ded2] pb-5">
          <Link
            href="/"
            className="text-[11px] font-black uppercase tracking-[0.28em] text-[#a98246] transition hover:text-[#13233a]"
          >
            AAD Direito 2028
          </Link>
        </div>

        <div className="grid gap-8 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <section>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#a98246]">
              Nova senha
            </p>

            <h1 className="mt-5 max-w-xl text-5xl font-black leading-[0.95] tracking-[-0.07em] text-[#13233a] md:text-6xl">
              Redefinir senha
            </h1>

            <p className="mt-6 max-w-md text-base font-medium leading-8 text-[#596579]">
              Crie uma nova senha para recuperar o acesso ao sistema da AAD
              Direito 2028.
            </p>
          </section>

          <section className="rounded-[1.75rem] border border-[#e6ded2] bg-white p-5 shadow-xl shadow-slate-900/8 md:p-7">
            <div className="border-b border-[#eee7db] pb-5">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#a98246]">
                Segurança
              </p>

              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#13233a]">
                Definir nova senha
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
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
                  disabled={!canUpdate}
                  className="w-full rounded-xl border border-[#e6ded2] bg-[#fcfcfd] px-4 py-3 text-sm font-bold text-[#13233a] outline-none transition focus:border-[#c7a56b] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
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
                  disabled={!canUpdate}
                  className="w-full rounded-xl border border-[#e6ded2] bg-[#fcfcfd] px-4 py-3 text-sm font-bold text-[#13233a] outline-none transition focus:border-[#c7a56b] focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  placeholder="Repita a nova senha"
                />
              </label>

              <button
                type="submit"
                disabled={loading || !canUpdate}
                className="mt-2 rounded-xl bg-[#13233a] px-6 py-3 text-[12px] font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-slate-900/12 transition hover:bg-[#0d1a2d] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Salvando..." : "Redefinir senha"}
              </button>

              {status && (
                <div className="rounded-xl border border-[#e6ded2] bg-[#f8f7f4] px-4 py-3 text-sm font-bold leading-6 text-[#596579]">
                  {status}
                </div>
              )}
            </form>

            <div className="mt-6 border-t border-[#eee7db] pt-4">
              <Link
                href="/login"
                className="text-xs font-black uppercase tracking-[0.14em] text-[#596579] underline decoration-[#d8cbb7] decoration-2 underline-offset-8 transition hover:text-[#13233a]"
              >
                Voltar para o login
              </Link>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
