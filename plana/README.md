# PlanA

Plataforma de gestão de eventos: inscrição, registro de presença por leitura de
QR Code com geolocalização e emissão automática de certificado.

Ferramenta de uso pessoal, com identidade própria e independente de qualquer
instituição organizadora. O escopo vem de *Planejamento da Plataforma PlanA*; a
identidade visual, do *Manual de identidade visual PlanA v1.0*. Os comentários
do código citam a seção do documento que justifica cada decisão.

## O que já está de pé

| Área | Situação |
|---|---|
| Identidade visual | Símbolo em malha 11u, três lockups, loop de check-in, paleta e tipografia como tokens |
| Modelo de dados | Schema completo em PostgreSQL, com a retenção mínima expressa no próprio schema |
| Conta e consentimento | Cadastro com perfis, sessão própria, consentimento por finalidade com o texto lido gravado |
| Evento | Criação com pino manual no mapa, fuso do Acre com espelho de Brasília, QR de presença e de divulgação |
| Presença | Leitura do QR cruzada com login e geolocalização (70 m), lançamento manual pela organização |
| Certificado | Gerado sob demanda em PDF A4 paisagem sobre a imagem-base do evento, com bloco de validação e consulta pública |
| Presença a distância | Página própria por evento online ou híbrido, com código pessoal do participante e limite de tentativas |
| Painel do gestor | Cadastro de instituições com logotipo, imagem-base do certificado e material de apoio para os inscritos |
| Notificações | Central interna mais push do navegador, com o caminho de instalação do iOS tratado |
| PWA | Manifesto, service worker, ícones e ícone *maskable* gerados da especificação da marca |
| Implantação | Docker Compose com Postgres e Caddy (TLS automático) para a VPS |

### O que ainda não está

- Upload da imagem-base do certificado e do material de apoio (o schema já
  prevê; falta a tela e o armazenamento em disco).
- Cadastro de instituições organizadoras pela interface.
- Relatórios exportáveis por evento e por período.
- Chamados de suporte (schema pronto, telas pendentes).
- E-mail transacional e a integração com a API do WhatsApp Business — ambos
  dependem de decisões de fornecedor ainda em aberto no planejamento.

## Stack

Next.js 16 (App Router) e TypeScript do front ao backend, PostgreSQL com Prisma,
Tailwind CSS 4. Leaflet sobre OpenStreetMap no mapa, `pdf-lib` no certificado,
`web-push` nas notificações.

A escolha de uma stack única foi feita pensando na VPS autogerida: um processo,
um `docker compose up`, um lugar só para procurar quando algo quebra.

## Desenvolvimento

```bash
npm install
cp .env.example .env      # preencha DATABASE_URL e AUTH_SECRET
npm run chaves:vapid      # opcional — só para testar push
npx prisma migrate deploy
npm run dev
```

Precisa de um PostgreSQL acessível. Para subir um local rapidamente:

```bash
docker run -d --name plana-pg -p 5432:5432 \
  -e POSTGRES_USER=plana -e POSTGRES_PASSWORD=plana -e POSTGRES_DB=plana \
  postgres:17-alpine
```

Crie a conta de organizador — não há tela para isso de propósito:

