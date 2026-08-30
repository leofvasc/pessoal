"use client";

import { useState } from "react";
import { Campo, Cartao, Entrada, Selecao } from "@/components/ui";
import type { TipoOrganizador } from "@/generated/prisma/client";

export type ValoresDoPerfil = {
  tipo: TipoOrganizador;
  nomeOrganizador: string;
  nomeCurto: string;
  documento: string;
  emailContato: string;
  telefoneContato: string;
  site: string;
  esfera: string;
};

/**
 * Campos do perfil, compartilhados entre a criação feita pelo master e a
 * edição feita pelo próprio organizador.
 *
 * A natureza jurídica muda o formulário, e não apenas um rótulo: pessoa
 * física informa CPF e não tem esfera; órgão público informa CNPJ e ganha o
 * campo de esfera. Mostrar tudo sempre pediria dado que não existe para
 * aquele tipo.
 */
export function FormularioPerfilOrganizador({
  valores,
  erros,
}: {
  valores?: Partial<ValoresDoPerfil>;
  erros?: Record<string, string>;
}) {
  const [tipo, setTipo] = useState<TipoOrganizador>(valores?.tipo ?? "PESSOA_JURIDICA");
  const pessoaFisica = tipo === "PESSOA_FISICA";
  const orgao = tipo === "ORGAO_PUBLICO";

  return (
    <Cartao className="space-y-4">
      <Campo rotulo="Natureza do organizador" obrigatorio>
        <Selecao
          name="tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoOrganizador)}
        >
          <option value="PESSOA_FISICA">Pessoa física</option>
          <option value="PESSOA_JURIDICA">Pessoa jurídica</option>
          <option value="ORGAO_PUBLICO">Órgão público</option>
        </Selecao>
      </Campo>

      <Campo
        rotulo={pessoaFisica ? "Nome completo" : orgao ? "Denominação oficial" : "Razão social"}
        dica="É o nome que identifica a organização nas telas de gestão e nos relatórios."
        erro={erros?.nomeOrganizador}
        obrigatorio
      >
        <Entrada name="nomeOrganizador" defaultValue={valores?.nomeOrganizador} required />
      </Campo>

      <Campo
        rotulo="Nome curto"
        dica="Opcional. Usado em listagens e filtros quando a denominação for longa."
        erro={erros?.nomeCurto}
      >
        <Entrada name="nomeCurto" defaultValue={valores?.nomeCurto} maxLength={60} />
      </Campo>

      <Campo
        rotulo={pessoaFisica ? "CPF" : "CNPJ"}
        dica="Opcional. A plataforma funciona sem ele; existe porque instituição que contrata ou audita evento costuma precisar identificar o responsável."
        erro={erros?.documento}
      >
        <Entrada
          name="documento"
          inputMode="numeric"
          defaultValue={valores?.documento}
          placeholder={pessoaFisica ? "000.000.000-00" : "00.000.000/0000-00"}
        />
      </Campo>

      {orgao ? (
        <Campo
          rotulo="Esfera e unidade"
          dica="Exemplo: estadual — Ministério Público do Estado do Acre, Centro de Estudos."
          erro={erros?.esfera}
        >
          <Entrada name="esfera" defaultValue={valores?.esfera} />
        </Campo>
      ) : null}

      <Campo
        rotulo="E-mail de contato"
        dica="Publicado como canal da organização, distinto do e-mail de login. Existe para que o participante fale com quem organiza sem receber o endereço pessoal de quem administra a conta."
        erro={erros?.emailContato}
      >
        <Entrada name="emailContato" type="email" defaultValue={valores?.emailContato} />
      </Campo>

      <Campo rotulo="Telefone de contato" erro={erros?.telefoneContato}>
        <Entrada name="telefoneContato" defaultValue={valores?.telefoneContato} />
      </Campo>

      <Campo rotulo="Site" erro={erros?.site}>
        <Entrada name="site" type="url" defaultValue={valores?.site} placeholder="https://" />
      </Campo>
    </Cartao>
  );
}
