"use server";

/**
 * Troca do código pessoal do participante.
 *
 * O código identifica a pessoa na página de registro de presença à distância,
 * onde não há sessão. Se o titular suspeitar que ele vazou — mostrou a tela numa
 * transmissão ao vivo, deixou anotado num papel —, precisa poder trocá-lo sem
 * pedir nada a ninguém e sem perder o que já registrou.
 */
import { revalidatePath } from "next/cache";
import { exigirSessao } from "@/lib/sessao";
import { trocarCodigo } from "@/lib/codigo-de-usuario";
import { registrarTentativa } from "@/lib/limite-tentativas";
import { notificar } from "@/lib/notificacoes";

export type ResultadoTroca =
  | { ok: true; codigo: string }
  | { ok: false; mensagem: string };

export async function trocarCodigoDeUsuario(): Promise<ResultadoTroca> {
  const sessao = await exigirSessao();

  // A ação é autenticada, então o risco não é alguém de fora abusar dela. O
  // limite existe para conter o duplo clique e para bounded o crescimento da
  // tabela de códigos aposentados.
  const limite = registrarTentativa(`troca-codigo:${sessao.usuarioId}`, {
    maximo: 5,
    janelaSegundos: 3600,
  });

  if (!limite.permitido) {
    const minutos = Math.ceil(limite.segundosParaLiberar / 60);
    return {
      ok: false,
      mensagem: `Você já trocou o código algumas vezes seguidas. Tente de novo em ${minutos} minuto${minutos > 1 ? "s" : ""}.`,
    };
  }

  const codigo = await trocarCodigo(sessao.usuarioId);

  // Registro na central: se a troca não foi o titular quem fez, é por aqui que
  // ele descobre.
  await notificar({
    usuarioId: sessao.usuarioId,
    tipo: "SEGURANCA_CONTA",
    titulo: "Seu código de usuário foi trocado",
    corpo:
      "O código anterior deixou de valer para registrar presença. O novo está na sua conta. Se não foi você quem trocou, altere sua senha e abra um chamado.",
    link: "/conta",
  });

  revalidatePath("/conta", "layout");
  return { ok: true, codigo };
}
