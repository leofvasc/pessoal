import type { Metadata } from "next";
import Link from "next/link";
import { LogotipoVertical } from "@/components/marca/Logotipo";
import { FormularioEsqueciSenha } from "./formulario";

export const metadata: Metadata = { title: "Esqueci minha senha" };

export default function PaginaEsqueciSenha() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex justify-center"><Link href="/"><LogotipoVertical altura={44} /></Link></div>
        <h1 className="mt-8 text-center text-2xl font-bold tracking-[-0.02em]">Recuperar acesso</h1>
        <p className="mt-3 text-center text-sm text-texto-2">
          Informe o e-mail da conta. Se ele estiver cadastrado, você receberá um link temporário para criar uma nova senha.
        </p>
        <FormularioEsqueciSenha />
        <p className="mt-6 text-center text-sm text-texto-2">
          <Link href="/entrar" className="font-semibold text-violeta hover:text-profundo">Voltar para entrar</Link>
        </p>
      </div>
    </main>
  );
}
