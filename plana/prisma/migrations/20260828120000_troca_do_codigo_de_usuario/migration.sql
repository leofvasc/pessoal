-- Troca do código pessoal do participante, para o caso de ele suspeitar que o
-- código vazou.
--
-- Só acrescenta: a coluna nova é anulável e a tabela é nova, então esta
-- migração roda sem risco em banco com dados.

-- AlterEnum
ALTER TYPE "TipoNotificacao" ADD VALUE 'SEGURANCA_CONTA';

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "codigoUsuarioTrocadoEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CodigoUsuarioAposentado" (
    "codigo" TEXT NOT NULL,
    "aposentadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodigoUsuarioAposentado_pkey" PRIMARY KEY ("codigo")
);

