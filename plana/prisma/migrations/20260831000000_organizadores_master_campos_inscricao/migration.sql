-- Perfis de organizador, papel master e campos personalizados de inscrição.
--
-- 1. Papel MASTER: administra a plataforma e as contas de organizador.
-- 2. PerfilOrganizador: identifica quem promove os eventos (pessoa física,
--    pessoa jurídica ou órgão público). Separado de Instituicao, que continua
--    sendo a linha de crédito impressa no certificado.
-- 3. CampoInscricao e RespostaInscricao: perguntas adicionais definidas pelo
--    organizador no formulário de inscrição.

ALTER TYPE "Papel" ADD VALUE 'MASTER';

CREATE TYPE "TipoOrganizador" AS ENUM ('PESSOA_FISICA', 'PESSOA_JURIDICA', 'ORGAO_PUBLICO');

CREATE TYPE "TipoCampoInscricao" AS ENUM (
    'TEXTO_CURTO',
    'TEXTO_LONGO',
    'NUMERO',
    'DATA',
    'SELECAO_UNICA',
    'SELECAO_MULTIPLA',
    'SIM_NAO'
);

CREATE TABLE "PerfilOrganizador" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "TipoOrganizador" NOT NULL,
    "nomeOrganizador" TEXT NOT NULL,
    "nomeCurto" TEXT,
    "documento" TEXT,
    "emailContato" TEXT,
    "telefoneContato" TEXT,
    "site" TEXT,
    "esfera" TEXT,
    "anotacaoInterna" TEXT,
    "suspensoEm" TIMESTAMP(3),
    "motivoSuspensao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfilOrganizador_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PerfilOrganizador_usuarioId_key" ON "PerfilOrganizador"("usuarioId");
CREATE INDEX "PerfilOrganizador_tipo_idx" ON "PerfilOrganizador"("tipo");

ALTER TABLE "PerfilOrganizador"
    ADD CONSTRAINT "PerfilOrganizador_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CampoInscricao" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "ajuda" TEXT,
    "tipo" "TipoCampoInscricao" NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "opcoes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "arquivadoEm" TIMESTAMP(3),

    CONSTRAINT "CampoInscricao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CampoInscricao_eventoId_ordem_idx" ON "CampoInscricao"("eventoId", "ordem");

ALTER TABLE "CampoInscricao"
    ADD CONSTRAINT "CampoInscricao_eventoId_fkey"
    FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RespostaInscricao" (
    "id" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "campoId" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "respondidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RespostaInscricao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RespostaInscricao_inscricaoId_campoId_key"
    ON "RespostaInscricao"("inscricaoId", "campoId");
CREATE INDEX "RespostaInscricao_campoId_idx" ON "RespostaInscricao"("campoId");

ALTER TABLE "RespostaInscricao"
    ADD CONSTRAINT "RespostaInscricao_inscricaoId_fkey"
    FOREIGN KEY ("inscricaoId") REFERENCES "Inscricao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RespostaInscricao"
    ADD CONSTRAINT "RespostaInscricao_campoId_fkey"
    FOREIGN KEY ("campoId") REFERENCES "CampoInscricao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
