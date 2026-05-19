import Link from "next/link";

const items = [
  "Associados e solicitações",
  "Mensalidades e contribuições extras",
  "Informes de pagamento",
  "Receitas, despesas e saldos",
  "Relatórios e prestação de contas",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8f7f4] text-[#13233a]">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-5 py-8 md:px-8">
        <div className="border-b border-[#e6ded2] pb-5">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#a98246]">
            AAD Direito 2028
          </p>
        </div>

        <div className="grid gap-10 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <section>
            <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.07em] text-[#13233a] md:text-7xl">
              Painel administrativo
            </h1>

            <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-[#596579] md:text-lg">
              Ambiente restrito para organização administrativa e financeira da
              Associação dos Acadêmicos do Curso de Direito – Turma de Formatura
              2028.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/login"
                className="text-sm font-black uppercase tracking-[0.16em] text-[#13233a] underline decoration-[#c7a56b] decoration-2 underline-offset-8 transition hover:text-[#a98246]"
              >
                Entrar no painel
              </Link>

              <span className="hidden h-4 w-px bg-[#d8cbb7] sm:block" />

              <Link
                href="/area"
                className="text-sm font-black uppercase tracking-[0.16em] text-[#596579] underline decoration-[#d8cbb7] decoration-2 underline-offset-8 transition hover:text-[#13233a]"
              >
                Área do associado
              </Link>
            </div>
          </section>

          <aside className="border-l-0 border-[#e6ded2] lg:border-l lg:pl-8">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#a98246]">
              Estrutura
            </p>

            <div className="mt-5 space-y-3">
              {items.map((item) => (
                <div key={item} className="border-b border-[#e6ded2] pb-3">
                  <p className="text-sm font-bold text-[#596579]">{item}</p>
                </div>
              ))}
            </div>

            <p className="mt-6 text-sm font-medium leading-7 text-[#596579]">
              O acesso é liberado conforme o perfil administrativo definido pela
              Associação.
            </p>
          </aside>
        </div>

        <footer className="border-t border-[#e6ded2] pt-5">
          <div className="flex flex-col gap-2 text-xs font-bold text-[#596579] md:flex-row md:items-center md:justify-between">
            <p>Gestão com responsabilidade e transparência.</p>
            <p>Ambiente restrito aos perfis autorizados.</p>
          </div>
        </footer>
      </section>
    </main>
  );
}
