import "server-only";

/**
 * Exclusão da conta pelo próprio titular.
 *
 * Planejamento, seção 9. A exclusão aqui é física: a linha do usuário sai do
 * banco, e com ela — por cascata declarada no schema — consentimentos,
 * inscrições, presenças, certificados, notificações, assinaturas de push,
 * chamados, mensagens de chamado e pedidos de redefinição de senha. Não há
 * marcação lógica de "conta apagada" com os dados intactos por trás: seria
 * dizer ao titular que o dado foi eliminado quando ele continua no banco.
 *
 * Há uma única coisa que a exclusão não decide sozinha, e por isso é escolha do
 * titular: o certificado já emitido.
 *
 * O certificado tem um código de validação impresso e um QR que aponta para a
 * consulta pública de autenticidade. Quando ele já foi entregue a terceiros, o
 * documento continua circulando depois que a conta some. Apagar tudo faz a
 * plataforma passar a responder "código não encontrado" para um certificado
 * verdadeiro, que ela mesma emitiu — o efeito prático é invalidar prova alheia.
 *
 * Daí as duas formas de exclusão:
 *
 *  - **mantendo a validação**: os dados da conta são apagados e, para cada
 *    certificado emitido, fica um registro em CertificadoArquivado contendo
 *    apenas o que já está impresso no próprio certificado. A conta desaparece,
 *    o documento continua verificável, e não sobra nenhum caminho de volta do
 *    registro para uma pessoa cadastrada;
 *
 *  - **apagando também os certificados**: nada é arquivado. Os certificados já
 *    baixados deixam de ser validáveis, e não há como reemiti-los.
 *
 * Quem nunca teve certificado emitido não escolhe nada: apaga-se tudo.
 */
import { prisma } from "./prisma";
import { hashDeNome } from "./verificacao-nome";

/** O que a conta tem hoje — mostrado ao titular antes de ele confirmar. */
export type ResumoDaConta = {
  inscricoesAtivas: number;
  presencas: number;
  certificados: number;
  chamados: number;
  notificacoes: number;
  consentimentosAtivos: number;
};

export async function resumoDaConta(usuarioId: string): Promise<ResumoDaConta> {
  const [inscricoesAtivas, presencas, certificados, chamados, notificacoes, consentimentosAtivos] =
    await Promise.all([
      prisma.inscricao.count({ where: { usuarioId, canceladaEm: null } }),
      prisma.presenca.count({ where: { inscricao: { usuarioId } } }),
      prisma.certificado.count({ where: { inscricao: { usuarioId } } }),
      prisma.chamado.count({ where: { usuarioId } }),
      prisma.notificacao.count({ where: { usuarioId } }),
      prisma.consentimento.count({ where: { usuarioId, revogadoEm: null } }),
    ]);

  return {
    inscricoesAtivas,
    presencas,
    certificados,
    chamados,
    notificacoes,
    consentimentosAtivos,
  };
}

/**
 * Por que uma conta não pode ser excluída pela própria interface.
 *
 * Conta de organizador não se exclui aqui. Ela não é só o dado de uma pessoa:
 * é a dona dos eventos publicados, das imagens enviadas e dos lançamentos
 * manuais de presença de terceiros. Apagá-la derrubaria páginas públicas e
 * certificados de outras pessoas — e o schema, corretamente, nem permitiria a
 * operação, porque `Evento.organizadorId` e `Arquivo.enviadoPorId` são de
 * exclusão restrita. O pedido segue pelo chamado, com transferência ou
 * encerramento dos eventos antes.
 */
export type ImpedimentoDeExclusao =
  | "ORGANIZADOR"
  | "EVENTOS_ORGANIZADOS"
  | "ARQUIVOS_ENVIADOS"
  | "GERE_INSTITUICAO";

export async function impedimentoParaExcluir(
  usuarioId: string,
): Promise<ImpedimentoDeExclusao | null> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { papel: true },
  });
  if (!usuario) return null;
  if (usuario.papel === "ORGANIZADOR" || usuario.papel === "MASTER") return "ORGANIZADOR";

  // Defensivo: participante não envia arquivo nem organiza evento hoje. Se um
  // dia passar a enviar, a exclusão para aqui em vez de estourar no banco.
  const [eventos, arquivos] = await Promise.all([
    prisma.evento.count({ where: { organizadorId: usuarioId } }),
    prisma.arquivo.count({ where: { enviadoPorId: usuarioId } }),
  ]);
  if (eventos > 0) return "EVENTOS_ORGANIZADOS";
  if (arquivos > 0) return "ARQUIVOS_ENVIADOS";

  // Gerir instituição é responsabilidade sobre certificado de terceiros. O
  // vínculo precisa ser desfeito primeiro, e quem o desfaz é o master.
  const gestor = await prisma.instituicaoGestor.count({ where: { usuarioId } });
  if (gestor > 0) return "GERE_INSTITUICAO";
  return null;
}

