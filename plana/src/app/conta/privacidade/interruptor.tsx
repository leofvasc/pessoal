"use client";

import { useState, useTransition } from "react";
import { alternarConsentimento } from "@/app/acoes-conta-privacidade";
import { Botao, Entrada } from "@/components/ui";
import type { FinalidadeConsentimento } from "@/generated/prisma/client";

export function InterruptorConsentimento({
  finalidade,
  ativo,
  exigeTelefone,
  temTelefone,
}: {
  finalidade: FinalidadeConsentimento;
  ativo: boolean;
  exigeTelefone: boolean;
  temTelefone: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const [pedindoTelefone, setPedindoTelefone] = useState(false);
  const [telefone, setTelefone] = useState("");

  function alternar(novoValor: boolean) {
    // Autorizar WhatsApp sem telefone cadastrado não faz sentido: é o
    // consentimento que dá finalidade ao dado, então os dois vêm juntos.
    if (novoValor && exigeTelefone && !temTelefone && !telefone) {
      setPedindoTelefone(true);
      return;
    }
    iniciar(async () => {
      await alternarConsentimento(finalidade, novoValor, telefone || undefined);
      setPedindoTelefone(false);
    });
  }

  if (pedindoTelefone) {
    return (
      <div className="w-full max-w-xs space-y-2">
        <Entrada
          type="tel"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="(68) 90000-0000"
          autoFocus
        />
        <div className="flex gap-2">
          <Botao
            className="!px-4 !py-2 !text-xs"
            onClick={() => alternar(true)}
            disabled={pendente || telefone.length < 8}
          >
            Autorizar
          </Botao>
          <Botao
            tom="discreto"
            className="!px-3 !py-2 !text-xs"
            onClick={() => setPedindoTelefone(false)}
          >
            Cancelar
          </Botao>
        </div>
      </div>
    );
  }

  return (
    <Botao
      tom={ativo ? "secundario" : "primario"}
      className="!px-4 !py-2 !text-xs"
      onClick={() => alternar(!ativo)}
      disabled={pendente}
    >
      {pendente ? "Salvando…" : ativo ? "Revogar" : "Autorizar"}
    </Botao>
  );
}
