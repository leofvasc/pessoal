"use client";

import { useState, useTransition } from "react";
import { inscrever } from "@/app/acoes-evento";
import { Aviso, Botao } from "@/components/ui";

export function BotaoInscricao({ eventoId }: { eventoId: string }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  // Seção 7: mensagem automática de confirmação por popup no momento da
  // inscrição, além do registro na central de notificações da conta.
  const [confirmado, setConfirmado] = useState(false);

  if (confirmado) {
    return (
      <Aviso tom="sucesso" titulo="Inscrição confirmada">
        Você também recebeu a confirmação na central de notificações da sua conta. No dia, leia o QR
        Code projetado na sala para registrar presença.
      </Aviso>
    );
  }

  return (
    <div className="space-y-3">
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      <Botao
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            setErro(null);
            const resultado = await inscrever(eventoId);
            if ("erro" in resultado && resultado.erro) setErro(resultado.erro);
            else setConfirmado(true);
          })
        }
      >
        {pendente ? "Inscrevendo…" : "Inscrever-se"}
      </Botao>
    </div>
  );
}
