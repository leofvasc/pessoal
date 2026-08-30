"use client";

import { useEffect, useState, useTransition } from "react";
import { lerTrilha, type LinhaDaTrilha } from "@/app/acoes-busca-conta";
import { Cartao } from "@/components/ui";

const DESCRICAO: Record<string, string> = {
  "instituicao.criada": "cadastrou a instituição",
  "instituicao.editada": "editou a instituição",
  "instituicao.suspensa": "suspendeu a instituição",
  "instituicao.reativada": "reativou a instituição",
  "instituicao.excluida": "excluiu a instituição",
  "gestor.vinculado": "vinculou o gestor",
  "gestor.desvinculado": "desvinculou o gestor",
  "conta.suspensa": "suspendeu a conta",
  "conta.reativada": "reativou a conta",
  "conta.promovida": "promoveu a master",
  "conta.rebaixada": "retirou o papel master",
  "conta.senha_redefinida": "redefiniu a senha",
  "conta.excluida": "excluiu a conta",
};

export function TrilhaAdministrativa() {
  const [linhas, setLinhas] = useState<LinhaDaTrilha[] | null>(null);
  const [carregando, iniciar] = useTransition();

  useEffect(() => {
    iniciar(async () => setLinhas(await lerTrilha(30)));
  }, []);

  if (carregando && linhas === null) {
    return (
      <Cartao>
        <p className="text-sm text-texto-2">Carregando…</p>
      </Cartao>
    );
  }

  if (!linhas || linhas.length === 0) {
    return (
      <Cartao>
        <p className="text-sm text-texto-2">Nenhum ato administrativo registrado ainda.</p>
      </Cartao>
    );
  }

  return (
    <Cartao>
      <ol className="divide-y divide-linha">
        {linhas.map((linha) => (
          <li key={linha.id} className="py-3 first:pt-0 last:pb-0">
            <p className="quebra-texto text-sm">
              <span className="font-semibold">{linha.autorNome}</span>{" "}
              {DESCRICAO[linha.acao] ?? linha.acao}{" "}
              <span className="font-semibold">{linha.alvoNome}</span>
            </p>
            <p className="mt-0.5 text-xs text-texto-2">
              {new Date(linha.criadoEm).toLocaleString("pt-BR", {
                timeZone: "America/Rio_Branco",
              })}
              {linha.detalhe ? ` · ${linha.detalhe}` : ""}
            </p>
          </li>
        ))}
      </ol>
    </Cartao>
  );
}
