import Link from "next/link";
import { Logotipo } from "@/components/marca/Logotipo";
import { Aviso, BotaoLink, Titulo } from "@/components/ui";

export const metadata = { title: "Conta excluída", robots: { index: false } };

/**
 * Fica fora de /conta de propósito: o layout daquela área exige sessão, e neste
 * ponto a sessão já foi encerrada junto com a conta.
 */
export default function PaginaContaExcluida() {
  return (
    <>
      <header className="border-b border-linha bg-white">
        <div className="mx-auto max-w-2xl px-6 py-5">
          <Link href="/">
            <Logotipo altura={24} />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <Titulo>Conta excluída</Titulo>

        <div className="mt-6">
          <Aviso tom="sucesso" titulo="Os dados foram apagados">
            Sua conta e os dados ligados a ela saíram do banco da PlanA. Não ficou cópia à espera de
            prazo, e a sessão neste aparelho foi encerrada.
          </Aviso>
        </div>

        <p className="mt-6 text-sm text-texto-2">
          Se você optou por manter os certificados validáveis, o registro de validação de cada um
          continua respondendo na consulta pública, com o mesmo código impresso no documento. Se
          optou por apagá-los, os códigos deixaram de existir.
        </p>

        <p className="mt-4 text-sm text-texto-2">
          Nada impede que você crie uma conta nova mais tarde — ela começa vazia, sem inscrições,
          presenças ou certificados anteriores.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <BotaoLink href="/">Ver eventos</BotaoLink>
          <BotaoLink href="/privacidade" tom="secundario">
            Como tratamos os dados
          </BotaoLink>
        </div>
      </main>

      <footer className="border-t border-linha bg-white">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-4 px-6 py-6">
          <Logotipo altura={18} />
          <Link href="/cookies" className="text-xs text-texto-2 hover:text-violeta">
            Cookies
          </Link>
        </div>
      </footer>
    </>
  );
}
