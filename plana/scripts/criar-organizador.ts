/**
 * Cria (ou promove) a conta de gestor master.
 *
 * Contas de organizador comuns nascem pela tela — Painel → Organizadores —,
 * criadas por um master. Este script existe para o primeiro master, que não
 * tem quem o crie, e para recuperar o acesso administrativo caso ele se perca.
 *
 *     npm run organizador -- email@dominio "Nome Completo"
 *     npm run organizador -- email@dominio "Nome Completo" --organizador
 *
 * O padrão é master. Com --organizador, cria conta de organizador comum, útil
 * quando não há master disponível para usar a tela.
 *
 * A senha é pedida no terminal, para não ficar no histórico do shell.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { prisma } from "../src/lib/prisma";
import { hashDeSenha } from "../src/lib/sessao";
import { codigoUsuario } from "../src/lib/codigos";

async function principal() {
  // O nome junta todos os argumentos restantes: quem digita o comando nem
  // sempre põe aspas, e "Leonardo Vasconcelos" sem elas chegaria pela metade.
  const argumentos = process.argv.slice(2);
  const comoOrganizador = argumentos.includes("--organizador");
  const [email, ...partesDoNome] = argumentos.filter((a) => a !== "--organizador");
  const nome = partesDoNome.join(" ").trim();
  const papel = comoOrganizador ? "ORGANIZADOR" : "MASTER";

  if (!email || !nome) {
    console.error('uso: npm run organizador -- email@dominio "Nome Completo" [--organizador]');
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
      papel,
      perfil: "PROFESSOR",
      codigoUsuario: codigoUsuario(),
    },
    update: { papel, senhaHash: await hashDeSenha(senha) },
    select: { id: true, email: true },
  });

  console.log(`conta ${papel.toLowerCase()} pronta: ${usuario.email}`);
  process.exit(0);
}

principal().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
