-- Configuração global da plataforma: linha única, de id fixo "global".
-- Guarda o modelo-base padrão de certificado, que a PlanA mantém e aplica
-- automaticamente a todo evento novo. O organizador pode substituí-lo dentro
-- de cada evento sem alterar o padrão dos demais.
CREATE TABLE "Configuracao" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "certificadoBasePadraoArquivoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Configuracao_certificadoBasePadraoArquivoId_idx"
    ON "Configuracao"("certificadoBasePadraoArquivoId");

-- ON DELETE SET NULL: se o arquivo sumir, a configuração volta a "sem modelo
-- padrão" em vez de impedir a exclusão do arquivo.
ALTER TABLE "Configuracao" ADD CONSTRAINT "Configuracao_certificadoBasePadraoArquivoId_fkey"
FOREIGN KEY ("certificadoBasePadraoArquivoId") REFERENCES "Arquivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A linha existe desde o primeiro deploy, ainda sem modelo enviado.
INSERT INTO "Configuracao" ("id", "atualizadoEm") VALUES ('global', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
