"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { criarConta, type EstadoFormulario } from "@/app/acoes-conta";
import { Aviso, Botao, Campo, Entrada, Selecao } from "@/components/ui";
import type { FinalidadeConsentimento } from "@/generated/prisma/client";

const INICIAL: EstadoFormulario = {};

/** Seção 4 do planejamento: perfis reconhecidos no cadastro. */
const PERFIS = [
  { valor: "ACADEMICO", rotulo: "Acadêmico (estudante de graduação)", complemento: null },
  {
    valor: "PROFISSIONAL_JURIDICO",
    rotulo: "Profissional jurídico",
    complemento: "Atividade ou instituição",
  },
  {
    valor: "PROFISSIONAL_NAO_JURIDICO",
    rotulo: "Profissional não jurídico",
    complemento: "Área de atuação",
  },
  { valor: "PROFESSOR", rotulo: "Professor", complemento: null },
  { valor: "OUTROS", rotulo: "Outros", complemento: "Descreva" },
] as const;

function Consentimento({
  nome,
  texto,
  aoMudar,
  marcado,
}: {
  nome: string;
  texto: string;
  aoMudar?: (valor: boolean) => void;
  marcado?: boolean;
}) {
  return (
    <label className="flex gap-3 rounded-xl border border-linha bg-white p-4">
      <input
        type="checkbox"
        name={nome}
        checked={marcado}
        onChange={(e) => aoMudar?.(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--color-violeta)]"
      />
      <span className="text-xs leading-relaxed text-texto-2">{texto}</span>
    </label>
  );
}

export function FormularioCriacao({
  textos,
}: {
  textos: Record<FinalidadeConsentimento, string>;
}) {
  const [estado, acao, pendente] = useActionState(criarConta, INICIAL);
  const [perfil, setPerfil] = useState<string>("ACADEMICO");
  const [aceitaWhatsapp, setAceitaWhatsapp] = useState(false);

  const complemento = PERFIS.find((p) => p.valor === perfil)?.complemento ?? null;

  return (
    <form action={acao} className="mt-8 space-y-4">
      {estado.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}

      <Campo rotulo="Nome completo" erro={estado.campos?.nome} obrigatorio>
        <Entrada name="nome" autoComplete="name" required />
      </Campo>
      <p className="-mt-2 text-xs text-texto-2">
        É o nome que sai impresso no certificado. Escreva como quer vê-lo lá.
      </p>

      <Campo
        rotulo="E-mail"
        dica="Usado para entrar na plataforma."
        erro={estado.campos?.email}
        obrigatorio
      >
        <Entrada name="email" type="email" autoComplete="email" required />
      </Campo>

      <Campo rotulo="Senha" dica="Ao menos 10 caracteres." erro={estado.campos?.senha} obrigatorio>
        <Entrada name="senha" type="password" autoComplete="new-password" minLength={10} required />
      </Campo>

      <Campo rotulo="Perfil" erro={estado.campos?.perfil} obrigatorio>
        <Selecao name="perfil" value={perfil} onChange={(e) => setPerfil(e.target.value)}>
          {PERFIS.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.rotulo}
            </option>
          ))}
        </Selecao>
      </Campo>

      {complemento ? (
        <Campo rotulo={complemento} erro={estado.campos?.perfilDetalhe} obrigatorio>
          <Entrada name="perfilDetalhe" required />
        </Campo>
      ) : null}

      <fieldset className="space-y-3 rounded-2xl border border-linha bg-superficie p-4">
        <legend className="px-1 text-sm font-semibold">Autorizações</legend>
        <p className="text-xs text-texto-2">
          Nenhuma delas é necessária para se inscrever em eventos. Você pode alterá-las depois na
          sua conta.
        </p>

        <Consentimento nome="aceitaEmail" texto={textos.COMUNICACAO_URGENTE_EMAIL} />
        <Consentimento
          nome="aceitaWhatsapp"
          texto={textos.COMUNICACAO_URGENTE_WHATSAPP}
          marcado={aceitaWhatsapp}
          aoMudar={setAceitaWhatsapp}
        />

        {/* O telefone só aparece quando há autorização para usá-lo: sem
            finalidade, não se pede o dado. */}
        {aceitaWhatsapp ? (
          <Campo rotulo="Telefone com DDD" erro={estado.campos?.telefone} obrigatorio>
            <Entrada name="telefone" type="tel" autoComplete="tel" placeholder="(68) 90000-0000" />
          </Campo>
        ) : null}

        <Consentimento nome="aceitaGeo" texto={textos.GEOLOCALIZACAO_CHECKIN} />
        <p className="text-xs text-texto-2">
          Sem esta última, o registro de presença pelo QR Code não funciona — resta pedir o
          lançamento manual à organização do evento.
        </p>
      </fieldset>

      <Botao type="submit" className="w-full" disabled={pendente}>
        {pendente ? "Criando conta…" : "Criar conta"}
      </Botao>

      <p className="text-center text-xs text-texto-2">
        Ao criar a conta você concorda com o tratamento descrito na{" "}
        <Link href="/privacidade" className="font-semibold text-violeta">
          página de transparência
        </Link>
        .
      </p>
    </form>
  );
}
