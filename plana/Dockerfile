# Imagem de produção da PlanA.
#
# Multi-estágio: as dependências de build (Prisma CLI, TypeScript, toolchain do
# Next) ficam fora da imagem que serve o site. O mesmo Dockerfile produz um
# segundo alvo, `ferramentas`, usado só para migrações e tarefas de manutenção
# — é ele que tem o código-fonte e o node_modules completo.

FROM node:22-alpine AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS construcao
WORKDIR /app
COPY --from=dependencias /app/node_modules ./node_modules
COPY . .
# O cliente do Prisma é gerado em src/generated, que fica fora do versionamento.
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------------------------------------------------------------------------
# Alvo de manutenção: migrações, criação do organizador, varredura de retenção.
# Roda e sai; não fica de pé.
# ---------------------------------------------------------------------------
FROM construcao AS ferramentas
WORKDIR /app
ENV NODE_ENV=production
CMD ["npx", "prisma", "migrate", "deploy"]

# ---------------------------------------------------------------------------
# Alvo de produção: só o servidor.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS producao
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuário sem privilégios: a aplicação não precisa de root para nada.
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs plana

COPY --from=construcao --chown=plana:nodejs /app/public ./public
COPY --from=construcao --chown=plana:nodejs /app/.next/standalone ./
COPY --from=construcao --chown=plana:nodejs /app/.next/static ./.next/static

# As fontes da marca são lidas do disco em tempo de execução para montar o PDF
# do certificado — o standalone não as arrasta sozinho, por não serem
# importadas como módulo.
COPY --from=construcao --chown=plana:nodejs /app/src/assets/fontes ./src/assets/fontes

USER plana
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
