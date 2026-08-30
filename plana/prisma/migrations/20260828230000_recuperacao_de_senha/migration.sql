-- Link temporário e de uso único para o fluxo "Esqueci a senha".
-- Somente o hash do token é armazenado; o valor enviado por e-mail não fica no banco.
CREATE TABLE "RedefinicaoSenha" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),

    CONSTRAINT "RedefinicaoSenha_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RedefinicaoSenha_tokenHash_key" ON "RedefinicaoSenha"("tokenHash");
CREATE INDEX "RedefinicaoSenha_usuarioId_usadoEm_idx" ON "RedefinicaoSenha"("usuarioId", "usadoEm");
CREATE INDEX "RedefinicaoSenha_expiraEm_idx" ON "RedefinicaoSenha"("expiraEm");

ALTER TABLE "RedefinicaoSenha" ADD CONSTRAINT "RedefinicaoSenha_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
