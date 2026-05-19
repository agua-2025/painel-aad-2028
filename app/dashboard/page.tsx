import { ProtectedDashboard } from "@/components/ProtectedDashboard";

const mainCards = [
  {
    title: "Associados",
    text: "Cadastro, situação e acompanhamento dos associados.",
    href: "/dashboard/associados",
    icon: "👥",
  },
  {
    title: "Solicitações",
    text: "Análise de pedidos de associação pendentes, aprovados ou rejeitados.",
    href: "/dashboard/solicitacoes",
    icon: "📝",
  },
  {
    title: "Mensalidades",
    text: "Geração de mensalidades e baixa manual de pagamentos.",
    href: "/dashboard/mensalidades",
    icon: "📅",
  },
  {
    title: "Informes de Pagamento",
    text: "Conferência dos pagamentos informados pelos associados.",
    href: "/dashboard/pagamentos",
    icon: "💳",
  },
];

const financeCards = [
  {
    title: "Movimento Financeiro",
    text: "Entradas, saídas e saldo financeiro por período.",
    href: "/dashboard/movimento-financeiro",
  },
  {
    title: "Receitas Avulsas",
    text: "Doações, reembolsos, rifas, eventos e outras entradas.",
    href: "/dashboard/receitas-avulsas",
  },
  {
    title: "Despesas",
    text: "Controle de despesas, pagamentos e comprovantes.",
    href: "/dashboard/despesas",
  },
  {
    title: "Inadimplência",
    text: "Mensalidades em aberto, atrasos, encargos e saldos pendentes.",
    href: "/dashboard/inadimplencia",
  },
  {
    title: "Contribuições Extras",
    text: "Rateios e cobranças pontuais dos associados.",
    href: "/dashboard/contribuicoes-extras",
  },
  {
    title: "Saldos do Caixa",
    text: "Cadastro do saldo inicial mensal usado nos relatórios.",
    href: "/dashboard/saldos-caixa",
  },
];

const controlCards = [
  {
    title: "Fechamento Mensal",
    text: "Conciliação do mês, saldo bancário e bloqueio de alterações.",
    href: "/dashboard/fechamento-mensal",
  },
  {
    title: "Conferência de Saldos",
    text: "Comparação entre saldo final de um mês e saldo inicial do seguinte.",
    href: "/dashboard/conferencia-saldos",
  },
  {
    title: "Prestação de Contas",
    text: "Relatório mensal para Diretoria, Tesouraria e Comissão Fiscal.",
    href: "/dashboard/prestacao-contas",
  },
  {
    title: "Relatórios",
    text: "Exportações e relatórios administrativos por período.",
    href: "/dashboard/relatorios",
  },
];

export default function DashboardPage() {
  return (
    <ProtectedDashboard>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] p-5 text-white shadow-xl shadow-slate-900/10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
            Área administrativa
          </p>

          <h1 className="mt-2 text-2xl font-black tracking-[-0.04em]">
            Painel AAD 2028
          </h1>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
            Central de gestão da Associação dos Acadêmicos do Curso de Direito –
            Turma de Formatura 2028.
          </p>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          {mainCards.map((item) => (
            <a
              key={item.title}
              href={item.href}
              className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm transition hover:bg-[#f7f8fa]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-xl">{item.icon}</span>

                <span className="rounded-full bg-[#f7f8fa] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#596579]">
                  Abrir
                </span>
              </div>

              <h2 className="mt-3 text-base font-black tracking-[-0.03em] text-[#13233a]">
                {item.title}
              </h2>

              <p className="mt-1 text-xs font-bold leading-5 text-[#596579]">
                {item.text}
              </p>
            </a>
          ))}
        </section>

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
              Financeiro
            </h2>

            <p className="text-xs font-bold text-[#596579]">
              Atalhos para movimentação, cobranças, despesas e acompanhamento financeiro.
            </p>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-[#e8dccb]">
            <div className="hidden grid-cols-12 border-b border-[#eee7db] bg-[#fafafa] px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.08em] text-[#596579] md:grid">
              <div className="col-span-4">Módulo</div>
              <div className="col-span-6">Finalidade</div>
              <div className="col-span-2 text-right">Acesso</div>
            </div>

            <div className="divide-y divide-[#eee7db]">
              {financeCards.map((item) => (
                <a
                  key={item.title}
                  href={item.href}
                  className="grid gap-2 px-3 py-3 text-sm transition hover:bg-[#f7f8fa] md:grid-cols-12 md:items-center"
                >
                  <div className="font-black text-[#13233a] md:col-span-4">
                    {item.title}
                  </div>

                  <div className="text-xs font-bold leading-5 text-[#596579] md:col-span-6">
                    {item.text}
                  </div>

                  <div className="md:col-span-2 md:text-right">
                    <span className="inline-flex rounded-full border border-[#e8dccb] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#13233a]">
                      Abrir
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#e8dccb] bg-white p-4 shadow-sm">
          <div>
            <h2 className="text-lg font-black tracking-[-0.03em] text-[#13233a]">
              Controle e prestação de contas
            </h2>

            <p className="text-xs font-bold text-[#596579]">
              Ferramentas para fechamento, conferência, relatórios e transparência interna.
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {controlCards.map((item) => (
              <a
                key={item.title}
                href={item.href}
                className="rounded-xl border border-[#e8dccb] bg-white p-3 transition hover:bg-[#f7f8fa]"
              >
                <h3 className="text-sm font-black text-[#13233a]">
                  {item.title}
                </h3>

                <p className="mt-1 text-xs font-bold leading-5 text-[#596579]">
                  {item.text}
                </p>

                <span className="mt-3 inline-flex rounded-full border border-[#e8dccb] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.06em] text-[#13233a]">
                  Acessar
                </span>
              </a>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[#e8dccb] bg-white px-4 py-3 text-xs font-bold leading-6 text-[#596579]">
          Use o menu lateral para acessar todos os módulos. Esta página funciona
          como uma entrada rápida para as rotinas principais da administração.
        </section>
      </div>
    </ProtectedDashboard>
  );
}
