import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirOrganizador , escopoDeEventos } from "@/lib/sessao";
import { Aviso, BotaoLink, Cartao, Dado, Etiqueta, Titulo } from "@/components/ui";
import { dataLongaAcre, etiquetaDoisFusos, formatarCargaHoraria } from "@/lib/fuso";
import { qrSvg, urlCurta, urlDePresenca, urlLonga, urlPresencaRemota } from "@/lib/qr";
import { diagnosticoDeOrigem } from "@/lib/origem";
import { TOLERANCIA_METROS } from "@/lib/geo";
import { ListaPresenca } from "./lista-presenca";
import { AcoesDoEvento } from "./acoes-cliente";
import { LinkPresencaRemota } from "./link-remoto";
import { garantirTokenRemoto } from "@/app/acoes-evento";
import { BannerDoEvento, ImagemBaseDoCertificado, MaterialDeApoio, Organizadoras } from "./materiais";
import { formatarTamanho } from "@/lib/armazenamento";
import { idDoGabarito, idDoModeloPadrao } from "@/lib/configuracao";
import { vagasDoEvento } from "@/lib/lotacao";
import {
  ROTULO_MODALIDADE_INSCRICAO,
  exigeEscolhaDeModalidade,
  rotuloDeVagas,
} from "@/lib/vagas";

export const metadata = { title: "Evento" };

const MODALIDADES = { PRESENCIAL: "Presencial", ONLINE: "Online", HIBRIDO: "Híbrido" } as const;

