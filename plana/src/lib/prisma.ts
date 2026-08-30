import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Cliente do Prisma, criado sob demanda.
 *
 * A criação é preguiçosa de propósito: `next build` avalia os módulos das
 * rotas para coletar metadados, e um cliente construído no carregamento faria
 * o build exigir um banco de dados. Isso quebraria a construção da imagem
 * Docker, onde não há Postgres nenhum — e é a razão de haver um proxy aqui em
 * vez de um simples `new PrismaClient()`.
 *
 * O Prisma 7 exige um driver adapter; aqui é o `pg`, falando direto com o
 * PostgreSQL da VPS.
 */
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

function criar(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL não definida. Veja .env.example.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function cliente(): PrismaClient {
  // Em desenvolvimento o hot reload recria os módulos a cada alteração; sem o
  // cache global isso abriria um pool novo por recarga e esgotaria as conexões.
  if (globalParaPrisma.prisma) return globalParaPrisma.prisma;

  const instancia = criar();
  if (process.env.NODE_ENV !== "production") globalParaPrisma.prisma = instancia;
  return instancia;
}

let emProducao: PrismaClient | undefined;

export const prisma = new Proxy({} as PrismaClient, {
  get(_alvo, propriedade) {
    const real = (emProducao ??= cliente());
    const valor = Reflect.get(real, propriedade) as unknown;
    // Métodos como `$transaction` precisam continuar ligados ao cliente real,
    // e não ao proxy.
    return typeof valor === "function" ? valor.bind(real) : valor;
  },
});
