"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setStatus("Enviando instruções...");

    const supabase = createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/redefinir-senha`
          : undefined,
    });

    if (error) {
      console.error("Erro ao solicitar redefinição de senha:", error);

      const message = error.message?.toLowerCase() || "";

      if (
        message.includes("rate limit") ||
        message.includes("too many") ||
        message.includes("security purposes")
      ) {
        setStatus(
          "Muitas solicitações foram feitas em pouco tempo. Aguarde alguns minutos antes de pedir um novo link de recuperação."
        );
      } else {
        setStatus(
          "Não foi possível enviar o e-mail de recuperação. Verifique o endereço informado e tente novamente."
        );
      }

      setLoading(false);
      return;
    }

    setStatus(
      "Se este e-mail estiver cadastrado, enviaremos um link para redefinir sua senha. Verifique sua caixa de entrada e também a pasta de spam."
    );
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
              Recuperação de acesso
            </p>

            <h1 className="mt-5 max-w-xl text-5xl font-black leading-[0.95] tracking-[-0.07em] text-[#13233a] md:text-6xl">
              Esqueci minha senha
            </h1>

            <p className="mt-6 max-w-md text-base font-medium leading-8 text-[#596579]">
              Informe o e-mail cadastrado no sistema para receber o link de
              redefinição de senha.
            </p>

            <p className="mt-6 max-w-md border-l-2 border-[#c7a56b] pl-4 text-sm font-medium leading-7 text-[#596579]">
              Por segurança, o link será enviado apenas para o e-mail vinculado
              à conta.
            </p>
          </section>

          <section className="rounded-[1.75rem] border border-[#e6ded2] bg-white p-5 shadow-xl shadow-slate-900/8 md:p-7">
            <div className="border-b border-[#eee7db] pb-5">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#a98246]">
                Redefinição
              </p>

              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#13233a]">
                Receber link por e-mail
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
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

              <button
                type="submit"
                disabled={loading}
                className="mt-2 rounded-xl bg-[#13233a] px-6 py-3 text-[12px] font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-slate-900/12 transition hover:bg-[#0d1a2d] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Enviando..." : "Enviar link de recuperação"}
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
