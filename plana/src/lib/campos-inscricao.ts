import "server-only";

/**
 * Campos personalizados do formulário de inscrição.
 *
 * Cada instituição pergunta algo diferente: o período que o aluno cursa, a
 * lotação da servidora, a necessidade de acessibilidade, o número da OAB.
 * Engessar isso no schema obrigaria a alterar o banco a cada evento novo, e o
 * organizador dependeria do desenvolvedor para uma pergunta de uma linha.
 *
 * O preço dessa liberdade é que a plataforma deixa de saber, de antemão, que
 * dados coleta. Daí as travas, que não são enfeite —
 *
 *  - **um campo por evento**, e só um. É o ponto de equilíbrio entre a
 *    necessidade de personalização e o princípio da coleta mínima: com um, o
 *    organizador pergunta o que só ele sabe que precisa; com vinte, o
 *    formulário vira cadastro e ninguém mais sabe por quê;
 *  - o campo de ajuda é o lugar onde o organizador declara a finalidade, e o
 *    participante o lê antes de responder;
 *  - a tela de configuração adverte sobre dado sensível do art. 11 da LGPD e
 *    sobre o princípio da necessidade do art. 6º, III;
 *  - nada disso impede tecnicamente um organizador determinado, e por isso a
 *    responsabilidade pelo que se pergunta fica registrada como dele.
 *
 * Campo não se apaga: arquiva-se. A resposta já dada integra o registro
 * daquela inscrição, e sumir com a pergunta deixaria a resposta órfã no
 * relatório, sem cabeçalho que a explique.
 */
import { prisma } from "./prisma";
import type { TipoCampoInscricao } from "@/generated/prisma/client";

export const ROTULO_DO_TIPO: Record<TipoCampoInscricao, string> = {
  TEXTO_CURTO: "Texto curto",
  TEXTO_LONGO: "Texto longo",
  NUMERO: "Número",
  DATA: "Data",
  SELECAO_UNICA: "Escolha uma opção",
  SELECAO_MULTIPLA: "Escolha várias opções",
  SIM_NAO: "Sim ou não",
};

export const AJUDA_DO_TIPO: Record<TipoCampoInscricao, string> = {
  TEXTO_CURTO: "Uma linha. Serve para matrícula, lotação, cargo.",
  TEXTO_LONGO: "Várias linhas. Serve para justificativa ou observação.",
  NUMERO: "Apenas números. Serve para período, semestre, quantidade.",
  DATA: "Seletor de data.",
  SELECAO_UNICA: "Lista de alternativas, uma só resposta.",
  SELECAO_MULTIPLA: "Lista de alternativas, várias respostas.",
  SIM_NAO: "Duas alternativas fixas.",
};

export function exigeOpcoes(tipo: TipoCampoInscricao): boolean {
  return tipo === "SELECAO_UNICA" || tipo === "SELECAO_MULTIPLA";
}

// Os limites moram em módulo isomórfico próprio: a tela do organizador roda no
// navegador e precisa do mesmo número e da mesma frase que a validação usa.
export {
  AVISO_LIMITE_DE_CAMPOS,
  LIMITE_DE_CAMPOS,
  LIMITE_DE_OPCOES,
} from "./limites-inscricao";

export type CampoParaFormulario = {
  id: string;
  rotulo: string;
  ajuda: string | null;
  tipo: TipoCampoInscricao;
  obrigatorio: boolean;
  opcoes: string[];
};

/**
 * Campos ativos de um evento, na ordem de exibição.
 *
 * É esta consulta que decide se o participante vê tela de inscrição ou se a
 * inscrição se efetiva no clique: lista vazia significa fluxo direto, como
 * sempre foi.
 */
export async function camposAtivosDoEvento(eventoId: string): Promise<CampoParaFormulario[]> {
  return prisma.campoInscricao.findMany({
    where: { eventoId, arquivadoEm: null },
    orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
    select: { id: true, rotulo: true, ajuda: true, tipo: true, obrigatorio: true, opcoes: true },
  });
}

export async function eventoTemCampos(eventoId: string): Promise<boolean> {
  const total = await prisma.campoInscricao.count({
    where: { eventoId, arquivadoEm: null },
  });
  return total > 0;
}

export type RespostaValidada = { campoId: string; valor: string };

export type ResultadoDaValidacao =
  | { ok: true; respostas: RespostaValidada[] }
  | { ok: false; erros: Record<string, string> };

/**
 * Valida o que o participante respondeu.
 *
 * O valor é guardado já apresentável, e não como estrutura a reinterpretar: é
 * assim que sai no relatório e é assim que o organizador o lê. Em seleção
 * múltipla, as escolhas vêm unidas por "; ", na ordem em que o organizador as
 * cadastrou — não na ordem em que foram marcadas, para que duas respostas
 * iguais tenham texto igual e a coluna do relatório seja agrupável.
 */
export function validarRespostas(
  campos: CampoParaFormulario[],
  dados: FormData,
): ResultadoDaValidacao {
  const erros: Record<string, string> = {};
  const respostas: RespostaValidada[] = [];

  for (const campo of campos) {
    const chave = `campo:${campo.id}`;

    if (campo.tipo === "SELECAO_MULTIPLA") {
      const marcadas = new Set(
        dados.getAll(chave).filter((v): v is string => typeof v === "string"),
      );
      const validas = campo.opcoes.filter((opcao) => marcadas.has(opcao));
      if (validas.length === 0) {
        if (campo.obrigatorio) erros[campo.id] = "Selecione ao menos uma opção.";
        continue;
      }
      respostas.push({ campoId: campo.id, valor: validas.join("; ") });
      continue;
    }

    const bruto = dados.get(chave);
    const valor = typeof bruto === "string" ? bruto.trim() : "";

    if (!valor) {
      if (campo.obrigatorio) erros[campo.id] = "Campo obrigatório.";
      continue;
    }

    switch (campo.tipo) {
      case "NUMERO": {
        if (!/^-?\d+([.,]\d+)?$/.test(valor)) {
          erros[campo.id] = "Informe apenas números.";
          continue;
        }
        break;
      }
      case "DATA": {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(Date.parse(valor))) {
          erros[campo.id] = "Data inválida.";
          continue;
        }
        break;
      }
      case "SELECAO_UNICA": {
        if (!campo.opcoes.includes(valor)) {
          erros[campo.id] = "Selecione uma das opções.";
          continue;
        }
        break;
      }
      case "SIM_NAO": {
        if (valor !== "Sim" && valor !== "Não") {
          erros[campo.id] = "Selecione Sim ou Não.";
          continue;
        }
        break;
      }
      case "TEXTO_CURTO": {
        if (valor.length > 200) {
          erros[campo.id] = "Máximo de 200 caracteres.";
          continue;
        }
        break;
      }
      case "TEXTO_LONGO": {
        if (valor.length > 2000) {
          erros[campo.id] = "Máximo de 2000 caracteres.";
          continue;
        }
        break;
      }
    }

    respostas.push({ campoId: campo.id, valor });
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, respostas };
}

/** Grava as respostas, substituindo as anteriores da mesma inscrição. */
export async function gravarRespostas(
  inscricaoId: string,
  respostas: RespostaValidada[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.respostaInscricao.deleteMany({ where: { inscricaoId } });
    if (respostas.length === 0) return;
    await tx.respostaInscricao.createMany({
      data: respostas.map((resposta) => ({ inscricaoId, ...resposta })),
    });
  });
}
