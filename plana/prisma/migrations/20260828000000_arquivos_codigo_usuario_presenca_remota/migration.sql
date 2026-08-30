-- Arquivos enviados pelo gestor, código pessoal do participante e página de
-- registro de presença à distância.
--
-- Duas colunas novas são obrigatórias e a tabela pode já ter linhas, então elas
-- entram anuláveis, recebem um preenchimento e só então viram NOT NULL. Sem
-- isso, a migração falharia em qualquer banco que já tenha contas criadas.

-- AlterEnum
ALTER TYPE "MetodoPresenca" ADD VALUE 'CODIGO_REMOTO';

-- AlterTable
ALTER TABLE "Evento" DROP COLUMN "bannerUrl",
DROP COLUMN "certificadoBaseUrl",
ADD COLUMN     "bannerArquivoId" TEXT,
ADD COLUMN     "certificadoBaseArquivoId" TEXT,
ADD COLUMN     "tokenRemoto" TEXT;

-- AlterTable
ALTER TABLE "Instituicao" DROP COLUMN "logoUrl",
ADD COLUMN     "logoArquivoId" TEXT;

-- O material de apoio passa a apontar para uma linha de Arquivo, em vez de
-- guardar um endereço solto. Qualquer linha anterior referenciava a coluna
-- `arquivoUrl`, que deixa de existir — sem arquivo correspondente registrado,
-- ela não teria como ser migrada nem como ser servida.
DELETE FROM "MaterialApoio";

-- AlterTable
ALTER TABLE "MaterialApoio" DROP COLUMN "arquivoUrl",
DROP COLUMN "tamanhoBytes",
ADD COLUMN     "arquivoId" TEXT NOT NULL,
ADD COLUMN     "ordem" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "codigoUsuario" TEXT;

-- Preenche o código pessoal das contas criadas antes desta coluna, no mesmo
-- formato e com o mesmo alfabeto legível que a aplicação usa (sem 0/O, 1/I/L,
-- 2/Z, 5/S e 8/B, que se confundem quando alguém digita o que leu na tela).
DO $$
DECLARE
  alfabeto CONSTANT TEXT := 'ACDEFGHJKMNPQRTUVWXY34679';
  linha RECORD;
  codigo TEXT;
BEGIN
  FOR linha IN SELECT "id" FROM "Usuario" WHERE "codigoUsuario" IS NULL LOOP
    LOOP
      codigo := 'USR-';
      FOR i IN 1..4 LOOP
        codigo := codigo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
      END LOOP;
      codigo := codigo || '-';
      FOR i IN 1..4 LOOP
        codigo := codigo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "Usuario" WHERE "codigoUsuario" = codigo);
    END LOOP;
    UPDATE "Usuario" SET "codigoUsuario" = codigo WHERE "id" = linha."id";
  END LOOP;
END $$;

ALTER TABLE "Usuario" ALTER COLUMN "codigoUsuario" SET NOT NULL;

-- CreateTable
CREATE TABLE "Arquivo" (
    "id" TEXT NOT NULL,
    "nomeOriginal" TEXT NOT NULL,
    "tipoMime" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "caminho" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoPorId" TEXT NOT NULL,

    CONSTRAINT "Arquivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Arquivo_caminho_key" ON "Arquivo"("caminho");

-- CreateIndex
CREATE INDEX "Arquivo_enviadoPorId_idx" ON "Arquivo"("enviadoPorId");

-- `tokenRemoto` fica nulo aqui de propósito. Ele é o segredo da página de
-- registro à distância, e a aplicação o gera com o gerador criptográfico do
-- Node na primeira vez que o gestor abre um evento online ou híbrido sem ele.
-- Preenchê-lo aqui exigiria a extensão pgcrypto ou um md5 sobre random(), que
-- não é gerador criptográfico — nenhum dos dois vale para guardar um segredo.

-- CreateIndex
CREATE UNIQUE INDEX "Evento_tokenRemoto_key" ON "Evento"("tokenRemoto");

-- CreateIndex
CREATE INDEX "Evento_certificadoBaseArquivoId_idx" ON "Evento"("certificadoBaseArquivoId");

-- CreateIndex
CREATE INDEX "Evento_bannerArquivoId_idx" ON "Evento"("bannerArquivoId");

-- CreateIndex
CREATE INDEX "Instituicao_logoArquivoId_idx" ON "Instituicao"("logoArquivoId");

-- CreateIndex
CREATE INDEX "MaterialApoio_arquivoId_idx" ON "MaterialApoio"("arquivoId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_codigoUsuario_key" ON "Usuario"("codigoUsuario");

-- AddForeignKey
ALTER TABLE "Instituicao" ADD CONSTRAINT "Instituicao_logoArquivoId_fkey" FOREIGN KEY ("logoArquivoId") REFERENCES "Arquivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_bannerArquivoId_fkey" FOREIGN KEY ("bannerArquivoId") REFERENCES "Arquivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_certificadoBaseArquivoId_fkey" FOREIGN KEY ("certificadoBaseArquivoId") REFERENCES "Arquivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialApoio" ADD CONSTRAINT "MaterialApoio_arquivoId_fkey" FOREIGN KEY ("arquivoId") REFERENCES "Arquivo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Arquivo" ADD CONSTRAINT "Arquivo_enviadoPorId_fkey" FOREIGN KEY ("enviadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

