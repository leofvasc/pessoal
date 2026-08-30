import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Logotipo } from "@/components/marca/Logotipo";
import { Etiqueta, Titulo } from "@/components/ui";
import { dataLongaAcre, etiquetaDoisFusos } from "@/lib/fuso";
import { FormularioPresencaRemota } from "./formulario";

export const metadata = { title: "Registrar presença a distância" };

/**
 * Página de registro de presença à distância.
 *
 * Planejamento, seções 2 e 7: a plataforma suporta evento online e híbrido, mas
 * quem assiste a distância não tem QR projetado para ler nem local físico
 * contra o qual conferir a posição. Cada evento online ou híbrido ganha esta
 * página, com endereço próprio e secreto, que a organização envia aos
 * participantes remotos.
 *
 * Não exige login de propósito: o participante costuma estar assistindo à
 * transmissão num aparelho e registrando presença noutro. A identificação vem
 * do código pessoal da conta, e o que sustenta a segurança está descrito em
 * `registrarPresencaRemota`.
 */
export default async function PaginaPresencaRemota({
  params,
}: PageProps<"/presenca-remota/[token]">) {
  const { token } = await params;

  const evento = await prisma.evento.findFirst({
    where: { tokenRemoto: token, excluidoEm: null, canceladoEm: null },
    select: {
      nome: true,
      modalidade: true,
      inicioEm: true,
      fimEm: true,
      meioTransmissao: true,
    },
  });

  if (!evento || evento.modalidade === "PRESENCIAL") notFound();

  return (
    <>
      <header className="border-b border-linha bg-white">
        <div className="mx-auto max-w-xl px-6 py-5">
          <Link href="/">
            <Logotipo altura={24} />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
        <Etiqueta>presença a distância</Etiqueta>
        <Titulo className="mt-3">{evento.nome}</Titulo>
        <p className="mt-3 text-sm text-texto-2">{dataLongaAcre(evento.inicioEm)}</p>
        <p className="mt-1 font-mono text-xs text-texto-2">{etiquetaDoisFusos(evento.inicioEm)}</p>

        <FormularioPresencaRemota token={token} nomeEvento={evento.nome} />

        <div className="mt-10 rounded-2xl border border-linha bg-white p-5">
          <h2 className="text-sm font-semibold">Onde encontro meu código?</h2>
          <p className="mt-2 text-sm text-texto-2">
            Entre na sua conta da PlanA: o código aparece logo no início, em{" "}
            <span className="font-semibold text-tinta">Seu código de usuário</span>. Ele começa com{" "}
            <span className="font-mono">USR-</span> e tem oito caracteres.
          </p>
          <Link
            href="/conta"
            className="mt-3 inline-block text-sm font-semibold text-violeta hover:text-profundo"
          >
            Abrir minha conta →
          </Link>
          <p className="mt-4 text-xs text-texto-2">
            Só registra presença quem já está inscrito neste evento. Se o código não for aceito e
            você tiver certeza de que se inscreveu, peça o lançamento manual à organização.
          </p>
        </div>
      </main>

      <footer className="border-t border-linha bg-white">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-6 py-6">
          <span className="text-xs text-texto-2">inscrições e certificados por</span>
          <Logotipo altura={18} />
        </div>
      </footer>
    </>
  );
}