export default async function PaginaEvento({ params }: PageProps<"/painel/eventos/[id]">) {
  const { id } = await params;
  const sessao = await exigirOrganizador();

  const [evento, instituicoesDisponiveis] = await Promise.all([
    prisma.evento.findFirst({
      where: { id, ...escopoDeEventos(sessao), excluidoEm: null },
      include: {
        palestrantes: { orderBy: { ordem: "asc" } },
        instituicoes: { orderBy: { ordem: "asc" }, select: { instituicaoId: true } },
        materiais: {
          orderBy: { ordem: "asc" },
          include: { arquivo: { select: { id: true, tamanhoBytes: true } } },
        },
        inscricoes: {
          where: { canceladaEm: null },
          orderBy: { criadaEm: "asc" },
          include: {
            usuario: { select: { nome: true, email: true, perfil: true } },
            presenca: { select: { registradaEm: true, metodo: true } },
            certificado: { select: { codigoValidacao: true, primeiraEmissaoEm: true } },
          },
        },
      },
    }),
    // Só as que a conta gere. O master vê todas, porque administra a lista.
    prisma.instituicao.findMany({
      where:
        sessao.papel === "MASTER"
          ? {}
          : { gestores: { some: { usuarioId: sessao.usuarioId } } },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  if (!evento) notFound();

  const { origem, alerta: alertaDeOrigem } = await diagnosticoDeOrigem();

  // Evento online ou híbrido criado antes desta funcionalidade não tem token
  // remoto. Ele é gerado aqui, na primeira vez que o gestor abre o evento —
  // com o gerador criptográfico da aplicação, não com um `random()` do banco.
  const tokenRemoto =
    evento.modalidade === "PRESENCIAL" ? null : await garantirTokenRemoto(evento.id);

  // Dois QRs com finalidades que não se misturam: o de presença carrega o token
  // secreto e é projetado na sala; o de divulgação aponta para o link curto.
  const [qrPresenca, qrDivulgacao] = await Promise.all([
    qrSvg(urlDePresenca(origem, evento.tokenQr)),
    qrSvg(urlCurta(origem, evento.codigoCurto)),
  ]);

  // Quem excluiu a conta some da lista nominal, mas não do total histórico do
  // evento: o número de inscritos e de presentes é registro da atividade, não
  // dado pessoal, e não pode encolher sozinho depois de o relatório ter saído.
  const presentes = evento.inscricoes.filter((i) => i.presenca).length;
  const totalInscritos = evento.inscricoes.length + evento.inscricoesDeContasExcluidas;
  const totalPresentes = presentes + evento.presencasDeContasExcluidas;
  const houveExclusoes =
    evento.inscricoesDeContasExcluidas > 0 || evento.presencasDeContasExcluidas > 0;

  // Saber se a imagem-base em uso é o modelo padrão da plataforma ou arte
  // própria muda o que o gestor lê no cartão e o efeito do botão de remoção.
  const [modeloPadraoId, gabaritoId] = await Promise.all([idDoModeloPadrao(), idDoGabarito()]);

  const vagas = await vagasDoEvento(evento.id, evento);
  const escolheModalidade = exigeEscolhaDeModalidade(evento.modalidade);

  return (
    <>
      <Link href="/painel" className="text-sm text-texto-2 hover:text-violeta">
        ← Painel
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Etiqueta>
            {MODALIDADES[evento.modalidade]} · <Dado>{evento.codigoEvento}</Dado>
          </Etiqueta>
          <Titulo className="mt-2">{evento.nome}</Titulo>
          <p className="mt-2 text-sm text-texto-2">
            {dataLongaAcre(evento.inicioEm)} · {formatarCargaHoraria(evento.cargaHorariaMinutos)}
          </p>
          <p className="mt-1 font-mono text-xs text-texto-2">{etiquetaDoisFusos(evento.inicioEm)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {evento.canceladoEm ? (
            <span className="rounded-full bg-erro/10 px-3 py-1 text-xs font-semibold text-erro">
              cancelado
            </span>
          ) : evento.publicado ? (
            <span className="rounded-full bg-sucesso/10 px-3 py-1 text-xs font-semibold text-sucesso">
              publicado
            </span>
          ) : (
            <span className="rounded-full bg-lilas px-3 py-1 text-xs font-semibold text-profundo">
              rascunho
            </span>
          )}
          <BotaoLink href={`/painel/eventos/${evento.id}/editar`} tom="secundario">
            Editar
          </BotaoLink>
          <AcoesDoEvento
            eventoId={evento.id}
            publicado={evento.publicado}
            cancelado={Boolean(evento.canceladoEm)}
          />
        </div>
      </div>

      {/* Um QR impresso com endereço errado não se conserta com deploy: vira
          peça inutilizada. O aviso aparece antes de o gestor baixar o PNG. */}
      {alertaDeOrigem ? (
        <div className="mt-8">
          <Aviso tom="erro" titulo="Endereço público mal configurado no servidor">
            {alertaDeOrigem}
          </Aviso>
        </div>
      ) : null}

      <section className="mt-8 flex flex-wrap gap-3">
        <Link
          href={`/painel/eventos/${evento.id}/campos`}
          className="rounded-xl border border-linha bg-white px-4 py-2.5 text-sm font-semibold text-tinta transition-colors hover:border-violeta"
        >
          Campos da inscrição
        </Link>
        {/* Âncora simples: a rota devolve arquivo, não página. */}
        <a
          href={`/painel/eventos/${evento.id}/relatorio`}
          className="rounded-xl border border-linha bg-white px-4 py-2.5 text-sm font-semibold text-tinta transition-colors hover:border-violeta"
        >
          Baixar planilha de inscrições e presenças
        </a>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <Cartao>
          <Titulo nivel={3}>QR Code de presença</Titulo>
          <p className="mt-2 text-xs text-texto-2">
            Projete no ambiente. Fundo transparente, correção de erro máxima. Na projeção, use área
            branca ou lilás de no mínimo 120 mm e mantenha o símbolo PlanA a pelo menos 15 mm dele.
          </p>
          <div
            className="mx-auto mt-4 w-full max-w-[220px] [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrPresenca }}
          />
          <a
            href={`/painel/eventos/${evento.id}/qr/presenca.png`}
            className="mt-4 block text-center text-sm font-semibold text-violeta hover:text-profundo"
          >
            Baixar PNG para projeção
          </a>
        </Cartao>

        <Cartao>
          <Titulo nivel={3}>Divulgação</Titulo>
          <p className="mt-2 text-xs text-texto-2">
            QR gerado a partir do link curto, para peças gráficas. Ler este não registra presença.
          </p>
          <div
            className="mx-auto mt-4 w-full max-w-[220px] [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrDivulgacao }}
          />
          <a
            href={`/painel/eventos/${evento.id}/qr/divulgacao.png`}
            className="mt-4 block text-center text-sm font-semibold text-violeta hover:text-profundo"
          >
            Baixar PNG para peça gráfica
          </a>
          <dl className="mt-4 space-y-2 text-xs">
            <div>
              <dt className="etiqueta text-texto-2">link curto</dt>
              <dd>
                <a
                  href={urlCurta(origem, evento.codigoCurto)}
                  className="font-mono break-all text-violeta hover:text-profundo"
                >
                  {urlCurta(origem, evento.codigoCurto)}
                </a>
              </dd>
            </div>
            <div>
              <dt className="etiqueta text-texto-2">link longo</dt>
              <dd>
                <a
                  href={urlLonga(origem, evento.slug)}
                  className="font-mono break-all text-violeta hover:text-profundo"
                >
                  {urlLonga(origem, evento.slug)}
                </a>
              </dd>
            </div>
          </dl>
        </Cartao>
      </section>

      {/* Seções 2 e 7: quem assiste a distância não tem QR projetado para ler.
          Cada evento online ou híbrido ganha esta página própria, cujo endereço
          a organização envia aos participantes remotos. */}
      {tokenRemoto ? (
        <section className="mt-4">
          <LinkPresencaRemota url={urlPresencaRemota(origem, tokenRemoto)} />
        </section>
      ) : null}

      {evento.modalidade !== "ONLINE" && evento.latitude === null ? (
        <div className="mt-6">
          <Aviso tom="erro" titulo="Sem ponto no mapa">
            Este evento não tem coordenada definida, então a presença por QR Code não pode ser
            validada. Só restará o lançamento manual.
          </Aviso>
        </div>
      ) : null}

      {/* Seção 3: o que o gestor preenche depois de criar o evento —
          imagem-base do certificado, material de apoio e organizadoras. */}
      <section className="mt-10">
        <Titulo nivel={2}>Materiais do evento</Titulo>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <BannerDoEvento eventoId={evento.id} arquivoId={evento.bannerArquivoId} />
          <ImagemBaseDoCertificado
            eventoId={evento.id}
            arquivoId={evento.certificadoBaseArquivoId}
            noPadrao={
              evento.certificadoBaseArquivoId !== null &&
              evento.certificadoBaseArquivoId === modeloPadraoId
            }
            temModeloPadrao={modeloPadraoId !== null}
            gabaritoArquivoId={gabaritoId}
          />
          <MaterialDeApoio
            eventoId={evento.id}
            materiais={evento.materiais.map((material) => ({
              id: material.id,
              nome: material.nome,
              arquivoId: material.arquivo.id,
              tamanho: formatarTamanho(material.arquivo.tamanhoBytes),
            }))}
          />
          <Organizadoras
            eventoId={evento.id}
            disponiveis={instituicoesDisponiveis}
            selecionadasIniciais={evento.instituicoes.map((i) => i.instituicaoId)}
          />
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Titulo nivel={2}>Inscritos</Titulo>
          <p className="text-sm text-texto-2">
            {totalPresentes} de {totalInscritos} com presença registrada
          </p>
        </div>
        {houveExclusoes ? (
          <p className="mt-2 text-xs text-texto-2">
            O total acima inclui {evento.inscricoesDeContasExcluidas} inscrição(ões) e{" "}
            {evento.presencasDeContasExcluidas} presença(s) de participantes que excluíram a conta.
            Eles não aparecem na lista nominal abaixo, porque os dados pessoais foram apagados.
          </p>
        ) : null}
        {/* A lotação fica junto da lista de inscritos, e não escondida na
            edição: é aqui que o organizador olha quando alguém pergunta se
            ainda dá para se inscrever. */}
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
          {vagas.map((linha) => (
            <li key={linha.modalidade} className="text-xs text-texto-2">
              {escolheModalidade ? (
                <span className="font-semibold text-tinta">
                  {ROTULO_MODALIDADE_INSCRICAO[linha.modalidade]}:{" "}
                </span>
              ) : (
                <span className="font-semibold text-tinta">Vagas: </span>
              )}
              <span className={linha.esgotado ? "font-semibold text-erro" : undefined}>
                {linha.limite === null
                  ? `${linha.ocupadas} inscrito(s), sem limite`
                  : `${linha.ocupadas} de ${linha.limite} · ${rotuloDeVagas(linha)}`}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-2 text-xs text-texto-2">
          A presença por QR Code aceita até {TOLERANCIA_METROS} m de diferença do ponto do evento.
          O lançamento manual continua disponível — a precisão do GPS piora em ambiente fechado.
        </p>

        <ListaPresenca
          inscricoes={evento.inscricoes.map((i) => ({
            id: i.id,
            nome: i.usuario.nome,
            email: i.usuario.email,
            modalidade: escolheModalidade
              ? ROTULO_MODALIDADE_INSCRICAO[i.modalidade]
              : null,
            presencaEm: i.presenca?.registradaEm.toISOString() ?? null,
            metodo: i.presenca?.metodo ?? null,
            codigoValidacao: i.certificado?.codigoValidacao ?? null,
          }))}
        />
      </section>
    </>
  );
}
