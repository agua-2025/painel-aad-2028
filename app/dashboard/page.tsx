import { ProtectedDashboard } from "@/components/ProtectedDashboard";

const cards = [
  {
    title: "Associados",
    text: "Cadastro, situação, histórico e acompanhamento dos associados.",
    href: "/dashboard/associados",
    icon: "👥",
  },
  {
    title: "Financeiro",
    text: "Receitas, despesas, mensalidades, pagamentos e comprovantes.",
    href: "/dashboard/financeiro",
    icon: "💰",
  },
  {
    title: "Inadimplência",
    text: "Controle de atrasos, notificações, desligamento e regularização.",
    href: "/dashboard/inadimplencia",
    icon: "⚠️",
  },
  {
    title: "Relatórios",
    text: "Fechamentos mensais, prestação de contas e dados históricos.",
    href: "/dashboard/relatorios",
    icon: "📊",
  },
];

export default function DashboardPage() {
  return (
    <ProtectedDashboard>
      <div className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10 md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
          Área administrativa
        </p>

        <h2 className="mt-4 text-3xl font-black tracking-[-0.05em] md:text-5xl">
          Bem-vindo ao Painel AAD 2028
        </h2>

        <p className="mt-4 max-w-3xl leading-7 text-white/75">
          Ambiente de gestão administrativa e financeira da Associação, com
          controle de associados, financeiro, inadimplência, relatórios e
          histórico.
        </p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {cards.map((item) => (
          <a
            key={item.title}
            href={item.href}
            className="group rounded-3xl border border-[#e8dccb] bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-3xl">{item.icon}</div>

                <h3 className="mt-5 text-2xl font-black tracking-[-0.04em]">
                  {item.title}
                </h3>
              </div>

              <span className="rounded-full bg-[#f7f8fa] px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
                Abrir
              </span>
            </div>

            <p className="mt-4 leading-7 text-[#596579]">{item.text}</p>
          </a>
        ))}
      </div>
    </ProtectedDashboard>
  );
}
