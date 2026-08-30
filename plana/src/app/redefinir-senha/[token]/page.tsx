import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hashTokenRedefinicao } from "@/lib/redefinicao-senha";
import { LogotipoVertical } from "@/components/marca/Logotipo";
import { Aviso, BotaoLink } from "@/components/ui";
import { FormularioNovaSenha } from "./formulario";

export const metadata: Metadata = { title: "Criar nova senha" };

export default async function PaginaRedefinirSenha({ params }: PageProps<"/redefinir-senha/[token]">) {
  const { token } = await params;
  const registro = await prisma.redefinicaoSenha.findUnique({
    where: { tokenHash: hashTokenRedefinicao(token) },
    select: { expiraEm: true, usadoEm: true },
  });
  const valido = Boolean(registro && !registro.usadoEm && registro.expiraEm > new Date());

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex justify-center"><Link href="/"><LogotipoVertical altura={44} /></Link></div>
        <h1 className="mt-8 text-center text-2xl font-bold tracking-[-0.02em]">Criar nova senha</h1>
        {valido ? (
          <FormularioNovaSenha token={token} />
        ) : (
          <div className="mt-8">
            <Aviso tom="erro" titulo="Link indisponível">Este link é inválido, já foi usado ou passou do prazo de 30 minutos.</Aviso>
            <BotaoLink href="/esqueci-senha" className="mt-4 w-full">Solicitar outro link</BotaoLink>
          </div>
        )}
      </div>
    </main>
  );
}
