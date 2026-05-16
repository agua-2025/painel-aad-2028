import { ProtectedArea } from "@/components/ProtectedArea";

const documents = [
  {
    title: "Estatuto Social",
    description:
      "Documento que estabelece a organização, finalidade, direitos, deveres e regras gerais da Associação.",
    href: "https://associacao-direito-2028.vercel.app/documentos/estatuto-social-aad-direito-2028-versao-publica.pdf",
    tag: "Institucional",
  },
  {
    title: "Ata de Constituição",
    description:
      "Versão pública da ata de constituição da AAD Direito 2028, com dados pessoais protegidos.",
    href: "https://associacao-direito-2028.vercel.app/documentos/ata-constituicao-aad-direito-2028-versao-publica.pdf",
    tag: "Institucional",
  },
  {
    title: "Orientações ao associado",
    description:
      "Resumo das principais orientações sobre participação, contribuições, campanhas e acompanhamento da Associação.",
    href: "#",
    tag: "Em breve",
  },
  {
    title: "Aviso sobre proteção de dados",
    description:
      "Informações sobre o uso de dados pessoais no sistema da Associação, especialmente para cadastro, identificação e gestão interna.",
    href: "#",
    tag: "Em breve",
  },
];

export default function AreaDocumentosPage() {
  return (
    <ProtectedArea>
      <div className="rounded-[2rem] bg-[#13233a] p-6 text-white shadow-xl shadow-slate-900/10 md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
          Minha área
        </p>

        <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] md:text-5xl">
          Documentos
        </h1>

        <p className="mt-4 max-w-3xl leading-7 text-white/75">
          Consulte documentos importantes da AAD Direito 2028, orientações e
          informações liberadas aos interessados e associados.
        </p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {documents.map((document) => {
          const available = document.href !== "#";

          return (
            <article
              key={document.title}
              className="rounded-3xl border border-[#e8dccb] bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="rounded-full bg-[#f7f8fa] px-3 py-1.5 text-xs font-black uppercase tracking-[0.08em] text-[#596579]">
                    {document.tag}
                  </span>

                  <h2 className="mt-5 text-2xl font-black tracking-[-0.04em]">
                    {document.title}
                  </h2>
                </div>

                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#13233a] text-xl text-[#c7a56b]">
                  📄
                </div>
              </div>

              <p className="mt-4 leading-7 text-[#596579]">
                {document.description}
              </p>

              {available ? (
                <a
                  href={document.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex rounded-full bg-[#13233a] px-6 py-3 text-sm font-black uppercase tracking-[0.1em] text-white"
                >
                  Abrir documento
                </a>
              ) : (
                <span className="mt-6 inline-flex rounded-full border border-[#e8dccb] bg-[#f7f8fa] px-6 py-3 text-sm font-black uppercase tracking-[0.1em] text-[#596579]">
                  Em breve
                </span>
              )}
            </article>
          );
        })}
      </div>

      <div className="mt-8 rounded-3xl border border-[#e8dccb] bg-[#fffaf1] p-6 shadow-sm">
        <h2 className="text-2xl font-black tracking-[-0.04em]">
          Atenção
        </h2>

        <p className="mt-3 leading-7 text-[#596579]">
          Alguns documentos disponibilizados nesta área poderão possuir versão
          pública, com supressão de dados pessoais, assinaturas e informações
          internas, em observância à proteção de dados e à segurança dos
          associados.
        </p>
      </div>
    </ProtectedArea>
  );
}
