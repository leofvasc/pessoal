-- Instituição organizadora com gestores vinculados, suspensão de conta e
-- trilha administrativa.
--
-- A decisão de produto que motiva esta migração: a PlanA serve a um círculo
-- definido de instituições, e ninguém se torna organizador por conta própria.
-- O master cadastra a instituição e vincula a ela uma conta já existente. É
-- esse vínculo, e não uma marcação na conta, que cria um organizador.
--
-- Por isso PerfilOrganizador, criado na migração anterior, é absorvido por
-- Instituicao. Os dados já preenchidos são migrados antes de a tabela cair:
-- nenhuma linha é perdida.

-- 1. Instituicao ganha a identidade que estava no perfil.
ALTER TABLE "Instituicao" ADD COLUMN "tipo" "TipoOrganizador" NOT NULL DEFAULT 'PESSOA_JURIDICA';
ALTER TABLE "Instituicao" ADD COLUMN "nomeCurto" TEXT;
ALTER TABLE "Instituicao" ADD COLUMN "documento" TEXT;
ALTER TABLE "Instituicao" ADD COLUMN "emailContato" TEXT;
ALTER TABLE "Instituicao" ADD COLUMN "telefoneContato" TEXT;
ALTER TABLE "Instituicao" ADD COLUMN "site" TEXT;
ALTER TABLE "Instituicao" ADD COLUMN "esfera" TEXT;
ALTER TABLE "Instituicao" ADD COLUMN "anotacaoInterna" TEXT;
ALTER TABLE "Instituicao" ADD COLUMN "suspensaEm" TIMESTAMP(3);
ALTER TABLE "Instituicao" ADD COLUMN "motivoSuspensao" TEXT;
ALTER TABLE "Instituicao" ADD COLUMN "atualizadoEm" TIMESTAMP(3);

UPDATE "Instituicao" SET "atualizadoEm" = COALESCE("criadoEm", CURRENT_TIMESTAMP);
ALTER TABLE "Instituicao" ALTER COLUMN "atualizadoEm" SET NOT NULL;

CREATE INDEX "Instituicao_tipo_idx" ON "Instituicao"("tipo");

-- 2. Vínculo entre conta e instituição gerida.
CREATE TABLE "InstituicaoGestor" (
    "instituicaoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "vinculadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vinculadoPor" TEXT,

    CONSTRAINT "InstituicaoGestor_pkey" PRIMARY KEY ("instituicaoId", "usuarioId")
);

CREATE INDEX "InstituicaoGestor_usuarioId_idx" ON "InstituicaoGestor"("usuarioId");

ALTER TABLE "InstituicaoGestor"
    ADD CONSTRAINT "InstituicaoGestor_instituicaoId_fkey"
    FOREIGN KEY ("instituicaoId") REFERENCES "Instituicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstituicaoGestor"
    ADD CONSTRAINT "InstituicaoGestor_usuarioId_fkey"
    FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Migração dos perfis já preenchidos.
--    Cada perfil vira instituição, salvo quando já existir instituição com o
--    mesmo nome — caso em que ela é enriquecida em vez de duplicada. Em ambos
--    os casos, o titular do perfil fica vinculado como gestor.

-- 3.1 Enriquece instituições homônimas com os dados do perfil.
UPDATE "Instituicao" i
SET "tipo" = p."tipo",
    "nomeCurto" = COALESCE(i."nomeCurto", p."nomeCurto"),
    "documento" = COALESCE(i."documento", p."documento"),
    "emailContato" = COALESCE(i."emailContato", p."emailContato"),
    "telefoneContato" = COALESCE(i."telefoneContato", p."telefoneContato"),
    "site" = COALESCE(i."site", p."site"),
    "esfera" = COALESCE(i."esfera", p."esfera"),
    "anotacaoInterna" = COALESCE(i."anotacaoInterna", p."anotacaoInterna"),
    "suspensaEm" = p."suspensoEm",
    "motivoSuspensao" = p."motivoSuspensao",
    "atualizadoEm" = CURRENT_TIMESTAMP
FROM "PerfilOrganizador" p
WHERE i."nome" = p."nomeOrganizador";

-- 3.2 Cria instituição para os perfis sem homônima.
INSERT INTO "Instituicao" (
    "id", "nome", "tipo", "nomeCurto", "documento", "emailContato",
    "telefoneContato", "site", "esfera", "anotacaoInterna", "suspensaEm",
    "motivoSuspensao", "criadoEm", "atualizadoEm"
)
SELECT p."id", p."nomeOrganizador", p."tipo", p."nomeCurto", p."documento",
       p."emailContato", p."telefoneContato", p."site", p."esfera",
       p."anotacaoInterna", p."suspensoEm", p."motivoSuspensao",
       p."criadoEm", CURRENT_TIMESTAMP
FROM "PerfilOrganizador" p
WHERE NOT EXISTS (
    SELECT 1 FROM "Instituicao" i WHERE i."nome" = p."nomeOrganizador"
);

-- 3.3 Vincula cada titular de perfil como gestor da instituição correspondente.
INSERT INTO "InstituicaoGestor" ("instituicaoId", "usuarioId", "vinculadoEm", "vinculadoPor")
SELECT i."id", p."usuarioId", CURRENT_TIMESTAMP, 'migracao'
FROM "PerfilOrganizador" p
JOIN "Instituicao" i ON i."nome" = p."nomeOrganizador"
ON CONFLICT DO NOTHING;

-- 3.4 Toda conta que já organiza evento precisa continuar organizando: sem o
--     vínculo ela perderia o painel na primeira consulta pós-implantação.
--     Vincula à primeira instituição do evento, quando houver.
INSERT INTO "InstituicaoGestor" ("instituicaoId", "usuarioId", "vinculadoEm", "vinculadoPor")
SELECT DISTINCT ON (e."organizadorId") ei."instituicaoId", e."organizadorId",
       CURRENT_TIMESTAMP, 'migracao'
FROM "Evento" e
JOIN "EventoInstituicao" ei ON ei."eventoId" = e."id"
WHERE NOT EXISTS (
    SELECT 1 FROM "InstituicaoGestor" g WHERE g."usuarioId" = e."organizadorId"
)
ORDER BY e."organizadorId", ei."ordem" ASC
ON CONFLICT DO NOTHING;

DROP TABLE "PerfilOrganizador";

-- 4. Suspensão administrativa da conta. Bloqueia login sem apagar nada.
ALTER TABLE "Usuario" ADD COLUMN "suspensoEm" TIMESTAMP(3);
ALTER TABLE "Usuario" ADD COLUMN "motivoSuspensao" TEXT;

-- 5. Trilha do que o master faz. Poder administrativo sem registro é o que
--    costuma dar errado: depois de uma suspensão contestada, ninguém consegue
--    reconstruir quem fez o quê.
CREATE TABLE "RegistroAdministrativo" (
    "id" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "autorNome" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "alvoTipo" TEXT NOT NULL,
    "alvoId" TEXT NOT NULL,
    "alvoNome" TEXT NOT NULL,
    "detalhe" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroAdministrativo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RegistroAdministrativo_alvoTipo_alvoId_idx"
    ON "RegistroAdministrativo"("alvoTipo", "alvoId");
CREATE INDEX "RegistroAdministrativo_criadoEm_idx" ON "RegistroAdministrativo"("criadoEm");
