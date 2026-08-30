import "server-only";

function escaparHtml(valor: string): string {
  return valor.replace(/[&<>'"]/g, (caractere) => {
    const entidades: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entidades[caractere];
  });
}

export async function enviarEmailRedefinicaoSenha({
  destinatario,
  nome,
  url,
}: {
  destinatario: string;
  nome: string;
  url: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const remetente = process.env.EMAIL_REMETENTE;
  if (!apiKey || !remetente) throw new Error("E-mail transacional não configurado.");

  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: remetente,
      to: [destinatario],
      subject: "Redefina sua senha da PlanA",
      html: `
        <div style="font-family:Arial,sans-serif;color:#191632;line-height:1.6;max-width:560px;margin:auto">
          <h1 style="font-size:24px;margin:0 0 16px">Redefinição de senha</h1>
          <p>Olá, ${escaparHtml(nome)}.</p>
          <p>Recebemos uma solicitação para criar uma nova senha para sua conta PlanA.</p>
          <p style="margin:28px 0"><a href="${escaparHtml(url)}" style="background:#6B4CF6;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold">Criar nova senha</a></p>
          <p style="font-size:13px;color:#6E6990">O link é individual, expira em 30 minutos e só pode ser usado uma vez. Se você não fez a solicitação, ignore esta mensagem.</p>
        </div>
      `,
    }),
  });

  if (!resposta.ok) {
    const codigo = resposta.status;
    throw new Error(`Falha no serviço de e-mail (${codigo}).`);
  }
}
