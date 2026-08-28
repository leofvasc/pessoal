import { Titulo } from "@/components/ui";
import { FormularioEvento } from "./formulario";

export const metadata = { title: "Novo evento" };

export default function PaginaNovoEvento() {
  return (
    <>
      <Titulo>Novo evento</Titulo>
      <p className="mt-2 max-w-2xl text-sm text-texto-2">
        Os horários são digitados no fuso do Acre. A plataforma mostra o horário de Brasília
        correspondente sem que você precise converter nada.
      </p>
      <FormularioEvento />
    </>
  );
}
