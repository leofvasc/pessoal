import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { sessaoAtual, temPainel } from "@/lib/sessao";
import { dataLongaAcre, etiquetaDoisFusos } from "@/lib/fuso";
import { Logotipo } from "@/components/marca/Logotipo";
import { Simbolo } from "@/components/marca/Simbolo";
import { LoopCheckin } from "@/components/marca/LoopCheckin";
import { BotaoLink, Cartao, Etiqueta, Titulo } from "@/components/ui";
import { VitrineEventos, type EventoDaVitrine } from "@/components/VitrineEventos";
import { ROTULO_GRATUITO } from "@/lib/inscricao-valor";
import { situacaoDeVagas, totalmenteEsgotado } from "@/lib/vagas";

const MODALIDADES = { PRESENCIAL: "Presencial", ONLINE: "Online", HIBRIDO: "Híbrido" } as const;

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
] as const;

export const dynamic = "force-dynamic";

export default async function PaginaInicial() {
  const agora = new Date();
  const [eventos, sessao] = await Promise.all([
    prisma.evento.findMany({
      where: { publicado: true, excluidoEm: null },
      select: {
        id: true,
        slug: true,
        nome: true,
        descricao: true,
        inicioEm: true,
        fimEm: true,
        modalidade: true,
        localNome: true,
        meioTransmissao: true,
        bannerArquivoId: true,
        canceladoEm: true,
        vagasPresencial: true,
        vagasOnline: true,
        palestrantes: { orderBy: { ordem: "asc" }, select: { nome: true } },
        instituicoes: {
          orderBy: { ordem: "asc" },
          select: { instituicao: { select: { nome: true } } },
        },
      },
    }),
    sessaoAtual(),
  ]);

  // Uma consulta agregada para toda a vitrine, e não uma por evento: a página
  // é pública e a lista cresce, e vinte consultas de contagem por visita é o
  // tipo de coisa que só aparece quando já está lenta.
  const inscricoesPorEvento = await prisma.inscricao.groupBy({
    by: ["eventoId", "modalidade"],
    where: { canceladaEm: null, evento: { publicado: true, excluidoEm: null } },
    _count: { _all: true },
  });

  const ocupadas = new Map<string, { presencial: number; online: number }>();
  for (const linha of inscricoesPorEvento) {
    const atual = ocupadas.get(linha.eventoId) ?? { presencial: 0, online: 0 };
    if (linha.modalidade === "ONLINE") atual.online += linha._count._all;
    else atual.presencial += linha._count._all;
    ocupadas.set(linha.eventoId, atual);
  }

  const esgotados = new Set(
    eventos
      .filter((evento) => {
        const contagem = ocupadas.get(evento.id) ?? { presencial: 0, online: 0 };
        return totalmenteEsgotado(
          situacaoDeVagas({
            modalidade: evento.modalidade,
            vagasPresencial: evento.vagasPresencial,
            vagasOnline: evento.vagasOnline,
            ocupadasPresencial: contagem.presencial,
            ocupadasOnline: contagem.online,
          }),
        );
      })
      .map((evento) => evento.id),
  );

  eventos.sort((a, b) => {
    const aAberto = !a.canceladoEm && a.fimEm >= agora;
    const bAberto = !b.canceladoEm && b.fimEm >= agora;
    if (aAberto !== bAberto) return aAberto ? -1 : 1;
    return aAberto
      ? a.inicioEm.getTime() - b.inicioEm.getTime()
      : b.inicioEm.getTime() - a.inicioEm.getTime();
  });

  const vitrine: EventoDaVitrine[] = eventos.map((evento) => ({
    id: evento.id,
    slug: evento.slug,
    nome: evento.nome,
    descricao: evento.descricao,
    data: dataLongaAcre(evento.inicioEm),
    horario: etiquetaDoisFusos(evento.inicioEm),
    modalidade: MODALIDADES[evento.modalidade],
    local: evento.modalidade === "ONLINE" ? evento.meioTransmissao || "Evento online" : evento.localNome,
    bannerArquivoId: evento.bannerArquivoId,
    organizadoras: evento.instituicoes.map(({ instituicao }) => instituicao.nome),
    palestrantes: evento.palestrantes.map(({ nome }) => nome),
    inscricao: ROTULO_GRATUITO,
    esgotado: esgotados.has(evento.id),
    estado: evento.canceladoEm ? "CANCELADO" : evento.fimEm < agora ? "ENCERRADO" : "ABERTO",
  }));

  // O número bate com o filtro "inscrições abertas": evento lotado não tem
  // inscrição aberta, e contá-lo aqui faria a estatística prometer vaga que
  // não existe.
  const abertos = vitrine.filter(
    (evento) => evento.estado === "ABERTO" && !evento.esgotado,
  ).length;
  const encerrados = vitrine.filter((evento) => evento.estado !== "ABERTO").length;

  return (
    <>
      <header className="border-b border-linha bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <Link href="/" aria-label="Página inicial da PlanA">
            <Logotipo altura={26} descritor className="[&_.descritor]:hidden sm:[&_.descritor]:block" />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="#eventos" className="hidden px-3 py-2 text-sm font-semibold text-texto-2 hover:text-violeta sm:block">Eventos</a>
            {sessao ? (
              <BotaoLink href={temPainel(sessao.papel) ? "/painel" : "/conta"}>
                {temPainel(sessao.papel) ? "Painel" : "Minha conta"}
              </BotaoLink>
            ) : (
              <>
                <BotaoLink href="/entrar" tom="discreto">Entrar</BotaoLink>
                <BotaoLink href="/criar-conta">Criar conta</BotaoLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="padrao-modulos overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 sm:grid-cols-[1.4fr_1fr] sm:py-20">
            <div>
              <Etiqueta className="!text-white/70">plataforma de gestão de eventos</Etiqueta>
              <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-[-0.03em] text-white sm:text-5xl">
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
                {sessao ? (
                  <BotaoLink
                    href={temPainel(sessao.papel) ? "/painel" : "/conta"}
                    tom="secundario"
                  >
                    {temPainel(sessao.papel) ? "Acessar painel" : "Minha conta"}
                  </BotaoLink>
                ) : (
                  <BotaoLink href="/criar-conta" tom="secundario">
                    Criar conta
                  </BotaoLink>
                )}
                <a
                  href="#eventos"
                  className="text-sm font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline"
                >
                  Explorar eventos
                </a>
                <Link
                  href="/privacidade"
                  className="text-sm font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline"
                >
                  Como tratamos seus dados
                </Link>
              </div>
            </div>
            <div className="flex justify-center">
              <LoopCheckin
                tamanho={168}
                variante="negativo"
                rotulo="Módulos do símbolo PlanA preenchendo a malha, no ritmo do registro de presença"
              />
            </div>
          </div>
        </section>

        <section id="eventos" className="mx-auto max-w-6xl scroll-mt-6 px-6 py-16">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <Etiqueta>agenda pública</Etiqueta>
              <h2 className="mt-3 text-3xl font-extrabold tracking-[-0.03em] text-tinta sm:text-4xl">
                Eventos PlanA
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-texto-2">
                Encontre eventos com inscrições abertas e consulte também o histórico dos que já
                foram encerrados.
              </p>
            </div>
            <div className="flex gap-8 rounded-2xl border border-linha bg-white px-5 py-4">
              <div>
                <p className="font-mono text-xl font-medium text-tinta">{abertos}</p>
                <p className="text-xs text-texto-2">inscrições abertas</p>
              </div>
              <div className="border-l border-linha pl-8">
                <p className="font-mono text-xl font-medium text-tinta">{encerrados}</p>
                <p className="text-xs text-texto-2">no histórico</p>
              </div>
            </div>
          </div>
          <VitrineEventos eventos={vitrine} />
        </section>

        <section className="border-t border-linha bg-white">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <Titulo nivel={2}>Como funciona</Titulo>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {ETAPAS.map((etapa) => (
                <Cartao key={etapa.numero} className="bg-superficie">
                  <Etiqueta>{etapa.numero}</Etiqueta>
                  <h3 className="mt-3 text-lg font-bold tracking-[-0.01em]">{etapa.titulo}</h3>
                  <p className="mt-2 text-sm text-texto-2">{etapa.texto}</p>
                </Cartao>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-linha bg-white">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 sm:grid-cols-2">
            <div>
              <Titulo nivel={2}>Coleta mínima, por princípio</Titulo>
              <p className="mt-4 text-sm text-texto-2">
                Cada dado pedido tem uma finalidade declarada no próprio formulário, com
                consentimento separado por finalidade. A coordenada lida no registro de presença
                serve para conferir que você está no local e é descartada assim que o certificado
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
                início é o que permite receber os avisos do evento. O Safari não entrega
                notificação para aba aberta no navegador.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-tinta">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-9">
          <div className="flex items-center gap-3">
            <Simbolo tamanho={28} variante="tinta" />
            <span className="text-sm text-white/60">
              PlanA, plataforma independente de gestão de eventos.
            </span>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
            <Link href="/privacidade" className="hover:text-white">Privacidade</Link>
            <Link href="/cookies" className="hover:text-white">Cookies</Link>
            <Link href="/validar" className="hover:text-white">Validar certificado</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
