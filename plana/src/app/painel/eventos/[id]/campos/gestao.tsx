"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  arquivarCampoInscricao,
  criarCampoInscricao,
  reativarCampoInscricao,
  type EstadoCampo,
} from "@/app/acoes-campos-inscricao";
import { Aviso, AreaTexto, Botao, Campo, Cartao, Entrada, Selecao, Titulo } from "@/components/ui";
import { AVISO_LIMITE_DE_CAMPOS } from "@/lib/limites-inscricao";
import type { TipoCampoInscricao } from "@/generated/prisma/client";

const INICIAL: EstadoCampo = {};

const ROTULO: Record<TipoCampoInscricao, string> = {
  TEXTO_CURTO: "Texto curto",
  TEXTO_LONGO: "Texto longo",
  NUMERO: "Número",
  DATA: "Data",
  SELECAO_UNICA: "Escolha uma opção",
  SELECAO_MULTIPLA: "Escolha várias opções",
  SIM_NAO: "Sim ou não",
};

const AJUDA: Record<TipoCampoInscricao, string> = {
  TEXTO_CURTO: "Uma linha. Serve para matrícula, lotação, cargo.",
  TEXTO_LONGO: "Várias linhas. Serve para justificativa ou observação.",
  NUMERO: "Apenas números. Serve para período, semestre, quantidade.",
  DATA: "Seletor de data.",
  SELECAO_UNICA: "Lista de alternativas, uma só resposta.",
  SELECAO_MULTIPLA: "Lista de alternativas, várias respostas.",
  SIM_NAO: "Duas alternativas fixas.",
};

type CampoListado = {
  id: string;
  rotulo: string;
  ajuda: string | null;
  tipo: TipoCampoInscricao;
  obrigatorio: boolean;
  opcoes: string[];
  arquivadoEm: Date | null;
  _count: { respostas: number };
};

