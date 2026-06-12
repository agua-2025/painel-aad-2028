import Link from "next/link";
import { ProtectedDashboard } from "@/components/ProtectedDashboard";

const modules = [
  {
    title: "Cadastrar reunião",
    description: "Criar reunião, pautas e alternativas de votação.",
    href: "/dashboard/reunioes/cadastrar",
    icon: "📝",
  },
  {
    title: "Convocação",
    description: "Gerar aviso de convocação a partir de reunião cadastrada.",
    href: "/dashboard/reunioes/convocacao",
    icon: "📣",
  },
  {
    title: "Realizar reunião",
    description: "Acompanhar presença, quórum, votação e encerramento.",
    href: "/dashboard/reunioes/realizar",
    icon: "🗳️",
  },
  {
    title: "Histórico e pesquisa",
    description: "Consultar reuniões anteriores e registros do módulo.",
    href: "/dashboard/reunioes/historico",
    icon: "🔎",
  },
  {
    title: "Atas",
    description: "Gerar, revisar e consultar atas das reuniões encerradas.",
    href: "/dashboard/reunioes/atas",
    icon: "📄",
  },
  {
    title: "Relatório de votação",
    description: "Consultar presenças, horários e votos por pauta.",
    href: "/dashboard/reunioes/relatorio-votacao",
    icon: "🧾",
  },
];

export default function ReunioesPage() {
  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-xl bg-[#13233a] p-4 text-white shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#c7a56b]">
            Governança interna
          </p>

          <h1 className="mt-1 text-xl font-black tracking-[-0.03em]">
            Reuniões e Atas
          </h1>

          <p className="mt-1 max-w-4xl text-sm leading-5 text-white/70">
            Organize reuniões, pautas, presenças, votações, atas e relatórios do
            módulo.
          </p>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="group rounded-xl border border-[#e8dccb] bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-[#c7a56b] hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f7f8fa] text-xl">
                  {module.icon}
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-black tracking-[-0.03em] text-[#13233a]">
                    {module.title}
                  </h2>

                  <p className="mt-1 text-sm leading-5 text-[#596579]">
                    {module.description}
                  </p>

                  <span className="mt-3 inline-flex rounded-full bg-[#13233a] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-white transition group-hover:bg-[#0f1c31]">
                    Acessar
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </ProtectedDashboard>
  );
}
