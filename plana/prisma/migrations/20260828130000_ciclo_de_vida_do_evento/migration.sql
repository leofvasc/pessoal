-- O cancelamento preserva a página pública e o histórico do evento.
ALTER TABLE "Evento" ADD COLUMN "canceladoEm" TIMESTAMP(3);

-- A exclusão é lógica para não apagar inscrições, presenças e certificados.
ALTER TABLE "Evento" ADD COLUMN "excluidoEm" TIMESTAMP(3);

CREATE INDEX "Evento_excluidoEm_idx" ON "Evento"("excluidoEm");
