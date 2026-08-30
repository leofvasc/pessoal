import Link from "next/link";
import { Cartao, Entrada, Titulo } from "@/components/ui";
import { Logotipo } from "@/components/marca/Logotipo";
import { redirect } from "next/navigation";

export const metadata = { title: "Validar certificado" };

async function validar(dados: FormData) {
  "use server";
  const codigo = String(dados.get("codigo") ?? "").trim().toUpperCase();
  if (!codigo) redirect("/validar");
  redirect(`/validar/${encodeURIComponent(codigo)}`);
}

export default function PaginaValidar() {
  return (
    <>
      <header className="border-b border-linha bg-white">
        <div className="mx-auto max-w-2xl px-6 py-5">
          <Link href="/">
            <Logotipo altura={24} />
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <Titulo>Validar certificado</Titulo>
        <p className="mt-3 text-sm text-texto-2">
          Informe o código impresso no bloco de validação do certificado. A consulta é pública e não
          exige conta.
        </p>
        <Cartao className="mt-8">
          <form action={validar} className="flex flex-wrap gap-3">
            <Entrada
              name="codigo"
              placeholder="CERT-2026-0184-7F3ADX"
              className="flex-1 !font-mono"
              required
            />
            <button className="rounded-xl bg-violeta px-5 py-3 text-sm font-semibold text-white hover:bg-profundo">
              Consultar
            </button>
          </form>
        </Cartao>
      </main>
    </>
  );
}
