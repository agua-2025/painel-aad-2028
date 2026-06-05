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
          <Link href="/" className="inline-flex">
              <img
                src="/brand/aad-login-logo.png"
                alt="AAD Direito 2028"
                className="h-auto max-h-[44px] w-auto max-w-[260px] object-contain"
              />
            </Link>
        </div>

        <div className="grid gap-8 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <section>
            <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-[-0.07em] text-[#13233a] md:text-7xl">
              Acesso ao sistema
            </h1>

            <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-[#596579] md:text-lg">
              Ambiente restrito da Associação dos Acadêmicos do Curso de Direito
              – Turma de Formatura 2028.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:max-w-xl sm:flex-row">
              <Link
                href="/login"
                className="inline-flex flex-1 items-center justify-center rounded-full bg-[#13233a] px-6 py-3.5 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-slate-900/10 transition hover:bg-[#0c1728]"
              >
                Entrar no sistema
              </Link>

              <Link
                href="/cadastro"
                className="inline-flex flex-1 items-center justify-center rounded-full border border-[#d8cbb7] bg-white px-6 py-3.5 text-sm font-black uppercase tracking-[0.12em] text-[#13233a] shadow-sm transition hover:bg-[#fffaf1]"
              >
                Criar cadastro
              </Link>
            </div>

            <p className="mt-4 max-w-xl text-sm font-medium leading-7 text-[#596579]">
              Entre com sua conta para acessar o sistema. Se ainda não possui
              cadastro, crie sua conta para solicitar associação.
            </p>
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
