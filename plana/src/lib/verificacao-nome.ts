import "server-only";

/**
 * Conferência do nome em certificado cujo titular excluiu a conta.
 *
 * O problema a resolver: manter o certificado validável sem manter o nome de
 * quem o recebeu. Guardar o nome em texto resolveria a validação e desfaria a
 * exclusão pela metade — bastaria abrir a tabela para saber quem participou de
 * quê. Não guardar nada resolveria a exclusão e deixaria o documento sem defesa
 * contra adulteração: qualquer um trocaria o nome no PDF e o código continuaria
 * confirmando "certificado autêntico".
 *
 * A saída é guardar o nome de forma que não se leia, mas se confirme. Do nome
 * fica um hash bcrypt. A consulta pública não exibe nome nenhum: ela mostra o
 * evento, a data e a carga horária, e oferece um campo para o consulente digitar
 * o nome que está lendo no documento em mãos. A plataforma responde apenas se
 * confere ou não.
 *
 * O que isso custa em privacidade, dito de forma direta: nome é segredo de
 * baixa entropia, então o hash não é anonimização perfeita. Quem já tiver o
 * código impresso pode testar nomes um a um. Três coisas contêm esse risco — é
 * preciso possuir o código, que só está no próprio certificado; o custo 12 do
 * bcrypt torna a varredura lenta; e o limite de tentativas por código corta a
 * varredura muito antes de valer a pena. Quem tem o certificado em mãos já lê o
 * nome impresso nele: o hash não entrega nada que essa pessoa não tenha.
 */
import bcrypt from "bcryptjs";

/**
 * Normaliza antes de comparar. Sem isto, "João da Silva" e "JOAO DA SILVA"
 * seriam nomes diferentes, e a conferência falharia justamente para quem
 * digitou certo — a acentuação e a caixa variam conforme quem copia do papel.
 */
export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export async function hashDeNome(nome: string): Promise<string> {
  return bcrypt.hash(normalizarNome(nome), 12);
}

export async function conferirNome(nome: string, hash: string): Promise<boolean> {
  const normalizado = normalizarNome(nome);
  if (!normalizado) return false;
  return bcrypt.compare(normalizado, hash);
}
