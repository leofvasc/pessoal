import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/sessao";
import { FormularioEntrada } from "./formulario";
import { LogotipoVertical } from "@/components/marca/Logotipo";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaEntrar({ searchParams }: PageProps<"/entrar">) {
  const { destino } = await searchParams;
  const sessao = await sessaoAtual();

  const alvo = typeof destino === "string" && destino.startsWith("/") && !destino.startsWith("//")
    ? destino
    : undefined;

  if (sessao) redirect(alvo ?? (sessao.papel === "ORGANIZADOR" ? "/painel" : "/conta"));

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Link href="/">
            <LogotipoVertical altura={44} />
          </Link>
        </div>
        <h1 className="mt-8 text-center text-2xl font-bold tracking-[-0.02em]">Entrar</h1>
        <FormularioEntrada destino={alvo} />
        <p className="mt-6 text-center text-sm text-texto-2">
          Ainda não tem conta?{" "}
          <Link
            href={alvo ? `/criar-conta?destino=${encodeURIComponent(alvo)}` : "/criar-conta"}
            className="font-semibold text-violeta hover:text-profundo"
          >
            Criar conta
          </Link>
        </p>
      </div>
    </main>
  );
}
