-- Exclusão da conta pelo próprio titular e gratuidade do evento.
--
-- 1. CertificadoArquivado: mantém validável o certificado já entregue a
--    terceiros depois que a conta do participante é apagada. O nome não fica
--    aqui em texto legível — só um hash bcrypt, que permite confirmar um nome
--    já lido no documento, e não descobrir quem participou de quê. Sem chave
--    estrangeira para Usuario ou Evento: não há caminho de volta para pessoa.
--
-- 2. Contadores agregados no Evento, para que o total histórico de inscritos e
--    presentes não mude quando alguém exclui a conta.
--
-- 3. Campos de gratuidade do evento. A plataforma não processa pagamento: os
--    campos informam o participante antes da inscrição.

CREATE TABLE "CertificadoArquivado" (
    "id" TEXT NOT NULL,
    "codigoValidacao" TEXT NOT NULL,
    "nomeHash" TEXT NOT NULL,
    "eventoNome" TEXT NOT NULL,
    "eventoInicioEm" TIMESTAMP(3) NOT NULL,
    "cargaHorariaMinutos" INTEGER NOT NULL,
    "organizacoes" TEXT NOT NULL,
    "metodoPresenca" "MetodoPresenca" NOT NULL,
    "presencaRegistradaEm" TIMESTAMP(3) NOT NULL,
    "liberadoEm" TIMESTAMP(3) NOT NULL,
    "arquivadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificadoArquivado_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CertificadoArquivado_codigoValidacao_key"
    ON "CertificadoArquivado"("codigoValidacao");

ALTER TABLE "Evento" ADD COLUMN "inscricoesDeContasExcluidas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Evento" ADD COLUMN "presencasDeContasExcluidas" INTEGER NOT NULL DEFAULT 0;

-- Eventos já cadastrados nasceram sem a distinção e todos foram gratuitos:
-- o padrão verdadeiro preserva a realidade do que já está no ar.
ALTER TABLE "Evento" ADD COLUMN "gratuito" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Evento" ADD COLUMN "valorCentavos" INTEGER;
ALTER TABLE "Evento" ADD COLUMN "instrucoesPagamento" TEXT;
