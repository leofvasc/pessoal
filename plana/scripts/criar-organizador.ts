/**
 * Cria (ou promove) a conta de organizador.
 *
 * A plataforma não tem tela de cadastro de organizador de propósito: quem
 * organiza eventos é o titular, e abrir esse papel pela web criaria uma
 * superfície de ataque sem nenhum ganho.
 *
 *     npm run organizador -- email@dominio "Nome Completo"
 *
 * A senha é pedida no terminal, para não ficar no histórico do shell.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { prisma } from "../src/lib/prisma";
import { hashDeSenha } from "../src/lib/sessao";
import { codigoUsuario } from "../src/lib/codigos";

async function principal() {
  const [email, nome] = process.argv.slice(2);
  if (!email || !nome) {
    console.error('uso: npm run organizador -- email@dominio "Nome Completo"');
    process.exit(1);
  }

  const leitor = createInterface({ input: stdin, output: stdout });
  const senha = await leitor.question("Senha (mínimo 10 caracteres): ");
  leitor.close();

  if (senha.length < 10) {
    console.error("senha curta demais.");
    process.exit(1);
  }

  const usuario = await prisma.usuario.upsert({
    where: { email: email.toLowerCase() },
    create: {
      email: email.toLowerCase(),
      nome,
      senhaHash: await hashDeSenha(senha),
      papel: "ORGANIZADOR",
      perfil: "PROFESSOR",
      codigoUsuario: codigoUsuario(),
    },
    update: { papel: "ORGANIZADOR", senhaHash: await hashDeSenha(senha) },
    select: { id: true, email: true },
  });

  console.log(`organizador pronto: ${usuario.email}`);
  process.exit(0);
}

principal().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
