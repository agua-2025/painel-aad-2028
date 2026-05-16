import { ProtectedDashboard } from "@/components/ProtectedDashboard";

export default function RelatoriosPage() {
  return (
    <ProtectedDashboard>
      <div className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10 md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
          Módulo
        </p>

        <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] md:text-5xl">
          Relatórios
        </h1>

        <p className="mt-4 max-w-3xl leading-7 text-white/75">
          Fechamentos mensais, prestação de contas, histórico financeiro e dados
          consolidados.
        </p>
      </div>

      <div className="mt-8 rounded-3xl border border-[#e8dccb] bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-black tracking-[-0.04em]">
          Em implantação
        </h2>

        <p className="mt-3 leading-7 text-[#596579]">
          Aqui vamos gerar relatórios financeiros e administrativos para consulta
          da Diretoria, Comissão Fiscal e associados, conforme autorização.
        </p>
      </div>
    </ProtectedDashboard>
  );
}
