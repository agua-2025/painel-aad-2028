import { ProtectedArea } from "@/components/ProtectedArea";

const documents = [
  {
    title: "Estatuto Social",
    description:
      "Organização, finalidade, direitos, deveres e regras gerais da Associação.",
    href: "https://associacao-direito-2028.vercel.app/documentos/estatuto-social-aad-direito-2028-versao-publica.pdf",
    tag: "Institucional",
    available: true,
  },
  {
    title: "Ata de Constituição",
    description:
      "Versão pública da ata de constituição da AAD Direito 2028, com dados pessoais protegidos.",
    href: "https://associacao-direito-2028.vercel.app/documentos/ata-constituicao-aad-direito-2028-versao-publica.pdf",
    tag: "Institucional",
    available: true,
  },
  {
    title: "Orientações ao associado",
    description:
      "Resumo com orientações sobre participação, contribuições, campanhas e acompanhamento da Associação.",
    href: "#",
    tag: "Em breve",
    available: false,
  },
  {
    title: "Aviso sobre proteção de dados",
    description:
      "Informações sobre o uso de dados pessoais para cadastro, identificação e gestão interna.",
    href: "#",
    tag: "Em breve",
    available: false,
  },
];

export default function AreaDocumentosPage() {
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
                Documentos
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/75">
                Consulte documentos importantes da AAD Direito 2028 e orientações
                liberadas aos associados.
              </p>
            </div>

            <span className="w-fit rounded-full bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] text-white">
              Área documental
            </span>
          </div>
        </section>

        <section className="rounded-2xl border border-[#e8dccb] bg-white shadow-sm">
          <div className="border-b border-[#e8dccb] px-5 py-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a7834d]">
              Arquivos disponíveis
            </p>

            <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-[#13233a]">
              Documentos da Associação
            </h2>
          </div>

          <div className="divide-y divide-[#e8dccb]">
            {documents.map((document) => (
              <article
                key={document.title}
                className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-[#13233a]">
                      {document.title}
                    </h3>

                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${
                        document.available
                          ? "bg-[#13233a] text-white"
                          : "bg-[#f7f8fa] text-[#596579]"
                      }`}
                    >
                      {document.tag}
                    </span>
                  </div>

                  <p className="mt-1 max-w-3xl text-sm leading-6 text-[#596579]">
                    {document.description}
                  </p>
                </div>

                {document.available ? (
                  <a
                    href={document.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit rounded-full bg-[#13233a] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#0c1728]"
                  >
                    Abrir documento
                  </a>
                ) : (
                  <span className="inline-flex w-fit rounded-full border border-[#e8dccb] bg-[#f7f8fa] px-5 py-2.5 text-sm font-black text-[#596579]">
                    Em breve
                  </span>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#e8dccb] bg-[#fffaf1] px-5 py-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a7834d]">
            Atenção
          </p>

          <p className="mt-2 text-sm leading-6 text-[#596579]">
            Alguns documentos podem ser disponibilizados em versão pública, com
            supressão de dados pessoais, assinaturas e informações internas, em
            observância à proteção de dados e à segurança dos associados.
          </p>
        </section>
      </div>
    </ProtectedArea>
  );
}
