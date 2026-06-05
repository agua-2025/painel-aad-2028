import Link from "next/link";

export default function AssociarPage() {
  return (
    <main className="min-h-screen bg-[#f7f8fa] px-5 py-8 text-[#13233a] md:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-64px)] max-w-3xl items-center justify-center">
        <div className="w-full rounded-3xl border border-[#e8dccb] bg-white p-5 shadow-xl shadow-slate-900/10 md:p-6">
          <div className="rounded-3xl bg-[#13233a] p-5 text-white md:p-6">
            <div className="mb-5 flex w-fit items-center justify-center rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-white/20">
              <img
                src="/brand/aad-login-logo.png"
                alt="AAD Direito 2028"
                className="h-auto max-h-[44px] w-full max-w-[260px] object-contain"
              />
            </div>

            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#c7a56b]">
              Associação
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] md:text-4xl">
              Solicite sua associação
            </h1>

            <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-white/75">
              Para continuar, crie sua conta ou acesse com seu e-mail e senha.
              Após entrar, você poderá preencher sua solicitação, acompanhar a
              análise e, se aprovado, acessar sua área de associado.
            </p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Link
              href="/cadastro"
              className="rounded-3xl bg-[#13233a] p-5 text-white transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <p className="text-xl font-black tracking-[-0.03em]">
                Criar minha conta
              </p>

              <p className="mt-3 text-sm font-medium leading-7 text-white/75">
                Primeiro acesso para acadêmicos interessados em solicitar
                ingresso na Associação.
              </p>
            </Link>

            <Link
              href="/login"
              className="rounded-3xl border border-[#e8dccb] bg-[#f7f8fa] p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <p className="text-xl font-black tracking-[-0.03em]">
                Já tenho conta
              </p>

              <p className="mt-3 text-sm font-medium leading-7 text-[#596579]">
                Acesse sua área para acompanhar solicitação, pendências,
                pagamentos e informações da Associação.
              </p>
            </Link>
          </div>

          <p className="mt-5 text-sm font-medium leading-6 text-[#596579]">
            Antes de solicitar o ingresso, consulte no site institucional o
            Estatuto Social, documentos e orientações da AAD Direito 2028.
          </p>
        </div>
      </section>
    </main>
  );
}
