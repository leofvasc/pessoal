import Link from "next/link";
import { exigirSessao } from "@/lib/sessao";
import { Cartao, Titulo } from "@/components/ui";
import { FormularioNovoChamado } from "../formularios";

export const metadata = { title: "Novo chamado" };

export default async function PaginaNovoChamado() {
  await exigirSessao();
  return (
    <>
      <Link href="/conta/chamados" className="text-sm text-texto-2 hover:text-violeta">← Chamados</Link>
      <Titulo className="mt-4">Novo chamado</Titulo>
      <Cartao className="mt-6">
        <p className="text-sm text-texto-2">
          Descreva a solicitação com os dados necessários para que a equipe possa responder.
        </p>
        <FormularioNovoChamado />
      </Cartao>
    </>
  );
}
