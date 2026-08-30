import { LogotipoVertical } from "@/components/marca/Logotipo";

export const metadata = { title: "Sem conexão" };

export default function PaginaOffline() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <LogotipoVertical altura={44} />
      <div>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">Sem conexão</h1>
        <p className="mt-2 max-w-sm text-sm text-texto-2">
          A PlanA precisa de rede para registrar presença e emitir certificado. Assim que a conexão
          voltar, recarregue esta página.
        </p>
      </div>
    </main>
  );
}
