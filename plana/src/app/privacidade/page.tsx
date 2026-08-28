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
    retencao: "Permanecem enquanto a conta existir, porque é isso que dá validade ao certificado.",
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
            <li>Não vendemos, cedemos nem compartilhamos seus dados com terceiros.</li>
            <li>Não usamos seus dados para publicidade.</li>
            <li>Não guardamos o PDF do certificado — ele é montado a cada download.</li>
          </ul>
        </section>

        <section className="mt-12">
          <Titulo nivel={2}>Encarregado de dados</Titulo>
          <p className="mt-4 text-sm text-texto-2">
            A função de encarregado (DPO) é exercida pelo próprio titular da plataforma. Pedidos de
            acesso, correção ou exclusão de dados podem ser feitos pela abertura de chamado na sua
            conta.
          </p>
        </section>
      </main>

      <footer className="border-t border-linha bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-6">
          <Logotipo altura={18} />
        </div>
      </footer>
    </>
  );
}
