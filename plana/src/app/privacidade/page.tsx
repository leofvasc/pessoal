import Link from "next/link";
import { Logotipo } from "@/components/marca/Logotipo";
import { Cartao, Etiqueta, Titulo } from "@/components/ui";
import { TOLERANCIA_METROS } from "@/lib/geo";
import { DIAS_LIMITE_SEM_EMISSAO } from "@/lib/retencao";

export const metadata = {
  title: "Como tratamos seus dados",
  description:
    "Que dados a PlanA coleta, para quê, por quanto tempo, e como pedir a exclusão.",
};

/**
 * Página de transparência.
 * Planejamento, seção 9: página própria dedicada a explicar, em linguagem
 * acessível, como os dados dos usuários são tratados.
 *
 * Os números citados vêm dos módulos que efetivamente os aplicam, e não de
 * constantes copiadas — assim a página não descreve uma regra diferente da que
 * o código executa.
 */
const DADOS = [
  {
    dado: "Nome completo",
    finalidade: "Identificar você e imprimir seu nome no certificado.",
    retencao: "Enquanto a conta existir.",
  },
  {
    dado: "E-mail",
    finalidade: "Entrar na plataforma e, com sua autorização, receber avisos urgentes do evento.",
    retencao: "Enquanto a conta existir.",
  },
  {
    dado: "Senha",
    finalidade: "Proteger o acesso à sua conta.",
    retencao: "Guardada apenas como hash bcrypt — nem o titular da plataforma consegue lê-la.",
  },
  {
    dado: "Perfil e complemento",
    finalidade:
      "Compor o relatório do evento por tipo de público e ajustar o conteúdo das próximas edições.",
    retencao: "Enquanto a conta existir.",
  },
  {
    dado: "Telefone",
    finalidade: "Somente avisos urgentes por WhatsApp, e somente se você autorizar.",
    retencao:
      "Só é coletado quando há autorização. Revogada a autorização, o campo perde a finalidade e é apagado.",
  },
  {
    dado: "Localização no check-in",
    finalidade: `Conferir que você está a até ${TOLERANCIA_METROS} metros do local do evento no momento em que lê o QR Code.`,
    retencao: `Apagada quando o certificado correspondente é emitido, ou em até ${DIAS_LIMITE_SEM_EMISSAO} dias se o certificado nunca for emitido. O registro de que houve presença permanece; a coordenada, não.`,
  },
  {
    dado: "Inscrição, presença e certificado",
    finalidade:
      "São o serviço em si — sem eles não há como emitir nem validar o seu certificado depois.",
    retencao:
      "Permanecem enquanto a conta existir. Excluída a conta, resta apenas o registro que mantém validável o certificado já emitido — sem o seu nome em texto legível.",
  },
  {
    dado: "Pedido de redefinição de senha",
    finalidade: "Entregar por e-mail um link individual para criar uma nova senha.",
    retencao: "O token é guardado somente como hash, expira em 30 minutos e é excluído pela varredura diária de retenção.",
  },
] as const;

