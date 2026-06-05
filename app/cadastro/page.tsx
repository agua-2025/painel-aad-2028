"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  formatCPF,
  formatPhone,
  isValidCPF,
  normalizeEmail,
  normalizeName,
} from "@/lib/utils/formatters";

export default function CadastroPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    cpf: "",
    phone: "",
    email: "",
    password: "",
    confirm_password: "",
  });

  function updateField(field: string, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatusMessage("");

    const fullName = normalizeName(form.full_name);
    const email = normalizeEmail(form.email);
    const cpf = formatCPF(form.cpf);
    const phone = formatPhone(form.phone);

    if (!fullName || fullName.split(" ").length < 2) {
      setStatusMessage("Informe o nome completo.");
      return;
    }

    if (!isValidCPF(cpf)) {
      setStatusMessage("Informe um CPF válido.");
      return;
    }

    if (form.password.length < 6) {
      setStatusMessage("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (form.password !== form.confirm_password) {
      setStatusMessage("A confirmação de senha não confere.");
      return;
    }

    setLoading(true);
    setStatusMessage("Criando sua conta...");

    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: {
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/login`
            : undefined,
        data: {
          full_name: fullName,
          cpf,
          phone,
        },
      },
    });

    if (error) {
      console.error("Erro ao criar conta:", error);
      setStatusMessage(error.message || "Não foi possível criar a conta. Verifique os dados e tente novamente.");
      setLoading(false);
      return;
    }

    if (!data.session) {
      setStatusMessage(
        "Conta criada com sucesso. Enviamos um link de confirmação para seu e-mail. Confirme o e-mail antes de entrar no sistema."
      );
      setLoading(false);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from("profiles").upsert({
        user_id: data.user.id,
        full_name: fullName,
        email,
        status: "ativo",
      });

      if (profileError) {
        console.error("Erro ao salvar perfil:", profileError);
        setStatusMessage(profileError.message || "A conta foi criada, mas não foi possível salvar o perfil.");
        setLoading(false);
        return;
      }
    }

    setStatusMessage("Conta criada com sucesso. Redirecionando...");
    router.push("/area");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-5 py-8 text-[#13233a] md:px-8">
      <section className="mx-auto max-w-4xl">
        <div className="rounded-2xl bg-[#13233a] px-5 py-5 text-white shadow-xl shadow-slate-900/10 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c7a56b]">
                Primeiro acesso
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] md:text-3xl">
                Criar cadastro
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
                Crie sua conta para solicitar associação e acompanhar a análise
                pela Diretoria/Secretaria.
              </p>
            </div>

            <div className="flex w-fit items-center justify-center rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-white/20">
              <img
                src="/brand/aad-login-logo.png"
                alt="AAD Direito 2028"
                className="h-auto max-h-[46px] w-full max-w-[260px] object-contain"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-[#e8dccb] bg-[#fffaf1] px-5 py-4 shadow-sm">
          <p className="text-sm leading-6 text-[#596579]">
            Use um e-mail válido. Após criar a conta, poderá ser necessário
            confirmar o e-mail antes de acessar o sistema.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-2xl border border-[#e8dccb] bg-white p-5 shadow-sm md:p-6"
        >
          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#596579]">Nome completo *</span>
              <input
                type="text"
                value={form.full_name}
                onChange={(event) => updateField("full_name", event.target.value)}
                required
                className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
                placeholder="Ex.: Márcio Luiz Pereira"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">CPF *</span>
                <input
                  type="text"
                  value={form.cpf}
                  onChange={(event) => updateField("cpf", formatCPF(event.target.value))}
                  required
                  inputMode="numeric"
                  className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
                  placeholder="000.000.000-00"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">Telefone/WhatsApp</span>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(event) => updateField("phone", formatPhone(event.target.value))}
                  inputMode="numeric"
                  className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
                  placeholder="(00) 00000-0000"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-bold text-[#596579]">E-mail *</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                required
                className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
                placeholder="email@exemplo.com"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">Senha *</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => updateField("password", event.target.value)}
                  required
                  minLength={6}
                  className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
                  placeholder="Mínimo 6 caracteres"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-bold text-[#596579]">Confirmar senha *</span>
                <input
                  type="password"
                  value={form.confirm_password}
                  onChange={(event) =>
                    updateField("confirm_password", event.target.value)
                  }
                  required
                  minLength={6}
                  className="rounded-2xl border border-[#e8dccb] px-4 py-3 outline-none transition focus:border-[#c7a56b]"
                  placeholder="Repita a senha"
                />
              </label>
            </div>
          </div>

          {statusMessage && (
            <div className="mt-6 rounded-2xl bg-[#f7f8fa] p-4 text-sm font-bold text-[#596579]">
              {statusMessage}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Link
              href="/"
              className="rounded-full border border-[#e8dccb] bg-white px-6 py-3 text-center text-sm font-black uppercase tracking-[0.1em] text-[#13233a] transition hover:bg-[#f7f8fa]"
            >
              Voltar
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-[#13233a] px-6 py-3 text-sm font-black uppercase tracking-[0.1em] text-white shadow-lg shadow-slate-900/10 transition hover:bg-[#0c1728] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Criando..." : "Criar conta"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
