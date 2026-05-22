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
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-5 py-8 md:px-8">
        <div className="border-b border-[#e6ded2] pb-5">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#a98246]">
            AAD Direito 2028
          </p>
        </div>

        <div className="grid gap-8 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <section>
            <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.07em] text-[#13233a] md:text-7xl">
              Acesso ao sistema
            </h1>

            <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-[#596579] md:text-lg">
              Ambiente restrito da Associação dos Acadêmicos do Curso de Direito –
              Turma de Formatura 2028.
            </p>

            <div className="mt-8 grid gap-3 sm:max-w-2xl sm:grid-cols-2">
              <Link
                href="/area"
                className="rounded-2xl bg-[#13233a] px-5 py-4 text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-[#0c1728]"
              >
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#c7a56b]">
                  Associado
                </p>

                <p className="mt-2 text-lg font-black">
                  Já tenho conta
                </p>

                <p className="mt-2 text-sm leading-6 text-white/70">
                  Acesse sua área para consultar dados, financeiro, pagamentos,
                  contribuições e avisos.
                </p>
              </Link>

              <Link
                href="/cadastro"
                className="rounded-2xl border border-[#d8cbb7] bg-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:bg-[#fffaf1]"
              >
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a98246]">
                  Primeiro acesso
                </p>

                <p className="mt-2 text-lg font-black text-[#13233a]">
                  Criar cadastro
                </p>

                <p className="mt-2 text-sm leading-6 text-[#596579]">
                  Crie sua conta para solicitar associação e acompanhar sua
                  solicitação pelo sistema.
                </p>
              </Link>
            </div>

            <div className="mt-3 sm:max-w-2xl">
              <Link
                href="/login"
                className="flex items-center justify-between gap-3 rounded-2xl border border-[#e6ded2] bg-white/70 px-5 py-3 text-sm font-bold text-[#596579] transition hover:bg-white hover:text-[#13233a]"
              >
                <span>Sou da Diretoria, Tesouraria ou Secretaria</span>
                <span className="font-black text-[#13233a]">Entrar no painel</span>
              </Link>
            </div>
          </section>

          <aside className="rounded-3xl border border-[#e6ded2] bg-white/70 p-5 shadow-sm lg:p-6">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#a98246]">
              Estrutura
            </p>

            <div className="mt-5 divide-y divide-[#e6ded2]">
              {items.map((item) => (
                <div key={item} className="py-3 first:pt-0">
                  <p className="text-sm font-bold text-[#596579]">{item}</p>
                </div>
              ))}
            </div>

            <p className="mt-5 rounded-2xl bg-[#f8f7f4] px-4 py-3 text-sm font-medium leading-7 text-[#596579]">
              O acesso às funcionalidades é liberado conforme o perfil definido
              pela Associação.
            </p>
          </aside>
        </div>

        <footer className="border-t border-[#e6ded2] pt-5">
          <div className="flex flex-col gap-2 text-xs font-bold text-[#596579] md:flex-row md:items-center md:justify-between">
            <p>Gestão com responsabilidade e transparência.</p>
            <p>Ambiente restrito aos usuários autorizados.</p>
          </div>
        </footer>
      </section>
    </main>
  );
}
