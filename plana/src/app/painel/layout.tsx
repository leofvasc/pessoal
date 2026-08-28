import { redirect } from "next/navigation";
import Link from "next/link";
import { sessaoAtual } from "@/lib/sessao";
import { Logotipo } from "@/components/marca/Logotipo";
import { sair } from "@/app/acoes-conta";

export default async function LayoutPainel({ children }: LayoutProps<"/painel">) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/entrar");
  if (sessao.papel !== "ORGANIZADOR") redirect("/conta");

  return (
    <>
      <header className="border-b border-linha bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/painel" className="flex items-center gap-3">
            <Logotipo altura={22} />
            <span className="etiqueta text-texto-2">painel</span>
          </Link>
          <nav className="flex items-center gap-5">
            <Link
              href="/painel/instituicoes"
              className="text-sm text-texto-2 hover:text-violeta"
            >
              Instituições
            </Link>
            <form action={sair}>
              <button className="text-sm text-texto-2 hover:text-violeta">Sair</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </>
  );
}
