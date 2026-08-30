import type { Metadata } from "next";
import Link from "next/link";
import { Logotipo } from "@/components/marca/Logotipo";
import { Aviso, Cartao, Etiqueta, Titulo } from "@/components/ui";

export const metadata: Metadata = {
  title: "Cookies",
  description: "Informações sobre o único cookie utilizado pela PlanA.",
};

export default function PaginaCookies() {
  return (
    <>
      <header className="border-b border-linha bg-white">
        <div className="mx-auto max-w-3xl px-6 py-5">
          <Link href="/" aria-label="Página inicial da PlanA"><Logotipo altura={24} /></Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <Etiqueta>transparência</Etiqueta>
        <Titulo className="mt-3">Cookies na PlanA</Titulo>
        <p className="mt-4 text-sm text-texto-2">
          A PlanA utiliza somente um cookie estritamente necessário para manter a sessão depois que você entra na plataforma. Não usamos cookies de publicidade, rastreamento, análise de comportamento ou medição de audiência.
        </p>

        <section className="mt-10">
          <Cartao>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Etiqueta>cookie necessário</Etiqueta>
                <h2 className="mt-2 font-mono text-base font-medium text-tinta">plana_sessao</h2>
              </div>
              <span className="rounded-full bg-sucesso/10 px-3 py-1 text-xs font-semibold text-sucesso">essencial</span>
            </div>
            <dl className="mt-6 space-y-4 text-sm">
              <div>
                <dt className="font-semibold text-tinta">Finalidade</dt>
                <dd className="mt-1 text-texto-2">Reconhecer a conta autenticada, manter o acesso às áreas protegidas e aplicar as permissões de participante ou organizador.</dd>
              </div>
              <div>
                <dt className="font-semibold text-tinta">Duração</dt>
                <dd className="mt-1 text-texto-2">Até 30 dias, salvo se você sair da conta antes.</dd>
              </div>
              <div>
                <dt className="font-semibold text-tinta">Conteúdo e proteção</dt>
                <dd className="mt-1 text-texto-2">Contém um token assinado com identificador, nome e papel da conta. Não contém e-mail, telefone ou senha. É inacessível a scripts da página, usa SameSite=Lax e, em produção, trafega apenas por conexão segura.</dd>
              </div>
            </dl>
          </Cartao>
        </section>

        <section className="mt-10">
          <Titulo nivel={2}>Por que não há banner de consentimento</Titulo>
          <p className="mt-4 text-sm text-texto-2">
            Não há escolha a registrar porque nenhum cookie opcional é instalado. O cookie de sessão existe apenas depois da autenticação e é necessário para entregar as funções solicitadas pelo próprio usuário.
          </p>
          <Aviso titulo="Controle pelo navegador">
            Você pode apagar ou bloquear o cookie nas configurações do navegador. Se fizer isso, precisará entrar novamente e as áreas da conta e do painel não funcionarão enquanto o cookie estiver bloqueado.
          </Aviso>
        </section>

        <p className="mt-10 text-sm text-texto-2">
          Para conhecer os demais tratamentos de dados, consulte a{" "}
          <Link href="/privacidade" className="font-semibold text-violeta">página de privacidade</Link>.
        </p>
      </main>

      <footer className="border-t border-linha bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-6">
          <Logotipo altura={18} />
          <Link href="/privacidade" className="text-xs text-texto-2 hover:text-violeta">Privacidade</Link>
        </div>
      </footer>
    </>
  );
}