export type ResultadoDaExclusao = {
  certificadosArquivados: number;
};

export class ExclusaoBloqueada extends Error {
  constructor(readonly motivo: ImpedimentoDeExclusao) {
    super(`Exclusão bloqueada: ${motivo}`);
    this.name = "ExclusaoBloqueada";
  }
}

/**
 * Apaga a conta e tudo que pende dela.
 *
 * Tudo numa transação só: ou o titular sai inteiro do banco, ou nada muda. Uma
 * exclusão pela metade — conta apagada com certificados órfãos, ou código
 * pessoal liberado sem a conta ter saído — seria pior que não ter excluído.
 */
export async function excluirConta(usuarioId: string): Promise<ResultadoDaExclusao> {
  const impedimento = await impedimentoParaExcluir(usuarioId);
  if (impedimento) throw new ExclusaoBloqueada(impedimento);

  const titular = await prisma.usuario.findUniqueOrThrow({
    where: { id: usuarioId },
    select: { nome: true },
  });

  // Fora da transação de propósito: bcrypt com custo 12 leva centenas de
  // milissegundos, e segurar a transação aberta por isso prenderia linhas de
  // Evento sem necessidade. O mesmo hash serve a todos os certificados da conta.
  const nomeHash = await hashDeNome(titular.nome);

  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { codigoUsuario: true, papel: true },
    });
    // Relido dentro da transação: entre a checagem acima e este ponto o papel
    // poderia ter mudado.
    if (usuario.papel === "ORGANIZADOR" || usuario.papel === "MASTER") {
      throw new ExclusaoBloqueada("ORGANIZADOR");
    }

    const inscricoes = await tx.inscricao.findMany({
      where: { usuarioId },
      select: {
        eventoId: true,
        canceladaEm: true,
        presenca: { select: { registradaEm: true, metodo: true } },
        certificado: { select: { codigoValidacao: true, liberadoEm: true } },
        evento: {
          select: {
            nome: true,
            inicioEm: true,
            cargaHorariaMinutos: true,
            instituicoes: {
              orderBy: { ordem: "asc" },
              select: { instituicao: { select: { nome: true } } },
            },
          },
        },
      },
    });

    let certificadosArquivados = 0;

    // Contadores agregados por evento. A inscrição cancelada pelo próprio
    // participante já não conta no painel; some sem deixar rastro no total.
    const agregados = new Map<string, { inscricoes: number; presencas: number }>();

    for (const inscricao of inscricoes) {
      if (!inscricao.canceladaEm) {
        const atual = agregados.get(inscricao.eventoId) ?? { inscricoes: 0, presencas: 0 };
        atual.inscricoes += 1;
        if (inscricao.presenca) atual.presencas += 1;
        agregados.set(inscricao.eventoId, atual);
      }

      // Certificado sem presença não existe na prática — a liberação depende
      // dela —, mas a checagem evita arquivar registro que a consulta pública
      // não saberia descrever.
      if (!inscricao.certificado || !inscricao.presenca) continue;

      await tx.certificadoArquivado.create({
        data: {
          codigoValidacao: inscricao.certificado.codigoValidacao,
          nomeHash,
          eventoNome: inscricao.evento.nome,
          eventoInicioEm: inscricao.evento.inicioEm,
          cargaHorariaMinutos: inscricao.evento.cargaHorariaMinutos,
          organizacoes: inscricao.evento.instituicoes
            .map(({ instituicao }) => instituicao.nome)
            .join(", "),
          metodoPresenca: inscricao.presenca.metodo,
          presencaRegistradaEm: inscricao.presenca.registradaEm,
          liberadoEm: inscricao.certificado.liberadoEm,
        },
      });
      certificadosArquivados += 1;
    }

    for (const [eventoId, totais] of agregados) {
      await tx.evento.update({
        where: { id: eventoId },
        data: {
          inscricoesDeContasExcluidas: { increment: totais.inscricoes },
          presencasDeContasExcluidas: { increment: totais.presencas },
        },
      });
    }

    // O código pessoal é aposentado pelo mesmo motivo da troca por suspeita de
    // vazamento: ele circulou em telas e links de presença remota, e não pode
    // reaparecer sorteado na conta de outra pessoa.
    await tx.codigoUsuarioAposentado.create({ data: { codigo: usuario.codigoUsuario } });

    // A cascata do schema leva junto consentimentos, inscrições, presenças,
    // certificados, notificações, assinaturas de push, chamados, mensagens de
    // chamado e pedidos de redefinição de senha.
    await tx.usuario.delete({ where: { id: usuarioId } });

    return { certificadosArquivados };
  });
}
