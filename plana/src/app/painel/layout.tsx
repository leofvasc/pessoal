import { redirect } from "next/navigation";
import Link from "next/link";
import { sessaoAtual, temPainel } from "@/lib/sessao";
import { Logotipo } from "@/components/marca/Logotipo";
import { sair } from "@/app/acoes-conta";

export default async function LayoutPainel({ children }: LayoutProps<"/painel">) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/entrar");
  if (!temPainel(sessao.papel)) redirect("/conta");

  return (
    <>
      <header className="border-b border-linha bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/painel" className="flex items-center gap-3">
            <Logotipo altura={22} />
            <span className="etiqueta text-texto-2">painel</span>
          </Link>
          <form action={sair}>
            <button className="text-sm text-texto-2 hover:text-violeta">Sair</button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-1">
          <Link
            href="/"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-texto-2 hover:bg-superficie hover:text-violeta"
          >
            Início
          </Link>
          <Link
            href="/painel"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-texto-2 hover:bg-superficie hover:text-violeta"
          >
            Eventos
          </Link>
          <Link
            href="/painel/instituicoes"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-texto-2 hover:bg-superficie hover:text-violeta"
          >
            Instituições
          </Link>
          <Link
            href="/painel/relatorios"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-texto-2 hover:bg-superficie hover:text-violeta"
          >
            Relatórios
          </Link>
          <Link
            href="/painel/chamados"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-texto-2 hover:bg-superficie hover:text-violeta"
          >
            Chamados
          </Link>
          <Link
            href="/painel/configuracoes"
            className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-texto-2 hover:bg-superficie hover:text-violeta"
          >
            Configurações
          </Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </>
  );
}
