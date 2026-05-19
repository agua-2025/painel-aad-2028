"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getAllowedDashboardHrefs } from "@/lib/permissions";

type DashboardLayoutProps = {
  children: React.ReactNode;
  userName?: string;
  userEmail?: string;
  roles?: string[];
};

const menuItems = [
  { label: "Início", href: "/dashboard", icon: "🏠" },
  { label: "Associados", href: "/dashboard/associados", icon: "👥" },
  { label: "Solicitações", href: "/dashboard/solicitacoes", icon: "📝" },
  { label: "Avisos", href: "/dashboard/avisos", icon: "📢" },
  { label: "Regras Financeiras", href: "/dashboard/financeiro", icon: "⚖️" },
  { label: "Mensalidades", href: "/dashboard/mensalidades", icon: "📅" },
  { label: "Contribuições Extras", href: "/dashboard/contribuicoes-extras", icon: "➕" },
  { label: "Informes de Pagamento", href: "/dashboard/pagamentos", icon: "💳" },
  { label: "Inadimplência", href: "/dashboard/inadimplencia", icon: "⚠️" },
  { label: "Movimento Financeiro", href: "/dashboard/movimento-financeiro", icon: "📒" },
  { label: "Saldos do Caixa", href: "/dashboard/saldos-caixa", icon: "🏦" },
  { label: "Fechamento Mensal", href: "/dashboard/fechamento-mensal", icon: "🔒" },
  { label: "Conferência de Saldos", href: "/dashboard/conferencia-saldos", icon: "🧾" },
  { label: "Receitas Avulsas", href: "/dashboard/receitas-avulsas", icon: "➕" },
  { label: "Despesas", href: "/dashboard/despesas", icon: "📤" },
  { label: "Prestação de Contas", href: "/dashboard/prestacao-contas", icon: "📑" },
  { label: "Relatórios", href: "/dashboard/relatorios", icon: "📊" },
  { label: "Configurações", href: "/dashboard/configuracoes", icon: "⚙️" },
];

export function DashboardLayout({
  children,
  userName,
  userEmail,
  roles = [],
}: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const allowedHrefs = new Set(getAllowedDashboardHrefs(roles));
  const visibleMenuItems = menuItems.filter(
    (item) => item.href === "/dashboard" || allowedHrefs.has(item.href)
  );

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#13233a]">
      <header className="sticky top-0 z-40 border-b border-[#e8dccb] bg-white/95 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#13233a] text-xs font-black text-[#c7a56b]">
              AAD
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#c7a56b]">
                Painel
              </p>
              <h1 className="text-lg font-black tracking-[-0.04em]">
                AAD 2028
              </h1>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((current) => !current)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e8dccb] bg-[#13233a] text-xl text-white"
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
          >
            {mobileMenuOpen ? "×" : "☰"}
          </button>
        </div>

        {mobileMenuOpen && (
        <div className="border-t border-[#e8dccb] bg-white px-5 py-4">
          <nav className="grid gap-2">
            <div className="my-2 border-t border-[#e8dccb]" />

            {visibleMenuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-2xl bg-[#f7f8fa] px-4 py-3 font-bold"
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}

              <Link
                href="/area"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 rounded-2xl border border-[#e8dccb] bg-white px-4 py-3 font-black text-[#13233a]"
              >
                <span>👤</span>
                <span>Área do Associado</span>
              </Link>

              <div className="mt-3 rounded-2xl border border-[#e8dccb] bg-[#f7f8fa] p-4">
                <p className="text-sm font-black">{userName || "Usuário"}</p>
                <p className="mt-1 truncate text-xs font-bold text-[#596579]">
                  {userEmail || ""}
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {roles.slice(0, 2).map((role) => (
                    <span
                      key={role}
                      className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase text-[#13233a]"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-2xl bg-[#13233a] px-4 py-3 text-left font-black uppercase tracking-[0.08em] text-white"
              >
                Sair
              </button>
            </nav>
          </div>
        )}
      </header>

      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[260px_1fr]">
        <aside className="sticky top-0 hidden h-screen flex-col overflow-hidden border-r border-[#e8dccb] bg-white px-4 py-4 lg:flex">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-3 rounded-3xl bg-[#f7f8fa] px-3 py-3"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#13233a] text-xs font-black text-[#c7a56b]">
              AAD
            </div>

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#c7a56b]">
                Painel
              </p>
              <h1 className="text-lg font-black tracking-[-0.04em]">
                AAD 2028
              </h1>
            </div>
          </Link>

          <nav className="mt-4 flex-1 space-y-1 overflow-y-auto pr-1 pb-3">
            {visibleMenuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-2xl px-3 py-2 text-[14px] font-bold text-[#596579] transition hover:bg-[#f7f8fa] hover:text-[#13233a]"
              >
                <span className="w-5 text-center text-sm">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
            <Link
              href="/area"
              className="mt-2 flex items-center gap-3 rounded-2xl border border-[#e8dccb] bg-white px-3 py-2 text-[14px] font-black text-[#13233a] transition hover:bg-[#f7f8fa]"
            >
              <span className="w-5 text-center text-sm">👤</span>
              <span>Área do Associado</span>
            </Link>
          </nav>

          <div className="shrink-0 rounded-3xl border border-[#e8dccb] bg-[#f7f8fa] p-3">
            <p className="text-sm font-black text-[#13233a]">
              {userName || "Usuário"}
            </p>

            <p className="mt-1 truncate text-[11px] font-bold text-[#596579]">
              {userEmail || ""}
            </p>

            <div className="mt-2 flex flex-wrap gap-1">
              {roles.slice(0, 2).map((role) => (
                <span
                  key={role}
                  className="rounded-full bg-white px-2 py-1 text-[9px] font-black uppercase text-[#13233a]"
                >
                  {role}
                </span>
              ))}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 w-full rounded-full bg-[#13233a] px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-white"
            >
              Sair
            </button>
          </div>
        </aside>

        <section className="min-w-0 px-5 py-6 md:px-8 lg:px-9 lg:py-7">
          {children}
        </section>
      </div>
    </main>
  );
}
