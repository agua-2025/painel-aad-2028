"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AreaLayoutProps = {
  children: React.ReactNode;
  userName?: string;
  userEmail?: string;
  requestStatus?: string | null;
  isAssociate?: boolean;
  canAccessDashboard?: boolean;
};

const baseMenuItems = [
  { label: "Início", href: "/area", icon: "🏠" },
  { label: "Termo de Adesão", href: "/area/solicitacao", icon: "📝" },
  { label: "Meus dados", href: "/area/dados", icon: "👤" },
  { label: "Documentos", href: "/area/documentos", icon: "📄" },
  { label: "Avisos", href: "/area/avisos", icon: "📢" },
  { label: "Reuniões", href: "/area/reunioes", icon: "🗳️" },
  { label: "Suporte", href: "/area/suporte", icon: "💬" },
  { label: "Assistente IA", href: "/area/assistente", icon: "🤖" },
];

const associateMenuItems = [
  { label: "Pagamentos", href: "/area/pagamentos", icon: "💳" },
  { label: "Financeiro", href: "/area/financeiro", icon: "💰" },
  { label: "Contribuições Extras", href: "/area/contribuicoes-extras", icon: "➕" },
];

function formatStatus(value?: string | null) {
  if (!value) return "Sem termo de adesão";

  const labels: Record<string, string> = {
    pendente: "Pendente",
    com_pendencia: "Com pendência",
    aprovada: "Aprovada",
    rejeitada: "Rejeitada",
  };

  return labels[value] || value.replaceAll("_", " ");
}

export function AreaLayout({
  children,
  userName,
  userEmail,
  requestStatus,
  isAssociate = false,
  canAccessDashboard = false,
}: AreaLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [assistantBubbleHidden, setAssistantBubbleHidden] = useState(false);

  const menuItems = isAssociate
    ? [...baseMenuItems, ...associateMenuItems]
    : baseMenuItems;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#13233a]">
      <header className="sticky top-0 z-40 border-b border-[#e8dccb] bg-white/95 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <Link href="/area" className="flex items-center">
            <img
              src="/brand/aad-logo-horizontal.png"
              alt="AAD Direito 2028"
              className="h-auto max-h-[46px] w-auto max-w-[205px] object-contain"
            />
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
          <div className="max-h-[calc(100dvh-78px)] overflow-y-auto overscroll-contain border-t border-[#e8dccb] bg-white px-5 py-4 pb-6 touch-pan-y [-webkit-overflow-scrolling:touch]">
            <nav className="grid gap-2">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl bg-[#f7f8fa] px-3 py-2.5 text-sm font-semibold"
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}

              {canAccessDashboard && (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl border border-[#e8dccb] bg-white px-3 py-2.5 text-sm font-black text-[#13233a]"
                >
                  <span>🧭</span>
                  <span>Painel Administrativo</span>
                </Link>
              )}

              <div className="mt-3 rounded-2xl border border-[#e8dccb] bg-[#f7f8fa] p-3">
                <p className="text-sm font-black">{userName || "Usuário"}</p>
                <p className="mt-1 truncate text-xs font-bold text-[#596579]">
                  {userEmail || ""}
                </p>

                <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase text-[#13233a]">
                  {isAssociate ? "Associado" : formatStatus(requestStatus)}
                </span>
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
        <aside className="sticky top-0 hidden h-screen flex-col border-r border-[#e8dccb] bg-white px-4 py-4 lg:flex">
          <Link
            href="/area"
            className="flex items-center justify-center rounded-3xl bg-[#f7f8fa] px-4 py-3"
          >
            <img
              src="/brand/aad-logo-horizontal.png"
              alt="AAD Direito 2028"
              className="h-auto max-h-[52px] w-full max-w-[205px] object-contain"
            />
          </Link>

          <nav className="mt-5 flex flex-col gap-1">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-semibold text-[#596579] transition hover:bg-[#f7f8fa] hover:text-[#13233a]"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[16px] leading-none">
                  {item.icon}
                </span>
                <span className="truncate leading-5">{item.label}</span>
              </Link>
            ))}

            {canAccessDashboard && (
              <Link
                href="/dashboard"
                className="mt-2 flex items-center gap-3 rounded-xl border border-[#e8dccb] bg-white px-3 py-2 text-[13px] font-black text-[#13233a] transition hover:bg-[#f7f8fa]"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[14px] leading-none">
                  🧭
                </span>
                <span className="truncate leading-5">Painel Administrativo</span>
              </Link>
            )}
          </nav>

          <div className="mt-auto rounded-3xl border border-[#e8dccb] bg-[#f7f8fa] p-3">
            <p className="text-sm font-black text-[#13233a]">
              {userName || "Usuário"}
            </p>

            <p className="mt-1 truncate text-[11px] font-bold text-[#596579]">
              {userEmail || ""}
            </p>

            <div className="mt-2">
              <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase text-[#13233a]">
                {isAssociate ? "Associado" : formatStatus(requestStatus)}
              </span>
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

        <section className="relative min-w-0 px-5 py-6 md:px-8 lg:px-9 lg:py-7">
          {children}

          {!assistantBubbleHidden && (
            <div className="fixed bottom-4 right-4 z-50 flex items-end gap-2 print:hidden">
              <button
                type="button"
                onClick={() => setAssistantBubbleHidden(true)}
                className="mb-9 flex h-7 w-7 items-center justify-center rounded-full border border-[#e8dccb] bg-white text-sm font-black text-[#596579] shadow-lg shadow-slate-900/15 transition hover:bg-[#f7f8fa] hover:text-[#13233a]"
                aria-label="Fechar Assistente IA"
                title="Fechar Assistente IA"
              >
                ×
              </button>

              <Link
                href="/area/assistente"
                title="Acessar Assistente IA"
                aria-label="Acessar Assistente IA"
                className="flex h-14 w-14 items-center justify-center rounded-full border border-[#e8dccb] bg-[#13233a] text-2xl text-white shadow-2xl shadow-slate-900/25 transition hover:-translate-y-1 hover:bg-[#0d1a2d]"
              >
                <span className="animate-bounce">🤖</span>
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
