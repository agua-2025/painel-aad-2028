import Link from "next/link";

export default function AssociarPage() {
  return (
    <main className="min-h-screen bg-[#f7f8fa] px-6 py-10 text-[#13233a]">
      <section className="mx-auto flex min-h-[calc(100vh-80px)] max-w-4xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-[#e8dccb] bg-white p-6 shadow-xl shadow-slate-900/8 md:p-10">
          <div className="rounded-[1.7rem] bg-[#13233a] p-6 text-white md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-[#c7a56b]">
              AAD Direito 2028
            </p>

            <h1 className="mt-4 text-3xl font-black tracking-[-0.05em] md:text-5xl">
              Solicite sua associação
            </h1>

            <p className="mt-4 max-w-2xl leading-7 text-white/75">
              Para continuar, crie sua conta ou acesse com seu e-mail e senha.
              Após entrar, você poderá preencher sua solicitação, acompanhar a
              análise e, se aprovado, acessar sua área de associado.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Link
              href="/cadastro"
              className="rounded-3xl bg-[#13233a] p-6 text-white transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <p className="text-2xl font-black tracking-[-0.04em]">
                Criar minha conta
              </p>

              <p className="mt-3 leading-7 text-white/75">
                Primeiro acesso para acadêmicos interessados em solicitar
                ingresso na Associação.
              </p>
            </Link>

            <Link
              href="/login"
              className="rounded-3xl border border-[#e8dccb] bg-[#f7f8fa] p-6 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <p className="text-2xl font-black tracking-[-0.04em]">
                Já tenho conta
              </p>

              <p className="mt-3 leading-7 text-[#596579]">
                Acesse sua área para acompanhar solicitação, pendências,
                pagamentos e informações da Associação.
              </p>
            </Link>
          </div>

          <p className="mt-6 text-sm leading-6 text-[#596579]">
            Antes de solicitar o ingresso, consulte no site institucional o
            Estatuto Social, documentos e orientações da AAD Direito 2028.
          </p>
        </div>
      </section>
    </main>
  );
}
