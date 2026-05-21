import { ProtectedArea } from "@/components/ProtectedArea";

const whatsappNumber = "5565999232001";
const whatsappMessage = encodeURIComponent(
  "Olá, preciso de suporte na área do associado da AAD Direito 2028."
);

const supportItems = [
  "Dúvidas sobre cadastro ou solicitação de associação",
  "Correção de dados pessoais ou contato",
  "Dificuldade para informar pagamento",
  "Dúvidas sobre mensalidades ou contribuições extras",
  "Problemas de acesso ao sistema",
];

export default function AreaSuportePage() {
  return (
    <ProtectedArea>
      <div className="space-y-4">
        <section className="rounded-2xl bg-[#13233a] px-5 py-5 text-white shadow-xl shadow-slate-900/10 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c7a56b]">
                Minha área
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] md:text-3xl">
                Suporte
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
                Canal de orientação para dúvidas sobre associação, cadastro,
                pagamentos e uso da área do associado.
              </p>
            </div>

            <span className="w-fit rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-white">
              Atendimento
            </span>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-2xl border border-[#e8dccb] bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a7834d]">
              Contato principal
            </p>

            <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#13233a]">
              Fale pelo WhatsApp
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#596579]">
              Para dúvidas ou dificuldades na área do associado, entre em contato
              pelo número abaixo.
            </p>

            <div className="mt-4 rounded-2xl bg-[#f7f8fa] px-4 py-3">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#a7834d]">
                WhatsApp
              </p>

              <p className="mt-1 text-lg font-black text-[#13233a]">
                (65) 9 9923-2001
              </p>
            </div>

            <a
              href={`https://wa.me/${whatsappNumber}?text=${whatsappMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex rounded-full bg-[#13233a] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#0c1728]"
            >
              Abrir WhatsApp
            </a>
          </div>

          <div className="rounded-2xl border border-[#e8dccb] bg-white shadow-sm">
            <div className="border-b border-[#e8dccb] px-5 py-4">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a7834d]">
                Orientações
              </p>

              <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-[#13233a]">
                Quando procurar suporte
              </h2>
            </div>

            <div className="divide-y divide-[#e8dccb]">
              {supportItems.map((item) => (
                <div key={item} className="px-5 py-3">
                  <p className="text-sm font-bold leading-6 text-[#596579]">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#e8dccb] bg-[#fffaf1] px-5 py-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a7834d]">
            Atenção
          </p>

          <p className="mt-2 text-sm leading-6 text-[#596579]">
            Para assuntos financeiros, confira também as páginas Financeiro,
            Pagamentos e Contribuições Extras. Caso ainda tenha dúvida, envie
            mensagem pelo WhatsApp informado acima.
          </p>
        </section>
      </div>
    </ProtectedArea>
  );
}