export function GestaoDeCampos({
  eventoId,
  campos,
  limiteAtingido,
}: {
  eventoId: string;
  campos: CampoListado[];
  /** Já existe o campo permitido: o formulário de criação sai da tela. */
  limiteAtingido: boolean;
}) {
  const criar = criarCampoInscricao.bind(null, eventoId);
  const [estado, acao, pendente] = useActionState(criar, INICIAL);
  const [tipo, setTipo] = useState<TipoCampoInscricao>("TEXTO_CURTO");
  const [processando, iniciar] = useTransition();
  const roteador = useRouter();

  const precisaOpcoes = tipo === "SELECAO_UNICA" || tipo === "SELECAO_MULTIPLA";
  const ativos = campos.filter((c) => !c.arquivadoEm);
  const arquivados = campos.filter((c) => c.arquivadoEm);

  function executar(operacao: () => Promise<unknown>) {
    iniciar(async () => {
      await operacao();
      roteador.refresh();
    });
  }

  return (
    <>
      <section>
        <Titulo nivel={2}>{ativos.length === 1 ? "Campo ativo" : "Nenhum campo ativo"}</Titulo>
        {ativos.length === 0 ? (
          <Cartao className="mt-4">
            <p className="text-sm text-texto-2">
              Nenhum campo. A inscrição neste evento acontece direto no clique do participante.
            </p>
          </Cartao>
        ) : (
          <div className="mt-4 space-y-2">
            {ativos.map((campo) => (
              <Cartao key={campo.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="quebra-texto text-sm font-bold text-tinta">
                      {campo.rotulo}
                      {campo.obrigatorio ? <span className="text-erro"> *</span> : null}
                    </p>
                    <p className="mt-1 text-xs text-texto-2">
                      {ROTULO[campo.tipo]}
                      {campo.opcoes.length > 0 ? ` · ${campo.opcoes.join(" / ")}` : ""}
                      {campo._count.respostas > 0
                        ? ` · ${campo._count.respostas} resposta(s)`
                        : ""}
                    </p>
                    {campo.ajuda ? (
                      <p className="quebra-texto mt-1 text-xs text-texto-2">{campo.ajuda}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {/* Com um campo por evento não há ordem a arrumar: as
                        setas só apareceriam desabilitadas para sempre. */}
                    <button
                      type="button"
                      disabled={processando}
                      onClick={() => executar(() => arquivarCampoInscricao(eventoId, campo.id))}
                      className="rounded-lg px-3 py-1 text-sm font-semibold text-erro hover:bg-erro/5"
                    >
                      Arquivar
                    </button>
                  </div>
                </div>
              </Cartao>
            ))}
          </div>
        )}
      </section>

      {arquivados.length > 0 ? (
        <section className="mt-10">
          <Titulo nivel={2}>Arquivados</Titulo>
          <p className="mt-2 text-sm text-texto-2">
            Não aparecem mais no formulário, e as respostas já dadas continuam no relatório. Campo
            não se apaga: sumir com a pergunta deixaria a resposta órfã, sem cabeçalho que a
            explique.
          </p>
          <div className="mt-4 space-y-2">
            {arquivados.map((campo) => (
              <Cartao key={campo.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="quebra-texto text-sm font-semibold text-texto-2">
                      {campo.rotulo}
                    </p>
                    <p className="text-xs text-texto-2">
                      {ROTULO[campo.tipo]} · {campo._count.respostas} resposta(s) preservada(s)
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={processando}
                    onClick={() => executar(() => reativarCampoInscricao(eventoId, campo.id))}
                    className="text-sm font-semibold text-violeta hover:text-profundo"
                  >
                    Reativar
                  </button>
                </div>
              </Cartao>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-10">
        <Titulo nivel={2}>{limiteAtingido ? "Criar outro campo" : "Novo campo"}</Titulo>

        {/* A mensagem fica ao lado do campo, e não escondida numa página de
            ajuda: quem procura o botão de adicionar o segundo campo tem de
            encontrar aqui a razão de ele não existir. */}
        <div className="mt-4">
          <Aviso tom="informacao" titulo="Um campo, por opção">
            {AVISO_LIMITE_DE_CAMPOS}
          </Aviso>
        </div>

        {limiteAtingido ? (
          <Cartao className="mt-4">
            <p className="text-sm text-texto-2">
              Este evento já tem o campo permitido. Para perguntar outra coisa, arquive o campo
              atual acima — as respostas já dadas continuam no relatório — e crie o novo.
            </p>
          </Cartao>
        ) : (
        <form action={acao} className="mt-4 space-y-4">
          {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
          {estado.ok ? <Aviso tom="sucesso">Campo criado.</Aviso> : null}

          <Cartao className="space-y-4">
            <Campo
              rotulo="Pergunta"
              dica="Escreva como o participante vai ler. Vira o cabeçalho da coluna no relatório."
              erro={estado.campos?.rotulo}
              obrigatorio
            >
              <Entrada name="rotulo" maxLength={120} required placeholder="Período que está cursando" />
            </Campo>

            <Campo rotulo="Tipo de resposta" erro={estado.campos?.tipo} obrigatorio>
              <Selecao
                name="tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoCampoInscricao)}
              >
                {(Object.keys(ROTULO) as TipoCampoInscricao[]).map((chave) => (
                  <option key={chave} value={chave}>
                    {ROTULO[chave]}
                  </option>
                ))}
              </Selecao>
            </Campo>
            <p className="-mt-2 text-xs text-texto-2">{AJUDA[tipo]}</p>

            {precisaOpcoes ? (
              <Campo
                rotulo="Alternativas"
                dica="Uma por linha, na ordem em que devem aparecer."
                erro={estado.campos?.opcoes}
                obrigatorio
              >
                <AreaTexto name="opcoes" rows={5} placeholder={"1º\n2º\n3º"} />
              </Campo>
            ) : null}

            <Campo
              rotulo="Texto de apoio"
              dica="Aparece abaixo do campo. É onde você diz ao participante para que serve o dado — a plataforma não tem como saber a finalidade de uma pergunta que não escreveu."
              erro={estado.campos?.ajuda}
            >
              <AreaTexto name="ajuda" rows={2} maxLength={300} />
            </Campo>

            <label className="flex items-center gap-3">
              <input type="checkbox" name="obrigatorio" className="size-4 accent-violeta" />
              <span className="text-sm text-tinta">Resposta obrigatória</span>
            </label>

            <Botao type="submit" disabled={pendente}>
              {pendente ? "Criando…" : "Criar campo"}
            </Botao>
          </Cartao>
        </form>
        )}
      </section>
    </>
  );
}
