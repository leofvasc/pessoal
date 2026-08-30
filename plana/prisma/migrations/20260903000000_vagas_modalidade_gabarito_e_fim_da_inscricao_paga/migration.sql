-- Controle de vagas, modalidade da inscrição, gabarito do certificado e fim da
-- inscrição paga.
--
-- Quatro mudanças que se sustentam entre si:
--
--  1. o evento passa a poder limitar quantas inscrições aceita, separadamente
--     para a sala e para a transmissão — são lotações diferentes, com causas
--     diferentes, e uma não deve fechar a outra;
--  2. por consequência, a inscrição em evento híbrido passa a dizer em qual
--     das duas modalidades a pessoa participa. Sem isso não há o que contar;
--  3. a configuração global ganha o gabarito de medidas do certificado, que o
--     organizador baixa antes de produzir a própria arte;
--  4. a inscrição paga sai. A plataforma nunca processou pagamento; o que
--     havia era informação ao participante, e ela deixa de existir.

-- ---------------------------------------------------------------------------
-- 1. Modalidade da inscrição
-- ---------------------------------------------------------------------------

CREATE TYPE "ModalidadeInscricao" AS ENUM ('PRESENCIAL', 'ONLINE');

ALTER TABLE "Inscricao"
    ADD COLUMN "modalidade" "ModalidadeInscricao" NOT NULL DEFAULT 'PRESENCIAL';

-- As inscrições que já existiam herdam a modalidade do evento. O híbrido é o
-- único caso sem resposta certa: ninguém foi perguntado quando se inscreveu, e
-- a plataforma não inventa a resposta. Fica PRESENCIAL, que é o padrão da
-- coluna, e o organizador ajusta se for o caso — a lista de inscritos mostra a
-- modalidade de cada um.
UPDATE "Inscricao" i
SET "modalidade" = 'ONLINE'
FROM "Evento" e
WHERE e."id" = i."eventoId" AND e."modalidade" = 'ONLINE';

CREATE INDEX "Inscricao_eventoId_modalidade_canceladaEm_idx"
    ON "Inscricao"("eventoId", "modalidade", "canceladaEm");

-- ---------------------------------------------------------------------------
-- 2. Vagas por modalidade
-- ---------------------------------------------------------------------------

-- Nulo é "sem limite", e é o estado em que todo evento já existente fica: até
-- aqui nenhum deles fechava por lotação, e a migração não pode passar a fechar.
ALTER TABLE "Evento" ADD COLUMN "vagasPresencial" INTEGER;
ALTER TABLE "Evento" ADD COLUMN "vagasOnline" INTEGER;

-- ---------------------------------------------------------------------------
-- 3. Gabarito do certificado
-- ---------------------------------------------------------------------------

ALTER TABLE "Configuracao" ADD COLUMN "gabaritoCertificadoArquivoId" TEXT;

CREATE INDEX "Configuracao_gabaritoCertificadoArquivoId_idx"
    ON "Configuracao"("gabaritoCertificadoArquivoId");

ALTER TABLE "Configuracao"
    ADD CONSTRAINT "Configuracao_gabaritoCertificadoArquivoId_fkey"
    FOREIGN KEY ("gabaritoCertificadoArquivoId") REFERENCES "Arquivo"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. Fim da inscrição paga
-- ---------------------------------------------------------------------------
--
-- As três colunas caem. Elas eram informativas — a cobrança sempre aconteceu
-- fora da PlanA —, e mantê-las sem tela que as preencha seria guardar dado sem
-- finalidade, que é justamente o que a plataforma se propõe a não fazer.
--
-- ATENÇÃO na implantação: se houver evento cadastrado como pago, o valor e as
-- instruções de pagamento são descartados aqui e não há como recuperá-los
-- depois. Confira antes de aplicar:
--
--   SELECT "codigoEvento", "nome", "valorCentavos", "instrucoesPagamento"
--     FROM "Evento" WHERE "gratuito" = false;
--
-- A página pública e a agenda passam a declarar gratuidade para todo evento.

ALTER TABLE "Evento" DROP COLUMN "instrucoesPagamento";
ALTER TABLE "Evento" DROP COLUMN "valorCentavos";
ALTER TABLE "Evento" DROP COLUMN "gratuito";
