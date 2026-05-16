import { ProtectedArea } from "@/components/ProtectedArea";

export default function AreaFinanceiroPage() {
  return (
    <ProtectedArea>
      <div className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10 md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
          Minha área
        </p>

        <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] md:text-5xl">
          Financeiro
        </h1>

        <p className="mt-4 max-w-3xl leading-7 text-white/75">
          Resumo financeiro individual do associado perante a Associação.
        </p>
      </div>

      <div className="mt-8 rounded-3xl border border-[#e8dccb] bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-black tracking-[-0.04em]">
          Em implantação
        </h2>

        <p className="mt-3 leading-7 text-[#596579]">
          Aqui o associado verá sua situação financeira, valores em aberto e
          pagamentos vinculados.
        </p>
      </div>
    </ProtectedArea>
  );
}
