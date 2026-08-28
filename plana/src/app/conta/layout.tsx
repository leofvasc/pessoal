import { redirect } from "next/navigation";
import Link from "next/link";
import { sessaoAtual } from "@/lib/sessao";
import { contarNaoLidas } from "@/lib/notificacoes";
import { Logotipo } from "@/components/marca/Logotipo";
import { sair } from "@/app/acoes-conta";
import { RegistrarServiceWorker } from "@/components/RegistrarServiceWorker";

const ABAS = [
  { href: "/conta", rotulo: "Eventos" },
  { href: "/conta/certificados", rotulo: "Certificados" },
  { href: "/conta/notificacoes", rotulo: "Notificações" },
  { href: "/conta/privacidade", rotulo: "Meus dados" },
] as const;

export default async function LayoutConta({ children }: LayoutProps<"/conta">) {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/entrar");

  const naoLidas = await contarNaoLidas(sessao.usuarioId);

  return (
    <>
      {/* O service worker é pré-requisito para a instalação em tela de início —
          e, no iPhone, a instalação é pré-requisito para o push. */}
      <RegistrarServiceWorker />

      <header className="border-b border-linha bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/conta">
            <Logotipo altura={22} />
          </Link>
          <form action={sair}>
            <button className="text-sm text-texto-2 hover:text-violeta">Sair</button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4 pb-1">
          {ABAS.map((aba) => (
            <Link
              key={aba.href}
              href={aba.href}
              className="rounded-lg px-3 py-2 text-sm text-texto-2 hover:bg-superficie hover:text-violeta"
            >
              {aba.rotulo}
              {aba.href === "/conta/notificacoes" && naoLidas > 0 ? (
                <span className="ml-2 rounded-full bg-violeta px-2 py-0.5 text-xs font-semibold text-white">
                  {naoLidas}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</main>
    </>
  );
}
