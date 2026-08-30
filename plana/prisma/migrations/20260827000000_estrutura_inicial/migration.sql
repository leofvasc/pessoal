-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('ACADEMICO', 'PROFISSIONAL_JURIDICO', 'PROFISSIONAL_NAO_JURIDICO', 'PROFESSOR', 'OUTROS');

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('PARTICIPANTE', 'ORGANIZADOR');

-- CreateEnum
CREATE TYPE "FinalidadeConsentimento" AS ENUM ('COMUNICACAO_URGENTE_EMAIL', 'COMUNICACAO_URGENTE_WHATSAPP', 'GEOLOCALIZACAO_CHECKIN');

-- CreateEnum
CREATE TYPE "Modalidade" AS ENUM ('PRESENCIAL', 'ONLINE', 'HIBRIDO');

-- CreateEnum
CREATE TYPE "MetodoPresenca" AS ENUM ('QR_GEOLOCALIZACAO', 'MANUAL');

-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('INSCRICAO_CONFIRMADA', 'PRESENCA_REGISTRADA', 'CERTIFICADO_DISPONIVEL', 'AVISO_EVENTO', 'SUPORTE');

-- CreateEnum
CREATE TYPE "StatusChamado" AS ENUM ('ABERTO', 'EM_ANDAMENTO', 'RESOLVIDO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'PARTICIPANTE',
    "perfil" "Perfil" NOT NULL,
    "perfilDetalhe" TEXT,
    "telefone" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "excluidoEm" TIMESTAMP(3),

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consentimento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "finalidade" "FinalidadeConsentimento" NOT NULL,
    "concedidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogadoEm" TIMESTAMP(3),
    "textoApresentado" TEXT NOT NULL,

    CONSTRAINT "Consentimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instituicao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "logoUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Instituicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoInstituicao" (
    "eventoId" TEXT NOT NULL,
    "instituicaoId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventoInstituicao_pkey" PRIMARY KEY ("eventoId","instituicaoId")
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "inicioEm" TIMESTAMP(3) NOT NULL,
    "fimEm" TIMESTAMP(3) NOT NULL,
    "modalidade" "Modalidade" NOT NULL,
    "localNome" TEXT,
    "localEndereco" TEXT,
    "meioTransmissao" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "bannerUrl" TEXT,
    "certificadoBaseUrl" TEXT,
    "tutorVirtualUrl" TEXT,
    "cargaHorariaMinutos" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "codigoCurto" TEXT NOT NULL,
    "tokenQr" TEXT NOT NULL,
    "codigoEvento" TEXT NOT NULL,
    "organizadorId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "publicado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Palestrante" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "qualificacao" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "eventoId" TEXT NOT NULL,

    CONSTRAINT "Palestrante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialApoio" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "arquivoUrl" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventoId" TEXT NOT NULL,

    CONSTRAINT "MaterialApoio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inscricao" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceladaEm" TIMESTAMP(3),

    CONSTRAINT "Inscricao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Presenca" (
    "id" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "registradaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metodo" "MetodoPresenca" NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "distanciaMetros" DOUBLE PRECISION,
    "precisaoMetros" DOUBLE PRECISION,
    "geoDescartadaEm" TIMESTAMP(3),
    "lancadaPorId" TEXT,

    CONSTRAINT "Presenca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificado" (
    "id" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "codigoValidacao" TEXT NOT NULL,
    "liberadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "primeiraEmissaoEm" TIMESTAMP(3),
    "totalEmissoes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Certificado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "link" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lidaEm" TIMESTAMP(3),

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssinaturaPush" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoEnvoEm" TIMESTAMP(3),

    CONSTRAINT "AssinaturaPush_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chamado" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "status" "StatusChamado" NOT NULL DEFAULT 'ABERTO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chamado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChamadoMensagem" (
    "id" TEXT NOT NULL,
    "chamadoId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChamadoMensagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_papel_idx" ON "Usuario"("papel");

-- CreateIndex
CREATE INDEX "Consentimento_usuarioId_idx" ON "Consentimento"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Consentimento_usuarioId_finalidade_key" ON "Consentimento"("usuarioId", "finalidade");

-- CreateIndex
CREATE UNIQUE INDEX "Evento_slug_key" ON "Evento"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Evento_codigoCurto_key" ON "Evento"("codigoCurto");

-- CreateIndex
CREATE UNIQUE INDEX "Evento_tokenQr_key" ON "Evento"("tokenQr");

-- CreateIndex
CREATE UNIQUE INDEX "Evento_codigoEvento_key" ON "Evento"("codigoEvento");

-- CreateIndex
CREATE INDEX "Evento_organizadorId_idx" ON "Evento"("organizadorId");

-- CreateIndex
CREATE INDEX "Evento_inicioEm_idx" ON "Evento"("inicioEm");

-- CreateIndex
CREATE INDEX "Palestrante_eventoId_idx" ON "Palestrante"("eventoId");

-- CreateIndex
CREATE INDEX "MaterialApoio_eventoId_idx" ON "MaterialApoio"("eventoId");

-- CreateIndex
CREATE INDEX "Inscricao_usuarioId_idx" ON "Inscricao"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Inscricao_eventoId_usuarioId_key" ON "Inscricao"("eventoId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Presenca_inscricaoId_key" ON "Presenca"("inscricaoId");

-- CreateIndex
CREATE INDEX "Presenca_lancadaPorId_idx" ON "Presenca"("lancadaPorId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificado_inscricaoId_key" ON "Certificado"("inscricaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificado_codigoValidacao_key" ON "Certificado"("codigoValidacao");

-- CreateIndex
CREATE INDEX "Notificacao_usuarioId_lidaEm_idx" ON "Notificacao"("usuarioId", "lidaEm");

-- CreateIndex
CREATE UNIQUE INDEX "AssinaturaPush_endpoint_key" ON "AssinaturaPush"("endpoint");

-- CreateIndex
CREATE INDEX "AssinaturaPush_usuarioId_idx" ON "AssinaturaPush"("usuarioId");

-- CreateIndex
CREATE INDEX "Chamado_usuarioId_status_idx" ON "Chamado"("usuarioId", "status");

-- CreateIndex
CREATE INDEX "ChamadoMensagem_chamadoId_idx" ON "ChamadoMensagem"("chamadoId");

-- AddForeignKey
ALTER TABLE "Consentimento" ADD CONSTRAINT "Consentimento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoInstituicao" ADD CONSTRAINT "EventoInstituicao_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoInstituicao" ADD CONSTRAINT "EventoInstituicao_instituicaoId_fkey" FOREIGN KEY ("instituicaoId") REFERENCES "Instituicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_organizadorId_fkey" FOREIGN KEY ("organizadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Palestrante" ADD CONSTRAINT "Palestrante_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialApoio" ADD CONSTRAINT "MaterialApoio_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscricao" ADD CONSTRAINT "Inscricao_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscricao" ADD CONSTRAINT "Inscricao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presenca" ADD CONSTRAINT "Presenca_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "Inscricao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Presenca" ADD CONSTRAINT "Presenca_lancadaPorId_fkey" FOREIGN KEY ("lancadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificado" ADD CONSTRAINT "Certificado_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "Inscricao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssinaturaPush" ADD CONSTRAINT "AssinaturaPush_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChamadoMensagem" ADD CONSTRAINT "ChamadoMensagem_chamadoId_fkey" FOREIGN KEY ("chamadoId") REFERENCES "Chamado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

