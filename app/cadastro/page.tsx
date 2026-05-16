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
        data: {
          full_name: fullName,
          cpf,
          phone,
        },
      },
    });

    if (error) {
      console.error(error);
      setStatusMessage("Não foi possível criar a conta. Verifique os dados e tente novamente.");
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from("profiles").upsert({
        user_id: data.user.id,
        full_name: fullName,
        email,
        status: "ativo",
      });
    }

    setStatusMessage("Conta criada com sucesso. Redirecionando...");
    router.push("/area");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-6 py-10 text-[#13233a]">
      <section className="mx-auto max-w-3xl">
        <div className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10 md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Primeiro acesso
          </p>

          <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] md:text-5xl">
            Criar conta
          </h1>

          <p className="mt-4 leading-7 text-white/75">
            Crie sua conta para solicitar associação e acompanhar a análise pela
            Diretoria/Secretaria.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-8 rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-sm md:p-6"
        >
          <div className="grid gap-5">
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

            <div className="grid gap-5 md:grid-cols-2">
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

            <div className="grid gap-5 md:grid-cols-2">
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

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
            <Link
              href="/associar"
              className="rounded-full border border-[#e8dccb] bg-white px-6 py-3 text-center text-sm font-black uppercase tracking-[0.1em] text-[#13233a]"
            >
              Voltar
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-[#13233a] px-6 py-3 text-sm font-black uppercase tracking-[0.1em] text-white shadow-lg shadow-slate-900/10 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Criando..." : "Criar conta"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
