"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  alternarSuspensaoDeInstituicao,
  desvincularGestor,
  excluirInstituicao,
  salvarInstituicao,
  vincularGestor,
  type EstadoAdmin,
} from "@/app/acoes-administracao";
import { Aviso, Botao, Campo, Cartao, Entrada, Selecao, Titulo } from "@/components/ui";
import type { TipoOrganizador } from "@/generated/prisma/client";

const INICIAL: EstadoAdmin = {};

const ROTULO: Record<TipoOrganizador, string> = {
  PESSOA_FISICA: "Pessoa física",
  PESSOA_JURIDICA: "Pessoa jurídica",
  ORGAO_PUBLICO: "Órgão público",
};

type Gestor = {
  id: string;
  nome: string;
  email: string;
  suspensoEm: Date | null;
  vinculadoEm: string;
};

type InstituicaoListada = {
  id: string;
  nome: string;
  nomeCurto: string | null;
  tipo: TipoOrganizador;
  documento: string | null;
  emailContato: string | null;
  telefoneContato: string | null;
  site: string | null;
  esfera: string | null;
  anotacaoInterna: string | null;
  suspensaEm: string | null;
  motivoSuspensao: string | null;
  _count: { eventos: number };
  gestores: Gestor[];
};

/** Campos da instituição, usados tanto na criação quanto na edição. */
function CamposDaInstituicao({
  valores,
  erros,
}: {
  valores?: Partial<InstituicaoListada>;
  erros?: Record<string, string>;
}) {
  const [tipo, setTipo] = useState<TipoOrganizador>(valores?.tipo ?? "PESSOA_JURIDICA");
  const pessoaFisica = tipo === "PESSOA_FISICA";
  const orgao = tipo === "ORGAO_PUBLICO";

  return (
    <div className="space-y-4">
      <Campo rotulo="Natureza" obrigatorio>
        <Selecao
          name="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoOrganizador)}
        >
          {(Object.keys(ROTULO) as TipoOrganizador[]).map((chave) => (
            <option key={chave} value={chave}>
              {ROTULO[chave]}
            </option>
          ))}
        </Selecao>
      </Campo>

      <Campo
        rotulo={pessoaFisica ? "Nome completo" : orgao ? "Denominação oficial" : "Razão social"}
        dica="É o nome que sai impresso no certificado. Escreva por extenso."
        erro={erros?.nome}
        obrigatorio
      >
        <Entrada name="nome" defaultValue={valores?.nome} required />
      </Campo>

      <Campo
        rotulo="Nome curto"
        dica="Opcional. Usado em listagens, filtros e relatórios. O certificado sempre usa o nome completo."
        erro={erros?.nomeCurto}
      >
        <Entrada name="nomeCurto" defaultValue={valores?.nomeCurto ?? ""} maxLength={60} />
      </Campo>

      <Campo
        rotulo={pessoaFisica ? "CPF" : "CNPJ"}
        dica="Opcional. Nenhuma funcionalidade o usa; existe porque instituição que contrata ou audita costuma precisar identificar o responsável."
        erro={erros?.documento}
      >
        <Entrada
          name="documento"
          inputMode="numeric"
          defaultValue={valores?.documento ?? ""}
          placeholder={pessoaFisica ? "000.000.000-00" : "00.000.000/0000-00"}
        />
      </Campo>

      {orgao ? (
        <Campo rotulo="Esfera e unidade" erro={erros?.esfera}>
          <Entrada
            name="esfera"
            defaultValue={valores?.esfera ?? ""}
            placeholder="estadual — Centro de Estudos"
          />
        </Campo>
      ) : null}

      <Campo
        rotulo="E-mail de contato"
        dica="Canal da organização, publicado ao participante. Distinto do e-mail de login de quem administra."
        erro={erros?.emailContato}
      >
        <Entrada name="emailContato" type="email" defaultValue={valores?.emailContato ?? ""} />
      </Campo>

      <Campo rotulo="Telefone de contato" erro={erros?.telefoneContato}>
        <Entrada name="telefoneContato" defaultValue={valores?.telefoneContato ?? ""} />
      </Campo>

      <Campo rotulo="Site" erro={erros?.site}>
        <Entrada name="site" type="url" defaultValue={valores?.site ?? ""} placeholder="https://" />
      </Campo>
    </div>
  );
}