```bash
npm run organizador -- voce@dominio "Seu Nome"
```

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run typecheck` | Gera os tipos de rota e roda o TypeScript |
| `npm run lint` | ESLint |
| `npm run icones` | Regera os ícones do PWA a partir da especificação da marca |
| `npm run verificar:certificado` | Gera um certificado de exemplo em `saida/` |
| `npm run chaves:vapid` | Gera o par de chaves das notificações push |
| `npm run organizador` | Cria ou promove a conta de organizador |
| `npm run retencao` | Varredura de retenção mínima (para o cron diário) |
| `npm run semear:verificacao` | Popula o banco local com dois eventos (um presencial, um híbrido) e dois usuários de teste |

## Implantação na VPS Hostinger

Vale para um plano KVM autogerenciado, com data center no Brasil para reduzir a
latência de acesso a partir do Acre.

1. **Aponte o domínio** para o IP da VPS (registros `A` e `AAAA`).

2. **Instale o Docker** e clone o repositório:

   ```bash
   curl -fsSL https://get.docker.com | sh
   git clone <repositório> /opt/plana && cd /opt/plana
   ```

3. **Gere o `.env`** — ele pergunta o domínio e sorteia as senhas:

   ```bash
   bash scripts/preparar-env.sh
   ```

   As chaves de push ficam vazias por ora; sem elas o push fica desligado e a
   central de notificações interna continua funcionando. Para ligá-lo depois:

   ```bash
   docker compose run --rm migracoes npm run chaves:vapid
   ```

   Copie as três linhas para o `.env` e rode `docker compose up -d` de novo.

4. **Suba:**

   ```bash
   docker compose up -d --build
   docker compose run --rm migracoes npm run organizador -- voce@dominio "Seu Nome"
   ```

   As migrações rodam sozinhas, como serviço próprio, antes de a aplicação
   subir — não há passo manual a lembrar. O Caddy emite o certificado TLS na
   primeira requisição ao domínio e o renova sozinho.

5. **Agende a varredura de retenção** no cron do host:

   ```
   0 4 * * *  cd /opt/plana && docker compose run --rm migracoes npm run retencao
   ```

   Ela apaga as coordenadas de check-in cuja finalidade já se esgotou. Não é
   opcional: é o que faz a retenção mínima acontecer na prática.

6. **Backup do banco** — o volume `dados-do-banco` guarda tudo que não pode ser
   reconstruído:

   ```
   30 3 * * *  docker compose -f /opt/plana/docker-compose.yml exec -T banco \
                 pg_dump -U plana plana | gzip > /var/backups/plana-$(date +\%F).sql.gz
   ```

### Atualizar

```bash
cd /opt/plana && git pull
docker compose up -d --build
```

O serviço `migracoes` reaplica o que houver de novo antes de a aplicação
reiniciar.

## Proteção de dados

A conformidade com a LGPD é diretriz de programação, não camada posterior. Na
prática, no código:

- **Coleta mínima.** O telefone só é gravado quando há consentimento de WhatsApp;
  revogado o consentimento, o campo é apagado no mesmo instante
  (`src/app/acoes-conta-privacidade.ts`).
- **Consentimento por finalidade.** Cada aceite é uma linha própria com o texto
  exato que o titular leu, copiado de `src/lib/consentimento.ts` — o que ele viu
  e o que ficou registrado são a mesma string.
- **Retenção mínima.** A coordenada do check-in é descartada quando o
  certificado é emitido, e em até 90 dias se ele nunca for
  (`src/lib/retencao.ts`). O registro da presença permanece; o dado pessoal, não.
- **Transparência.** `/privacidade` monta a tabela de retenção a partir das
  próprias constantes que o código aplica, e não de texto copiado — a página não
  consegue descrever uma regra diferente da executada.
- **Nada guardado à toa.** O PDF do certificado não é armazenado: é montado a
  cada download. Da mesma forma, a tabela de códigos aposentados guarda só o
  código — não de quem ele era: essa ligação não serviria à finalidade de
  impedir a reatribuição, e portanto não se guarda.
- **Arquivo não é público por descuido.** Os envios do gestor ficam fora de
  `public/` e passam por `/arquivos/[id]`, que decide por uso: logotipo e banner
  são públicos; material de apoio é só de quem está inscrito no evento; a
  imagem-base do certificado é só do organizador.

## Arquivos enviados pelo gestor

Imagem-base de certificado, logotipos, banners e material de apoio ficam no
volume `arquivos`, fora da imagem da aplicação — junto com o banco, é o único
conteúdo que não se reconstrói, e o único que precisa de backup.

O tipo de cada arquivo é apurado pelos bytes iniciais, não pela extensão nem
pelo `Content-Type` do navegador: os dois são escolhidos por quem envia. O nome
em disco é gerado pela plataforma, então o nome original nunca vira caminho.
Limites e formatos aceitos por categoria estão em `src/lib/armazenamento.ts`.

## Identidade visual

Três coisas nunca mudam, e estão codificadas em `src/components/marca/`:

- a malha de 11u do símbolo (`Simbolo.tsx`);
- a hierarquia de cor dos módulos — base sólida, diagonais, vazios;
- o desenho do logotipo (`Logotipo.tsx`), em Plus Jakarta Sans ExtraBold com
  tracking de −3,8%.

A animação oficial — o loop de check-in, com ordem de entrada 6, 7, 8, 3, 5, 1,
0, 2, 4 e passo de 260 ms — está em `LoopCheckin.tsx` e respeita
`prefers-reduced-motion`. Os ícones do PWA saem da mesma especificação por
`scripts/gerar-icones.py`; não edite os PNGs à mão.

As fontes estão vendorizadas em `src/assets/fontes/` (SIL Open Font License,
licenças incluídas) porque o certificado é montado no servidor e não pode
depender de acesso ao Google Fonts.
