import Link from "next/link";
import { exigirSessao } from "@/lib/sessao";
import { impedimentoParaExcluir, resumoDaConta } from "@/lib/exclusao-de-conta";
import { Aviso, Cartao, Titulo } from "@/components/ui";
import { FormularioExclusao } from "./formulario";
import { PopupOrganizador } from "./popup-organizador";

export const metadata = { title: "Excluir minha conta" };

/**
 * Página própria, e não um botão no fim de "Meus dados".
 *
 * A operação não tem desfazer nem prazo de arrependimento. Isso precisa de
 * espaço para ser lido antes, não de um cartão espremido no rodapé de outra
 * tela.
 */
export default async function PaginaExcluirConta() {
  const sessao = await exigirSessao();
  const [impedimento, resumo] = await Promise.all([
    impedimentoParaExcluir(sessao.usuarioId),
    resumoDaConta(sessao.usuarioId),
  ]);

  if (impedimento) {
    return (
      <>
        {/* O popup interrompe o fluxo assim que a página carrega; o conteúdo
            abaixo permanece para quem fechar o diálogo e para leitores de tela
            que já tenham passado por ele. */}
        <PopupOrganizador motivo={impedimento === "ORGANIZADOR" ? "ORGANIZADOR" : "OUTROS"} />

        <Link href="/conta/privacidade" className="text-sm text-texto-2 hover:text-violeta">
          ← Meus dados
        </Link>
        <Titulo className="mt-4">Excluir minha conta</Titulo>

        <div className="mt-8 space-y-4">
          <Aviso tom="erro" titulo="Esta conta não pode ser excluída por aqui">
            {impedimento === "ORGANIZADOR" ? (
              <>
                Contas de organizador respondem por eventos publicados, arquivos enviados e
                lançamentos de presença de outras pessoas. Excluí-la derrubaria páginas públicas e
                comprometeria certificados de terceiros. A exclusão precisa vir depois da destinação
                desses eventos.
              </>
            ) : (
              <>
                Há eventos ou arquivos sob a responsabilidade desta conta. A exclusão precisa vir
                depois da destinação deles.
              </>
            )}
          </Aviso>
          <p className="text-sm text-texto-2">
            Abra um{" "}
            <Link href="/conta/chamados/novo" className="font-semibold text-violeta">
              chamado
            </Link>{" "}
            para tratar o pedido.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <Link href="/conta/privacidade" className="text-sm text-texto-2 hover:text-violeta">
        ← Meus dados
      </Link>

      <Titulo className="mt-4">Excluir minha conta</Titulo>
      <p className="mt-3 text-sm text-texto-2">
        A exclusão apaga sua conta e os dados ligados a ela do banco da PlanA. Não é uma marcação de
        conta inativa com os dados guardados por trás: as linhas saem mesmo, na hora, sem prazo de
        arrependimento e sem como recuperá-las depois.
      </p>

      <section className="mt-8">
        <Titulo nivel={2}>O que será apagado</Titulo>
        <Cartao className="mt-4">
          <p className="text-sm text-tinta">
            Saem do banco seu nome, e-mail, senha, perfil, telefone, código pessoal de participante,
            os {resumo.consentimentosAtivos} consentimento(s) ativo(s) e todo o histórico deles,{" "}
            {resumo.inscricoesAtivas} inscrição(ões) ativa(s), {resumo.presencas} registro(s) de
            presença, {resumo.notificacoes} notificação(ões), {resumo.chamados} chamado(s) de
            suporte com todas as mensagens, as assinaturas de notificação push e qualquer pedido de
            redefinição de senha pendente.
          </p>
          <p className="mt-4 text-sm text-texto-2">
            Nenhum desses dados fica em cópia à espera de prazo. Isso é o que a política de proteção
            de dados da PlanA determina, e é o que a exclusão faz.
          </p>
        </Cartao>
      </section>

      <section className="mt-10">
        <Titulo nivel={2}>Certificados já emitidos</Titulo>
        {resumo.certificados > 0 ? (
          <>
            <Cartao className="mt-4">
              <p className="text-sm text-tinta">
                Seus {resumo.certificados} certificado(s) continuam validáveis, e o seu nome não
                fica guardado.
              </p>
              <p className="mt-3 text-sm text-texto-2">
                Cada certificado traz um código impresso e um QR que leva à consulta pública de
                autenticidade — é por ali que uma instituição confere se o documento é verdadeiro.
                Depois da exclusão, essa consulta deixa de exibir qualquer nome. Ela passa a mostrar
                apenas o evento, a data, a carga horária e as organizadoras, e oferece um campo para
                quem estiver conferindo digitar o nome que lê no documento em mãos. A plataforma
                responde só se confere ou não.
              </p>
              <p className="mt-3 text-sm text-texto-2">
                O que fica guardado do seu nome é um hash — um valor que não se lê nem se lista, e
                que só serve para confirmar um nome que a pessoa já tenha diante dos olhos. Ninguém
                consegue partir desse registro para descobrir quem participou de quê.
              </p>
            </Cartao>
            <div className="mt-4">
              <Aviso titulo="Baixe antes o que quiser guardar">
                Sem conta não há área do participante, e você deixa de conseguir emitir o PDF de
                novo. Os certificados que já baixou continuam com você e continuam válidos.
              </Aviso>
            </div>
          </>
        ) : (
          <Cartao className="mt-4">
            <p className="text-sm text-texto-2">
              Não há certificado emitido nesta conta. Nada a preservar: a exclusão apaga tudo.
            </p>
          </Cartao>
        )}
      </section>

      <section className="mt-10">
        <Titulo nivel={2}>Confirmação</Titulo>
        <FormularioExclusao />
      </section>
    </>
  );
}
