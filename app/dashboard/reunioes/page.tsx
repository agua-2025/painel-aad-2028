"use client";

import Link from "next/link";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";

const modules = [
  {
    title: "Cadastrar reunião",
    description:
      "Crie reuniões, informe data, horário, local, pautas e alternativas de votação.",
    href: "/dashboard/reunioes/cadastrar",
    icon: "📝",
  },
  {
    title: "Realizar reunião",
    description:
      "Acompanhe a reunião do dia, presença, quórum, votação e encerramento.",
    href: "/dashboard/reunioes/realizar",
    icon: "🗳️",
  },
  {
    title: "Histórico e pesquisa",
    description:
      "Pesquise reuniões por data, título, pauta, status e consulte registros anteriores.",
    href: "/dashboard/reunioes/historico",
    icon: "🔎",
  },
  {
    title: "Atas",
    description:
      "Gere, revise e consulte minutas de atas vinculadas às reuniões encerradas.",
    href: "/dashboard/reunioes/atas",
    icon: "📄",
  },
];

export default function ReunioesPage() {
  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Governança interna
          </p>

          <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            Reuniões e Atas
          </h1>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-white/75">
            Organize reuniões, pautas, presenças, votações, encerramentos e atas
            da Associação em páginas próprias, sem misturar cadastro, realização
            e histórico.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="rounded-2xl border border-[#e8dccb] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="text-3xl">{module.icon}</div>

              <h2 className="mt-4 text-lg font-black tracking-[-0.03em] text-[#13233a]">
                {module.title}
              </h2>

              <p className="mt-2 text-sm font-semibold leading-6 text-[#596579]">
                {module.description}
              </p>

              <span className="mt-4 inline-flex rounded-full bg-[#13233a] px-4 py-2 text-[10px] font-black uppercase tracking-[0.08em] text-white">
                Acessar
              </span>
            </Link>
          ))}
        </section>
      </div>
    </ProtectedDashboard>
  );
}
