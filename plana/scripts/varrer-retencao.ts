/**
 * Varredura de retenção mínima (planejamento, seção 9).
 *
 * Descarta as coordenadas de check-in cuja finalidade já se esgotou. Pensada
 * para rodar uma vez por dia na VPS, por cron:
 *
 *     0 4 * * *  cd /opt/plana && docker compose exec -T app npm run retencao
 */
import { varrerRetencao } from "../src/lib/retencao";

varrerRetencao()
  .then(({ descartadas, redefinicoesExcluidas }) => {
    console.log(`coordenadas descartadas: ${descartadas}`);
    console.log(`tokens de redefinição excluídos: ${redefinicoesExcluidas}`);
    process.exit(0);
  })
  .catch((erro) => {
    console.error("falha na varredura de retenção:", erro);
    process.exit(1);
  });
