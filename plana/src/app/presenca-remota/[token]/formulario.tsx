"use client";

import { useState } from "react";
import Link from "next/link";
import { registrarPresencaADistancia } from "@/app/acoes-presenca";
import { LoopCheckin } from "@/components/marca/LoopCheckin";
import { Aviso, Botao, Campo, Entrada, Titulo } from "@/components/ui";

type Fase = "pronto" | "registrando" | "confirmado" | "falhou";

export function FormularioPresencaRemota({
  token,
  nomeEvento,
}: {
  token: string;
  nomeEvento: string;
}) {
  const [fase, setFase] = useState<Fase>("pronto");
  const [codigo, setCodigo] = useState("");
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function registrar() {
    setMensagem(null);
    setFase("registrando");

    const resultado = await registrarPresencaADistancia({ token, codigo });

    if (resultado.ok) {
      setFase("confirmado");
    } else {
      setFase("falhou");
      setMensagem(resultado.mensagem);
    }
  }

  if (fase === "confirmado") {
    return (
      <div className="mt-10 flex flex-col items-center text-center">
        {/* Manual, seção 11: ao validar, a base do símbolo pulsa em verde. */}
        <LoopCheckin tamanho={120} confirmado rotulo="Presença confirmada" />
        <Titulo nivel={2} className="mt-8">
          Presença confirmada
        </Titulo>
        <p className="mt-3 text-sm text-texto-2">
          Sua presença em {nomeEvento} foi registrada. O certificado fica disponível na sua conta ao
          fim do evento.
        </p>
        <Link
          href="/conta/certificados"
          className="mt-6 inline-flex rounded-xl bg-violeta px-5 py-3 text-sm font-semibold text-white hover:bg-profundo"
        >
          Meus certificados
        </Link>
      </div>
    );
  }

  const emCurso = fase === "registrando";

  return (
    <form
      className="mt-10 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!emCurso) registrar();
      }}
    >
      {mensagem ? <Aviso tom="erro">{mensagem}</Aviso> : null}

      <Campo
        rotulo="Seu código de usuário"
        dica="Está na sua conta da PlanA, logo no início. Pode digitar com ou sem os hífens."
        obrigatorio
      >
        <Entrada
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="USR-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="!font-mono !text-lg !tracking-[0.12em]"
          required
        />
      </Campo>

      <Botao type="submit" className="w-full" disabled={emCurso || codigo.trim().length < 8}>
        {emCurso ? "Registrando…" : "Registrar presença"}
      </Botao>
    </form>
  );
}
