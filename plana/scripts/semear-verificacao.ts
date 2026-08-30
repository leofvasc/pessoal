import { prisma } from "../src/lib/prisma";
import { hashDeSenha } from "../src/lib/sessao";
import { codigoUsuario } from "../src/lib/codigos";
import { codigoCurto, codigoEvento, paraSlug, tokenQr, tokenRemoto } from "../src/lib/codigos";

async function main() {
  const senha = await hashDeSenha("senha-de-teste-123");

  const org = await prisma.usuario.upsert({
    where: { email: "org@teste.local" },
    create: { email: "org@teste.local", nome: "Leonardo Vasconcelos", senhaHash: senha, papel: "ORGANIZADOR", perfil: "PROFESSOR", codigoUsuario: codigoUsuario() },
    update: {},
  });

  const part = await prisma.usuario.upsert({
    where: { email: "maria@teste.local" },
    create: {
      email: "maria@teste.local", nome: "Maria Nogueira de Albuquerque", senhaHash: senha,
      perfil: "PROFISSIONAL_JURIDICO", perfilDetalhe: "Defensoria Pública do Acre",
      codigoUsuario: codigoUsuario(),
    },
    update: {},
  });

  const inst =
    (await prisma.instituicao.findFirst({ where: { nome: "Instituto Lovelace" } })) ??
    (await prisma.instituicao.create({ data: { nome: "Instituto Lovelace" } }));

  const nome = "III Seminário de Direito Digital";
  // Evento em curso: começou há 2h e termina em 10 min. É o estado em que o
  // registro de presença por QR Code está aberto.
  const inicioEm = new Date(Date.now() - 2 * 3600_000);
  const fimEm = new Date(Date.now() + 10 * 60_000);

  await prisma.evento.deleteMany({ where: { codigoEvento: codigoEvento(2026, 184) } });

  const evento = await prisma.evento.create({
    data: {
      nome, descricao: "Seminário sobre proteção de dados e inteligência artificial.",
      modalidade: "PRESENCIAL", inicioEm, fimEm,
      localNome: "Auditório do TJAC", localEndereco: "Rio Branco/AC",
      latitude: -9.97499, longitude: -67.8243,
      cargaHorariaMinutos: 270,
      slug: paraSlug(nome), codigoCurto: codigoCurto(), tokenQr: tokenQr(),
      codigoEvento: codigoEvento(2026, 184), organizadorId: org.id, publicado: true,
      palestrantes: { create: { nome: "Leonardo Vasconcelos", qualificacao: "Professor de Direito Digital" } },
      instituicoes: { create: { instituicaoId: inst.id } },
    },
  });

  await prisma.inscricao.create({ data: { eventoId: evento.id, usuarioId: part.id } });
  await prisma.consentimento.upsert({
    where: { usuarioId_finalidade: { usuarioId: part.id, finalidade: "GEOLOCALIZACAO_CHECKIN" } },
    create: { usuarioId: part.id, finalidade: "GEOLOCALIZACAO_CHECKIN", textoApresentado: "texto de teste" },
    update: { revogadoEm: null },
  });

  // Segundo evento, híbrido, para exercitar o registro de presença à distância.
  const nomeHibrido = "Capacitação em Proteção de Dados";
  await prisma.evento.deleteMany({ where: { codigoEvento: codigoEvento(2026, 185) } });
  const hibrido = await prisma.evento.create({
    data: {
      nome: nomeHibrido,
      descricao: "Capacitação transmitida ao vivo, com público presencial e a distância.",
      modalidade: "HIBRIDO",
      inicioEm,
      fimEm,
      localNome: "Auditório do MPAC",
      localEndereco: "Rio Branco/AC",
      meioTransmissao: "Transmissão pelo YouTube",
      latitude: -9.97499,
      longitude: -67.8243,
      cargaHorariaMinutos: 180,
      slug: paraSlug(nomeHibrido),
      codigoCurto: codigoCurto(),
      tokenQr: tokenQr(),
      tokenRemoto: tokenRemoto(),
      codigoEvento: codigoEvento(2026, 185),
      organizadorId: org.id,
      publicado: true,
      palestrantes: { create: { nome: "Leonardo Vasconcelos", qualificacao: "Encarregado de dados" } },
      instituicoes: { create: { instituicaoId: inst.id } },
    },
  });
  // Híbrido: a semente inscreve na modalidade online, que é a que exercita a
  // página de presença a distância impressa logo abaixo.
  await prisma.inscricao.create({
    data: { eventoId: hibrido.id, usuarioId: part.id, modalidade: "ONLINE" },
  });

  console.log("SLUG=" + evento.slug);
  console.log("TOKEN_REMOTO=" + hibrido.tokenRemoto);
  console.log("CODIGO_MARIA=" + (await prisma.usuario.findUniqueOrThrow({ where: { id: part.id }, select: { codigoUsuario: true } })).codigoUsuario);
  console.log("TOKEN=" + evento.tokenQr);
  console.log("CURTO=" + evento.codigoCurto);
  console.log("EVENTO_ID=" + evento.id);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