function Nova() {
  const [aberto, setAberto] = useState(false);
  const salvar = salvarInstituicao.bind(null, null);
  const [estado, acao, pendente] = useActionState(salvar, INICIAL);
  const roteador = useRouter();

  if (!aberto) {
    return (
      <Botao type="button" onClick={() => setAberto(true)}>
        Cadastrar instituição
      </Botao>
    );
  }

  return (
    <form
      action={async (dados) => {
        await acao(dados);
        roteador.refresh();
      }}
      className="space-y-4"
    >
      <Cartao className="space-y-4">
        <Titulo nivel={3}>Nova instituição</Titulo>
        {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
        {estado.ok ? <Aviso tom="sucesso">Instituição cadastrada.</Aviso> : null}
        <CamposDaInstituicao erros={estado.campos} />
        <div className="flex flex-wrap gap-3">
          <Botao type="submit" disabled={pendente}>
            {pendente ? "Salvando…" : "Cadastrar"}
          </Botao>
          <Botao type="button" tom="secundario" onClick={() => setAberto(false)}>
            Fechar
          </Botao>
        </div>
      </Cartao>
    </form>
  );
}

function Uma({ instituicao }: { instituicao: InstituicaoListada }) {
  const [editando, setEditando] = useState(false);
  const [email, setEmail] = useState("");
  const [motivo, setMotivo] = useState(instituicao.motivoSuspensao ?? "");
  const [recado, setRecado] = useState<string | null>(null);
  const [processando, iniciar] = useTransition();
  const roteador = useRouter();

  const salvar = salvarInstituicao.bind(null, instituicao.id);
  const [estado, acao, pendente] = useActionState(salvar, INICIAL);

  function executar(operacao: () => Promise<EstadoAdmin>, sucesso: string) {
    iniciar(async () => {
      const resultado = await operacao();
      setRecado(resultado.erro ?? sucesso);
      roteador.refresh();
    });
  }

  return (
    <Cartao>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="quebra-texto font-bold text-tinta">{instituicao.nome}</span>
            {instituicao.suspensaEm ? (
              <span className="rounded-full bg-erro/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-erro">
                suspensa
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-texto-2">
            {ROTULO[instituicao.tipo]} · {instituicao._count.eventos} evento(s) ·{" "}
            {instituicao.gestores.length} gestor(es)
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditando((v) => !v)}
          className="whitespace-nowrap text-sm font-semibold text-violeta hover:text-profundo"
        >
          {editando ? "Fechar" : "Gerir"}
        </button>
      </div>

      {recado ? <p className="mt-3 text-sm text-texto-2">{recado}</p> : null}

      {editando ? (
        <div className="mt-6 space-y-8 border-t border-linha pt-6">
          <div>
            <Titulo nivel={3}>Gestores</Titulo>
            <p className="mt-1 text-xs text-texto-2">
              Vincular uma conta existente é o que a torna organizadora. A pessoa precisa já ter
              criado a conta na plataforma.
            </p>

            <div className="mt-3 space-y-2">
              {instituicao.gestores.length === 0 ? (
                <p className="text-sm text-texto-2">
                  Nenhum gestor. Sem vínculo, esta instituição não tem quem crie eventos em nome
                  dela.
                </p>
              ) : (
                instituicao.gestores.map((gestor) => (
                  <div
                    key={gestor.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-superficie px-3 py-2"
                  >
                    <span className="min-w-0 text-sm">
                      <span className="quebra-texto font-semibold">{gestor.nome}</span>
                      <span className="quebra-texto block text-xs text-texto-2">{gestor.email}</span>
                    </span>
                    <button
                      type="button"
                      disabled={processando}
                      onClick={() =>
                        executar(
                          () => desvincularGestor(instituicao.id, gestor.id),
                          "Gestor desvinculado.",
                        )
                      }
                      className="text-sm font-semibold text-erro hover:brightness-90"
                    >
                      Desvincular
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1">
                <Campo rotulo="E-mail da conta a vincular">
                  <Entrada
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="pessoa@dominio"
                  />
                </Campo>
              </div>
              <Botao
                type="button"
                disabled={processando || !email.trim()}
                onClick={() =>
                  executar(async () => {
                    const resultado = await vincularGestor(instituicao.id, email);
                    if (!resultado.erro) setEmail("");
                    return resultado;
                  }, "Conta vinculada. Ela já tem painel de organizador.")
                }
              >
                Vincular
              </Botao>
            </div>
          </div>

          <form
            action={async (dados) => {
              await acao(dados);
              roteador.refresh();
            }}
            className="space-y-4"
          >
            <Titulo nivel={3}>Identificação</Titulo>
            {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
            {estado.ok ? <Aviso tom="sucesso">Salvo.</Aviso> : null}
            <CamposDaInstituicao valores={instituicao} erros={estado.campos} />
            <Botao type="submit" disabled={pendente}>
              {pendente ? "Salvando…" : "Salvar"}
            </Botao>
          </form>

          <div className="space-y-3">
            <Titulo nivel={3}>Situação</Titulo>
            <p className="text-xs text-texto-2">
              Suspensa, a instituição não recebe eventos novos. Os gestores continuam vendo o
              histórico e emitindo relatório do que já foi realizado.
            </p>
            {!instituicao.suspensaEm ? (
              <Campo rotulo="Motivo">
                <Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </Campo>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Botao
                type="button"
                tom={instituicao.suspensaEm ? "primario" : "perigo"}
                disabled={processando}
                onClick={() =>
                  executar(
                    () => alternarSuspensaoDeInstituicao(instituicao.id, motivo),
                    instituicao.suspensaEm ? "Instituição reativada." : "Instituição suspensa.",
                  )
                }
              >
                {instituicao.suspensaEm ? "Reativar" : "Suspender"}
              </Botao>
              <Botao
                type="button"
                tom="secundario"
                disabled={processando || instituicao._count.eventos > 0}
                onClick={() =>
                  executar(() => excluirInstituicao(instituicao.id), "Instituição excluída.")
                }
              >
                Excluir
              </Botao>
            </div>
            {instituicao._count.eventos > 0 ? (
              <p className="text-xs text-texto-2">
                A exclusão está bloqueada porque o nome desta instituição está impresso em
                certificado que circula. Suspenda-a para tirá-la de circulação sem reescrever o
                passado.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </Cartao>
  );
}

export function AdministracaoDeInstituicoes({
  instituicoes,
}: {
  instituicoes: InstituicaoListada[];
}) {
  return (
    <div className="space-y-4">
      <Nova />
      <div className="space-y-2">
        {instituicoes.length === 0 ? (
          <Cartao>
            <p className="text-sm text-texto-2">Nenhuma instituição cadastrada.</p>
          </Cartao>
        ) : (
          instituicoes.map((instituicao) => (
            <Uma key={instituicao.id} instituicao={instituicao} />
          ))
        )}
      </div>
    </div>
  );
}
