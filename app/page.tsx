import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f8fa] px-6 py-10 text-[#13233a]">
      <section className="mx-auto flex min-h-[calc(100vh-80px)] max-w-6xl items-center">
        <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="inline-flex rounded-full border border-[#e8dccb] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#c7a56b] shadow-sm">
              Sistema administrativo
            </div>

            <h1 className="mt-8 text-5xl font-black tracking-[-0.06em] text-[#13233a] md:text-7xl">
              Painel AAD 2028
            </h1>

            <p className="mt-6 max-w-2xl text-xl leading-8 text-[#596579]">
              Sistema de gestão administrativa e financeira da AAD Direito 2028,
              voltado ao controle de associados, mensalidades, receitas,
              despesas, comprovantes e prestação de contas.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="rounded-full bg-[#13233a] px-8 py-4 text-center text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5"
              >
                Entrar no painel
              </Link>

              <div className="rounded-full border border-[#e8dccb] bg-white px-8 py-4 text-center text-sm font-black uppercase tracking-[0.12em] text-[#13233a] shadow-sm">
                Acesso restrito
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#e8dccb] bg-white p-6 shadow-xl shadow-slate-900/8">
            <div className="rounded-[1.5rem] bg-[#13233a] p-8 text-white">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
                Módulos planejados
              </p>

              <div className="mt-8 grid gap-4">
                {[
                  "Associados",
                  "Mensalidades",
                  "Pagamentos",
                  "Receitas e despesas",
                  "Inadimplência",
                  "Relatórios",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-white/10 bg-white/8 px-5 py-4 font-bold"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-[#f7f8fa] p-5 text-sm leading-6 text-[#596579]">
              Ambiente em implantação. As informações financeiras e os dados dos
              associados serão tratados em área protegida, com controle de acesso
              por perfil.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
