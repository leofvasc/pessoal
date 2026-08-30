"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buscarContas, type ContaEncontrada } from "@/app/acoes-busca-conta";
import {
  alterarPapel,
  alternarSuspensaoDeConta,
  excluirContaDeUsuario,
  redefinirSenha,
  type EstadoAdmin,
} from "@/app/acoes-administracao";
import { Aviso, Botao, Campo, Cartao, Entrada } from "@/components/ui";

/**
 * Busca e operação de contas.
 *
 * Nada aparece antes de a administração digitar um termo: alcançar a conta
 * sobre a qual se vai agir é diferente de folhear o cadastro inteiro.
 */
export function AdministracaoDeContas() {
  const [termo, setTermo] = useState("");
  const [contas, setContas] = useState<ContaEncontrada[] | null>(null);
  const [buscando, iniciarBusca] = useTransition();

  function buscar() {
    if (termo.trim().length < 3) {
      setContas(null);
      return;
    }
    iniciarBusca(async () => setContas(await buscarContas(termo)));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Entrada
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              buscar();
            }
          }}
          placeholder="Nome ou e-mail — mínimo de três letras"
          className="min-w-0 flex-1"
        />
        <Botao type="button" onClick={buscar} disabled={buscando}>
          {buscando ? "Buscando…" : "Buscar"}
        </Botao>
      </div>

      {contas === null ? null : contas.length === 0 ? (
        <Cartao>
          <p className="text-sm text-texto-2">Nenhuma conta corresponde à busca.</p>
        </Cartao>
      ) : (
        <div className="space-y-2">
          {contas.map((conta) => (
            <UmaConta key={conta.id} conta={conta} aoMudar={buscar} />
          ))}
        </div>
      )}
    </div>
  );
}

function UmaConta({ conta, aoMudar }: { conta: ContaEncontrada; aoMudar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState(conta.motivoSuspensao ?? "");
  const [senha, setSenha] = useState("");
  const [motivoExclusao, setMotivoExclusao] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const [recado, setRecado] = useState<string | null>(null);
  const [processando, iniciar] = useTransition();
  const roteador = useRouter();

  function executar(operacao: () => Promise<EstadoAdmin>, sucesso: string) {
    iniciar(async () => {
      const resultado = await operacao();
      setRecado(resultado.erro ?? sucesso);
      aoMudar();
      roteador.refresh();
    });
  }

  return (
    <Cartao>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="quebra-texto font-bold text-tinta">{conta.nome}</span>
            {conta.papel === "MASTER" ? (
              <span className="rounded-full bg-violeta px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                master
              </span>
            ) : null}
            {conta.papel === "ORGANIZADOR" ? (
              <span className="rounded-full bg-lilas px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-profundo">
                organizador
              </span>
            ) : null}
            {conta.suspensoEm ? (
              <span className="rounded-full bg-erro/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-erro">
                suspensa
              </span>
            ) : null}
          </div>
          <p className="quebra-texto mt-1 text-xs text-texto-2">{conta.email}</p>
          <p className="mt-1 text-xs text-texto-2">
            {conta.inscricoes} inscrição(ões) · {conta.certificados} certificado(s) ·{" "}
            {conta.eventosOrganizados} evento(s) criado(s)
            {conta.instituicoes.length > 0 ? ` · gere ${conta.instituicoes.join(", ")}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="whitespace-nowrap text-sm font-semibold text-violeta hover:text-profundo"
        >
          {aberto ? "Fechar" : "Operar"}
        </button>
      </div>

      {recado ? <p className="mt-3 text-sm text-texto-2">{recado}</p> : null}

      {aberto ? (
        <div className="mt-6 grid gap-4 border-t border-linha pt-6 sm:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-bold">{conta.suspensoEm ? "Reativar" : "Suspender"}</p>
            <p className="text-xs text-texto-2">
              Bloqueia o login sem apagar nada. Inscrições, presenças e certificados permanecem.
            </p>
            {!conta.suspensoEm ? (
              <Campo rotulo="Motivo" dica="Enviado na notificação e gravado na trilha.">
                <Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </Campo>
            ) : null}
            <Botao
              type="button"
              tom={conta.suspensoEm ? "primario" : "perigo"}
              disabled={processando}
              onClick={() =>
                executar(
                  () => alternarSuspensaoDeConta(conta.id, motivo),
                  conta.suspensoEm ? "Conta reativada." : "Conta suspensa.",
                )
              }
            >
              {conta.suspensoEm ? "Reativar" : "Suspender"}
            </Botao>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-bold">Papel administrativo</p>
            <p className="text-xs text-texto-2">
              Master administra a plataforma inteira. A condição de organizador não se define aqui:
              ela decorre do vínculo com uma instituição.
            </p>
            <Botao
              type="button"
              tom="secundario"
              disabled={processando}
              onClick={() =>
                executar(
                  () => alterarPapel(conta.id, conta.papel === "MASTER" ? "PARTICIPANTE" : "MASTER"),
                  "Papel alterado.",
                )
              }
            >
              {conta.papel === "MASTER" ? "Retirar papel master" : "Promover a master"}
            </Botao>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-bold">Redefinir senha</p>
            <p className="text-xs text-texto-2">
              Use quando a pessoa perder o acesso e não conseguir recuperá-lo pelo e-mail. Ela é
              notificada da troca.
            </p>
            <Campo rotulo="Nova senha" dica="Mínimo de dez caracteres.">
              <Entrada
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="new-password"
              />
            </Campo>
            <Botao
              type="button"
              tom="secundario"
              disabled={processando || senha.length < 10}
              onClick={() =>
                executar(async () => {
                  const resultado = await redefinirSenha(conta.id, senha);
                  if (!resultado.erro) setSenha("");
                  return resultado;
                }, "Senha redefinida.")
              }
            >
              Redefinir
            </Botao>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-bold text-erro">Excluir conta</p>
            <p className="text-xs text-texto-2">
              Apaga os dados pessoais e mantém validáveis os certificados já emitidos, sem guardar
              nome legível — a mesma rotina da exclusão feita pelo próprio titular. Não tem desfazer.
            </p>
            {conta.instituicoes.length > 0 ? (
              <Aviso tom="erro">
                Esta conta gere instituição. Desvincule-a antes de excluir.
              </Aviso>
            ) : (
              <>
                <Campo
                  rotulo="Motivo da exclusão"
                  dica="Obrigatório. Fica na trilha administrativa."
                >
                  <Entrada
                    value={motivoExclusao}
                    onChange={(e) => setMotivoExclusao(e.target.value)}
                  />
                </Campo>
                {!confirmando ? (
                  <Botao
                    type="button"
                    tom="perigo"
                    disabled={processando || motivoExclusao.trim().length < 10}
                    onClick={() => setConfirmando(true)}
                  >
                    Excluir conta
                  </Botao>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-erro">
                      Confirma a exclusão de {conta.nome}? Não há como desfazer.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Botao
                        type="button"
                        tom="perigo"
                        disabled={processando}
                        onClick={() =>
                          executar(
                            () => excluirContaDeUsuario(conta.id, motivoExclusao),
                            "Conta excluída.",
                          )
                        }
                      >
                        Confirmar exclusão
                      </Botao>
                      <Botao type="button" tom="secundario" onClick={() => setConfirmando(false)}>
                        Cancelar
                      </Botao>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}
    </Cartao>
  );
}