export default function PaginaPrivacidade() {
  return (
    <>
      <header className="border-b border-linha bg-white">
        <div className="mx-auto max-w-3xl px-6 py-5">
          <Link href="/">
            <Logotipo altura={24} />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <Etiqueta>transparência</Etiqueta>
        <Titulo className="mt-3">Como tratamos seus dados</Titulo>
        <p className="mt-4 text-sm text-texto-2">
          A PlanA foi construída com coleta mínima: cada campo pedido tem uma finalidade
          determinada, informada no próprio formulário. O que não tiver finalidade, não é pedido —
          e o que cumprir a sua é apagado.
        </p>

        <section className="mt-12">
          <Titulo nivel={2}>O que coletamos e para quê</Titulo>
          <ul className="mt-6 space-y-3">
            {DADOS.map((linha) => (
              <li key={linha.dado}>
                <Cartao>
                  <h3 className="text-base font-bold tracking-[-0.01em]">{linha.dado}</h3>
                  <p className="mt-2 text-sm text-tinta">{linha.finalidade}</p>
                  <p className="mt-2 text-sm text-texto-2">
                    <span className="etiqueta">retenção</span> {linha.retencao}
                  </p>
                </Cartao>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <Titulo nivel={2}>Consentimento por finalidade</Titulo>
          <p className="mt-4 text-sm text-texto-2">
            As autorizações são separadas: você pode aceitar avisos por e-mail e recusar WhatsApp,
            ou aceitar a leitura de localização e nada mais. Cada aceite fica registrado com o texto
            exato que você leu na hora, e pode ser revogado a qualquer momento em{" "}
            <Link href="/conta/privacidade" className="font-semibold text-violeta">
              Meus dados
            </Link>
            , sem perder o acesso aos eventos nem aos certificados já emitidos.
          </p>
          <p className="mt-4 text-sm text-texto-2">
            Recusar a leitura de localização impede apenas o registro de presença pelo QR Code — a
            organização do evento continua podendo lançar sua presença manualmente.
          </p>
        </section>

        <section className="mt-12">
          <Titulo nivel={2}>O que não fazemos</Titulo>
          <ul className="mt-4 space-y-2 text-sm text-texto-2">
            <li>Não rastreamos sua localização fora do momento do check-in.</li>
            <li>Não vendemos nem cedemos seus dados. Operadores recebem apenas o mínimo necessário para serviços como a entrega do e-mail de redefinição de senha.</li>
            <li>Não usamos seus dados para publicidade.</li>
            <li>Não guardamos o PDF do certificado — ele é montado a cada download.</li>
          </ul>
        </section>

        <section className="mt-12">
          <Titulo nivel={2}>Exclusão da conta</Titulo>
          <p className="mt-4 text-sm text-texto-2">
            A exclusão é feita por você mesmo, em{" "}
            <Link href="/conta/excluir" className="font-semibold text-violeta">
              Meus dados
            </Link>
            , sem depender de pedido nem de resposta da plataforma. Ela apaga do banco a conta e os
            dados ligados a ela: nome, e-mail, senha, perfil, telefone, código pessoal,
            consentimentos e todo o histórico deles, inscrições, presenças, notificações,
            assinaturas de notificação push, chamados de suporte e mensagens. Não é marcação de
            conta inativa com os dados guardados por trás — as linhas saem, e não há cópia à espera
            de prazo. Isso decorre da política de proteção de dados da PlanA, não de pedido caso a
            caso.
          </p>
          <p className="mt-4 text-sm text-texto-2">
            Sobra uma coisa, e uma só: a validação do certificado já emitido. Ele tem código
            impresso e circula em poder de terceiros — a instituição que o recebeu, a banca que o
            avaliou. Apagar também esse registro faria a PlanA passar a responder que o código não
            existe, para um documento verdadeiro que ela mesma emitiu, prejudicando quem nem
            participou da decisão de excluir.
          </p>
          <p className="mt-4 text-sm text-texto-2">
            A validação, então, permanece — sem o seu nome. Do certificado ficam o evento, a data, a
            carga horária, as organizadoras e o método da presença, que são dados sobre a atividade
            realizada. Do seu nome fica apenas um hash: um valor que não se lê nem se lista, e do
            qual não se volta para uma pessoa. A consulta pública deixa de exibir nome e passa a
            oferecer um campo para quem estiver conferindo digitar o nome que lê no documento em
            mãos; a plataforma responde só se confere ou não. Quem tem o certificado impresso já vê
            o nome nele — o registro não entrega nada além disso.
          </p>
          <p className="mt-4 text-sm text-texto-2">
            Como esse registro não guarda dado pessoal legível, ele não depende de escolha sua: não
            há o que eliminar, e apagá-lo só retiraria de terceiros a prova em que confiaram.
          </p>
          <p className="mt-4 text-sm text-texto-2">
            Em qualquer dos dois casos, o total de inscritos e de presentes de cada evento é
            preservado como número agregado, sem nome nem identificador — é registro da atividade
            realizada, não dado sobre pessoa.
          </p>
        </section>

        <section className="mt-12">
          <Titulo nivel={2}>Encarregado pelo tratamento de dados pessoais</Titulo>
          <Cartao className="mt-4">
            <Etiqueta>identidade</Etiqueta>
            <p className="mt-2 text-base font-bold text-tinta">Leonardo Fontes Vasconcelos</p>
            <Etiqueta className="mt-5 block">canal de contato</Etiqueta>
            <Link href="/conta/chamados/novo" className="mt-2 inline-block text-sm font-semibold text-violeta hover:text-profundo">
              Central de chamados da PlanA
            </Link>
          </Cartao>
          <p className="mt-4 text-sm text-texto-2">
            Reclamações, comunicações e pedidos de acesso ou correção de dados podem ser feitos pela abertura de{" "}
            <Link href="/conta/chamados/novo" className="font-semibold text-violeta">
              chamado na sua conta
            </Link>. É necessário entrar para abrir e acompanhar o atendimento.
          </p>
        </section>
      </main>

      <footer className="border-t border-linha bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-6">
          <Logotipo altura={18} />
          <Link href="/cookies" className="text-xs text-texto-2 hover:text-violeta">Cookies</Link>
        </div>
      </footer>
    </>
  );
}
