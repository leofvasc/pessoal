import { Logotipo } from "@/components/marca/Logotipo";
import { Simbolo } from "@/components/marca/Simbolo";
import { LoopCheckin } from "@/components/marca/LoopCheckin";
import { BotaoLink, Cartao, Etiqueta, Titulo } from "@/components/ui";
import Link from "next/link";

const ETAPAS = [
  {
    numero: "01",
    titulo: "Inscrição",
    texto:
      "O participante se inscreve pelo link do evento e recebe a confirmação na hora, na central de notificações da conta.",
  },
  {
    numero: "02",
    titulo: "Presença",
    texto:
      "No dia, ele lê o QR Code projetado na sala. A leitura é cruzada com o login e com a localização do aparelho.",
  },
  {
    numero: "03",
    titulo: "Certificado",
    texto:
      "Confirmada a presença, o certificado é liberado automaticamente e fica disponível na área do participante.",
  },
];

export default function PaginaInicial() {
  return (
    <>
      <header className="border-b border-linha bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          {/* O descritor sai em telas estreitas: apertado, ele quebraria em duas
              linhas — e o manual manda, na dúvida, tirar elemento. */}
          <Logotipo
            altura={26}
            descritor
            className="[&_.descritor]:hidden sm:[&_.descritor]:block"
          />
          <nav className="flex items-center gap-2">
            <BotaoLink href="/entrar" tom="discreto">
              Entrar
            </BotaoLink>
            <BotaoLink href="/criar-conta">Criar conta</BotaoLink>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="padrao-modulos">
          <div className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-20 sm:grid-cols-[1.4fr_1fr]">
            <div>
              <Etiqueta className="!text-white/70">plataforma de gestão de eventos</Etiqueta>
              <h1 className="mt-4 text-4xl font-extrabold leading-[1.08] tracking-[-0.03em] text-white sm:text-5xl">
                Da inscrição ao certificado,
                <br />
                sem planilha no meio.
              </h1>
              <p className="mt-5 max-w-xl text-white/80">
                Inscrição, registro de presença por leitura de QR Code com geolocalização e emissão
                automática de certificado. Uma ferramenta só, para eventos acadêmicos, capacitações
                institucionais e cursos.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <BotaoLink href="/criar-conta" tom="secundario">
                  Criar conta
                </BotaoLink>
                {/* Link, e não botão: o padding de botão desalinharia o texto
                    em relação ao rótulo do botão ao lado. */}
                <Link
                  href="/privacidade"
                  className="text-sm font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline"
                >
                  Como tratamos seus dados
                </Link>
              </div>
            </div>

            {/* Loop de check-in (manual, seção 11): o movimento oficial da marca,
                usado aqui como o próprio assunto da página. */}
            <div className="flex justify-center">
              <LoopCheckin
                tamanho={168}
                variante="negativo"
                rotulo="Módulos do símbolo PlanA preenchendo a malha, no ritmo do registro de presença"
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-16">
          <Titulo nivel={2}>Como funciona</Titulo>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {ETAPAS.map((etapa) => (
              <Cartao key={etapa.numero}>
                <Etiqueta>{etapa.numero}</Etiqueta>
                <h3 className="mt-3 text-lg font-bold tracking-[-0.01em]">{etapa.titulo}</h3>
                <p className="mt-2 text-sm text-texto-2">{etapa.texto}</p>
              </Cartao>
            ))}
          </div>
        </section>

        <section className="border-y border-linha bg-white">
          <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 sm:grid-cols-2">
            <div>
              <Titulo nivel={2}>Coleta mínima, por princípio</Titulo>
              <p className="mt-4 text-sm text-texto-2">
                Cada dado pedido tem uma finalidade declarada no próprio formulário, com
                consentimento separado por finalidade. A coordenada lida no registro de presença
                serve para conferir que você está no local — e é descartada assim que o certificado
                correspondente é emitido.
              </p>
              <Link
                href="/privacidade"
                className="mt-4 inline-block text-sm font-semibold text-violeta hover:text-profundo"
              >
                Ler a página de transparência →
              </Link>
            </div>
            <div>
              <Titulo nivel={2}>Instale na tela de início</Titulo>
              <p className="mt-4 text-sm text-texto-2">
                A PlanA é um aplicativo web instalável. No iPhone e no iPad, a instalação em tela de
                início é o que permite receber os avisos do evento — o Safari não entrega
                notificação para aba aberta no navegador.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-tinta">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-6 px-6 py-10">
          <div className="flex items-center gap-3">
            <Simbolo tamanho={28} variante="tinta" />
            <span className="text-sm text-white/60">
              PlanA — plataforma independente de gestão de eventos.
            </span>
          </div>
          <nav className="flex gap-6 text-sm text-white/60">
            <Link href="/privacidade" className="hover:text-white">
              Transparência
            </Link>
            <Link href="/validar" className="hover:text-white">
              Validar certificado
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
