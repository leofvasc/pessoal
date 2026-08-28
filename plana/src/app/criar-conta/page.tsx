import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/sessao";
import { LogotipoVertical } from "@/components/marca/Logotipo";
import { TEXTOS_CONSENTIMENTO } from "@/lib/consentimento";
import { FormularioCriacao } from "./formulario";

export const metadata: Metadata = { title: "Criar conta" };

export default async function PaginaCriarConta() {
  const sessao = await sessaoAtual();
  if (sessao) redirect("/conta");

  return (
    <main className="flex flex-1 justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        <div className="flex justify-center">
          <Link href="/">
            <LogotipoVertical altura={44} />
          </Link>
        </div>
        <h1 className="mt-8 text-center text-2xl font-bold tracking-[-0.02em]">Criar conta</h1>
        <p className="mt-2 text-center text-sm text-texto-2">
          Cada campo abaixo diz para que serve. Os que dependem de autorização vêm separados no
          fim do formulário.
        </p>

        {/* Os textos de consentimento vêm do módulo que os grava junto com o
            aceite: o que o titular lê e o que fica registrado são a mesma
            string, e não duas cópias que podem divergir. */}
        <FormularioCriacao textos={TEXTOS_CONSENTIMENTO} />

        <p className="mt-6 text-center text-sm text-texto-2">
          Já tem conta?{" "}
          <Link href="/entrar" className="font-semibold text-violeta hover:text-profundo">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
