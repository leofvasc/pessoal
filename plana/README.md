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
| Conta e consentimento | Cadastro com perfis, atualização de e-mail e telefone, troca e recuperação de senha, sessão própria e consentimento por finalidade |
| Evento | Criação e edição com vários palestrantes, pino manual no mapa, fuso do Acre com espelho de Brasília, banner, publicação, despublicação, cancelamento, exclusão lógica e QRs |
| Agenda pública | Home pesquisável com banners, filtros de inscrições abertas e eventos encerrados |
| Presença | Leitura do QR cruzada com login e geolocalização (70 m), lançamento manual pela organização |
| Certificado | Gerado sob demanda em PDF A4 paisagem sobre a imagem-base do evento — ou sobre o modelo padrão mantido pela plataforma —, com bloco de validação e consulta pública. A validação digital substitui a assinatura |
| Presença a distância | Página própria por evento online ou híbrido, com código pessoal do participante e limite de tentativas |
| Painel do gestor | Cadastro de instituições com logotipo, imagem-base do certificado e material de apoio para os inscritos |
| Configurações globais | Modelo padrão de certificado enviado uma única vez e aplicado a todo evento novo, substituível por evento |
| Suporte | Chamados com conversa, estados de atendimento e notificações para participante e organizador |
| Notificações | Central interna mais push do navegador, com o caminho de instalação do iOS tratado |
| PWA | Manifesto, service worker, ícones e ícone *maskable* gerados da especificação da marca |
| Implantação | Docker Compose com Postgres e Caddy (TLS automático) para a VPS |

### O que ainda depende de decisão externa

- O fluxo de recuperação de senha está integrado à API do Resend, mas depende
  de criar a conta, validar o domínio e preencher `RESEND_API_KEY` e
  `EMAIL_REMETENTE`. A integração com a API do WhatsApp Business segue sem
  fornecedor. A central interna e o Web Push permanecem como canais já operacionais.
- Relatórios exportáveis por evento e por período ainda não fazem parte desta
  versão.

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

   A chave do Resend e as chaves de push ficam vazias por ora. Sem Resend, o
   fluxo "Esqueci a senha" não consegue entregar o link. Sem VAPID, o push fica desligado e a
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
   30 3 * * *  cd /opt/plana && docker compose exec -T banco sh -c \
                 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -U plana plana' \
                 | gzip > /var/backups/plana-banco-$(date +\%F).sql.gz
   ```

   E os arquivos enviados pelo gestor, que também não se reconstroem:

   ```
   45 3 * * *  cd /opt/plana && docker compose run --rm -v /var/backups:/backup \
                 migracoes tar -czf /backup/plana-arquivos-$(date +\%F).tar.gz -C /app/arquivos .
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
  imagem-base do certificado é só do organizador, e o mesmo vale para o modelo
  padrão da plataforma.
- **Exclusão de conta pelo titular.** Em `/conta/excluir`, com senha e frase
  digitada. A exclusão é física e imediata, sem prazo de arrependimento: a linha
  do usuário sai e o schema cascateia consentimentos, inscrições, presenças,
  certificados, notificações, assinaturas de push, chamados, mensagens e pedidos
  de redefinição (`src/lib/exclusao-de-conta.ts`). Não há marcação lógica de
  conta apagada com os dados intactos por trás.

### Como o certificado sobrevive à exclusão sem guardar quem o recebeu

O certificado já emitido circula em poder de terceiros e traz um código impresso
que aponta para a consulta pública. Apagá-lo junto com a conta faria a
plataforma negar autenticidade a um documento verdadeiro que ela mesma emitiu,
prejudicando quem não participou da decisão de excluir.

A saída foi separar validar de identificar. Para cada certificado fica uma linha
em `CertificadoArquivado` com evento, data, carga horária, organizadoras e
método da presença — dados sobre a atividade, não sobre a pessoa. Do nome fica
apenas um hash bcrypt de custo 12 (`src/lib/verificacao-nome.ts`).

A consulta pública, nesses casos, não exibe nome nenhum: ela oferece um campo
para quem estiver conferindo digitar o nome que lê no documento em mãos, e
responde só se confere. Não se lê nem se lista o nome a partir do registro; só
se confirma um nome já conhecido. Acento, caixa e espaço extra são normalizados
antes da comparação.

O limite é honesto: nome é segredo de baixa entropia, então isso é
pseudonimização, não anonimização perfeita. Contêm o risco a necessidade de já
possuir o código impresso, a lentidão do bcrypt e o teto de cinco conferências
por código a cada quinze minutos. Quem tem o certificado em mãos já lê o nome
nele — o registro não entrega nada além disso.

Como não sobra dado pessoal legível, o arquivamento não é escolha do titular: não
há o que eliminar. Os totais de inscritos e presentes do evento seguem em
contadores agregados, sem nome nem identificador.

Conta de organizador não se autoexclui: ela responde por eventos publicados,
arquivos e lançamentos de presença de terceiros, e o próprio schema recusaria a
operação. A tentativa abre um popup explicando e encaminhando ao chamado.

O comportamento é coberto por `npm run testar:exclusao`, que roda contra um
Postgres real — cascatas, restrições e transação são comportamento do banco, e
teste com banco falso não os prova.

## Papéis, instituições organizadoras e alcance

Três papéis. **Participante** se inscreve e recebe certificado. **Organizador**
gere os eventos das instituições que administra e nunca enxerga evento alheio.
**Master** faz tudo que o organizador faz e mais: cadastra instituições, vincula
contas a elas, opera contas de usuário e emite relatório sobre a base inteira.

A diferença entre organizador e master não está no que se pode fazer com um
evento, e sim em quais eventos se alcança. Por isso as ações de gestão chamam
todas `exigirOrganizador`, e o recorte fica em `escopoDeEventos` — um só lugar,
em vez de espalhado por cada consulta.

### Ninguém se torna organizador por conta própria

A PlanA serve a um círculo definido de instituições. O master cadastra a
instituição em Configurações e vincula a ela uma conta **já existente**. É esse
vínculo — a tabela `InstituicaoGestor` — que cria um organizador. O papel na
conta é consequência, não causa: `sincronizarPapel` promove quem passa a ter
vínculo e devolve à condição de participante quem deixa de ter. Master nunca é
rebaixado por aí, porque esse papel é decisão administrativa própria.

O motivo é o valor do produto. A página pública declara o certificado autêntico.
Se qualquer pessoa pudesse ativar um painel e emitir, bastaria cadastrar uma
organização com nome de universidade para a plataforma passar a avalizar
credencial fabricada — e esses documentos circulam para horas complementares,
educação continuada e progressão funcional.

A conta é uma só. Quem gere uma instituição continua se inscrevendo em eventos
alheios com a mesma conta, e desvincular não lhe tira inscrição, presença nem
certificado.

### Instituição é crédito e responsabilidade ao mesmo tempo

`Instituicao` absorveu o antigo `PerfilOrganizador`. Ela continua sendo o nome e
o logotipo impressos no certificado, e passou a carregar natureza jurídica —
pessoa física, pessoa jurídica ou órgão público —, documento, contatos e
suspensão. Um evento pode ter várias, e o organizador só assina em nome das que
gere: `definirOrganizadoras` recusa identificador de instituição alheia.

CPF e CNPJ são opcionais, por minimização (art. 6º, III, da LGPD). Quando
informados, os dígitos verificadores são conferidos — documento errado é pior
que documento ausente, porque parece identificar alguém e não identifica
ninguém.

### Controles do master sobre contas

Em Configurações, o master busca contas por nome ou e-mail e pode suspender o
login, promover ou retirar o papel master, redefinir senha e excluir a conta. A
lista não é exibida inteira de propósito: folhear cadastro de participante sem
motivo é tratamento sem finalidade, e a busca cobre o que a administração
precisa.

A exclusão administrativa reaproveita `excluirConta`, a mesma rotina do titular:
apaga os dados pessoais e mantém validáveis os certificados já emitidos, sem
nome legível. Não existe caminho administrativo mais destrutivo que o do dono da
conta. Exige motivo por escrito.

Suspender conta bloqueia o login sem apagar nada. Suspender instituição impede
eventos novos e preserva histórico e relatórios. Em ambos os casos a pessoa é
notificada.

### Trilha administrativa

Todo ato do master sobre conta ou instituição vira linha em
`RegistroAdministrativo`: quem fez, o quê, sobre quem, quando e por quê. Poder
administrativo sem trilha é o que costuma dar errado — depois de uma suspensão
contestada, ninguém reconstrói o que houve. O art. 37 da LGPD já obriga o
controlador a manter registro das operações; aqui isso é linha de banco, não
promessa.

O primeiro master nasce por `npm run organizador`, porque não há quem o crie.

## Campos personalizados de inscrição

Cada instituição pergunta algo diferente — o período que o aluno cursa, a lotação
da servidora, o número da OAB. Engessar isso no schema obrigaria a alterar o
banco a cada evento, e o organizador dependeria do desenvolvedor para uma
pergunta de uma linha.

Sem campo configurado, a inscrição se efetiva no clique, como sempre foi:
nenhuma tela nova aparece para quem não precisa dela. Com um campo ou mais, o
participante passa por `/eventos/[slug]/inscricao` antes da confirmação.

O preço da liberdade é que a plataforma deixa de saber, de antemão, que dados
coleta — e responde como controladora pelo que for coletado. Daí três travas: o
texto de apoio é onde o organizador declara a finalidade e o participante a lê;
a tela de configuração adverte sobre dado sensível do art. 11 e sobre o princípio
da necessidade do art. 6º, III; e a responsabilidade pelo que se pergunta fica
registrada como do organizador.

Campo não se apaga: arquiva-se. A resposta já dada integra o registro daquela
inscrição, e sumir com a pergunta deixaria a resposta órfã no relatório, sem
cabeçalho que a explique. As respostas saem do banco por cascata junto com a
inscrição — e, portanto, junto com a conta, quando o titular a exclui.

## Relatórios em planilha

Dois, com propósitos distintos. O **por evento** (`/painel/eventos/[id]/relatorio`)
é a lista nominal de inscritos com presença, certificado e respostas aos campos
personalizados: é o documento que a organização entrega à instituição para
comprovar quem esteve. O **consolidado** (`/painel/relatorios`) é o panorama de
vários eventos, filtrável por período, organizador, modalidade e seleção manual,
com abas de eventos, resumo e — para o master — consolidado por organizador.

O alcance é decidido no servidor, em `escopoDeEventos`. Nenhum parâmetro da query
amplia alcance: um organizador que forje `?organizador=` na URL continua
recebendo apenas os próprios eventos.

Só o relatório por evento carrega dado pessoal, porque é operacional e nominal
por natureza. O consolidado trabalha com totais: não há razão para uma visão
gerencial de doze meses carregar nome e e-mail de cada participante.

Coberto por `npm run testar:organizadores`, que roda contra Postgres real.

## Endereço público e links impressos

`PUBLIC_ORIGIN` é o endereço pelo qual as pessoas acessam a plataforma, e é o
que entra nos QR Codes, nos links curtos e na miniatura de compartilhamento. Em
produção tem de ser o domínio público, com `https` e sem porta.

Endereço de escuta não serve como endereço de destino. `0.0.0.0`, `localhost`,
`127.0.0.1`, faixas privadas e nomes de serviço do Compose produzem QR que não
abre em celular nenhum — e QR já impresso não se conserta com deploy. Por isso
`src/lib/origem.ts` descarta esses hosts e cai no `X-Forwarded-Host` repassado
pelo Caddy, e o painel do evento mostra aviso vermelho antes de o organizador
baixar o PNG.

### Busca de endereço no mapa

A regra do pino manual continua de pé, e o motivo dela também: o ponto que valida
a presença é o que o organizador marca, não o que um serviço devolve. O centroide
de uma rua pode cair a trezentos metros da porta do auditório, e a tolerância do
check-in é de setenta.

O que faltava era outra coisa: chegar perto sem arrastar o mapa do Acre até
Manaus. `/api/locais` faz isso, consultando o Nominatim do OpenStreetMap. Ela
move a câmera; quem marca o ponto continua sendo o organizador. Quando a busca
acerta um prédio nomeado, o pino é posto ali como sugestão a conferir, com aviso
para arrastá-lo até a entrada.

A consulta passa pelo servidor, e não pelo navegador, por três razões: a política
de uso do Nominatim exige User-Agent identificável e no máximo uma requisição por
segundo, o que não se garante em código de cliente; o navegador do organizador
não precisa expor o próprio IP a um terceiro; e o cache atende a todos os
organizadores, não a um só. A rota exige sessão de organizador — aberta, viraria
proxy de geocodificação de graça para qualquer um, em nome da PlanA.

A miniatura de compartilhamento fica em `public/og/plana.png`, gerada por
`npm run icones` a partir da mesma especificação do símbolo. Sem `og:image`
declarada, o raspador do WhatsApp escolhe a primeira imagem grande da página —
na vitrine, o banner de um evento qualquer —, e a plataforma passa a se anunciar
com arte de terceiros. O endereço da plataforma exibe a marca; a página de cada
evento exibe o próprio banner, que ali é o conteúdo certo. Ambos dependem de
`PUBLIC_ORIGIN` correta, porque `og:image` não aceita caminho relativo.

## Arquivos enviados pelo gestor

Imagem-base de certificado, logotipos, banners e material de apoio ficam no
volume `arquivos`, fora da imagem da aplicação — junto com o banco, é o único
conteúdo que não se reconstrói, e o único que precisa de backup.

O tipo de cada arquivo é apurado pelos bytes iniciais, não pela extensão nem
pelo `Content-Type` do navegador: os dois são escolhidos por quem envia. O nome
em disco é gerado pela plataforma, então o nome original nunca vira caminho.
Limites e formatos aceitos por categoria estão em `src/lib/armazenamento.ts`.

### Modelo padrão de certificado

A plataforma mantém um modelo-base próprio de certificado, enviado uma única vez
em **Painel → Configurações** e guardado na tabela `Configuracao`, de linha
única. Todo evento criado depois já nasce apontando para esse arquivo, sem novo
envio. Dentro de um evento, o organizador pode substituí-lo por arte própria: a
troca vale só para aquele evento, e o botão de remoção devolve o evento ao
padrão.

Como o arquivo do modelo é um só, compartilhado por vários eventos, três regras
o protegem: substituir ou remover a arte de um evento nunca apaga o modelo
padrão; trocar o modelo padrão migra antes os eventos que ainda estavam nele e
só então descarta o arquivo antigo; e a rota de emissão recorre ao padrão quando
o evento estiver sem imagem-base, para que nenhum certificado saia sobre fundo
branco por esquecimento.

O banner pode ser enviado ou substituído diretamente na página de gestão do
evento e aparece no topo da página pública. A mesma página permite editar os
dados principais e controlar publicação, cancelamento e exclusão lógica.

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

---

## Histórico de atualizações

### 29/08/2026 — Implantação do pacote de instituições e controles administrativos

Implantação manual da versão que introduziu as instituições organizadoras e os
controles de master sobre contas.

**Arquivos removidos do servidor antes do build** — a estratégia de envio por
FileZilla (copiar novos sobre os antigos) deixou arquivos órfãos da versão
anterior que bloqueavam o build porque referenciavam modelos e exports
eliminados:

- `src/app/painel/organizadores/` — página de lista de organizadores que
  importava `listarOrganizadores` de `src/lib/organizadores.ts`, função que não
  existe mais nessa versão.
- `src/app/acoes-organizadores.ts` — server action que referenciava o modelo
  `perfilOrganizador` do Prisma, removido do schema nesta versão.
- `src/app/painel/perfil/` — página de perfil do organizador que dependia do
  mesmo server action acima.

**Comandos executados no servidor** (VPS Hostinger, `/opt/plana`):

```bash
# Remoção dos órfãos
rm -rf /opt/plana/src/app/painel/organizadores
rm -f /opt/plana/src/app/acoes-organizadores.ts
rm -rf /opt/plana/src/app/painel/perfil

# Build e subida
docker compose up -d --build

# Migração confirmada nos logs do serviço `migracoes`
# 20260901000000_instituicao_organizadora_e_controles — Applied
```

**Promoção do master** — o script `npm run organizador` exige entrada interativa
de senha, que não é compatível com automação por terminal remoto. A promoção foi
feita diretamente por SQL:

```sql
UPDATE "Usuario"
SET papel = 'MASTER'
WHERE email = 'leonardovasconcelosprof@gmail.com'
RETURNING email, papel;
-- Resultado: MASTER, UPDATE 1
```

---

### 29/08/2026 — Incremento de segurança (LGPD, art. 46)

Implementação de duas melhorias de segurança identificadas em análise
independente, com foco na proteção de dados pessoais dos titulares.

#### 1. Limite de tentativas no login (`/entrar`)

**Problema:** a rota de login não tinha nenhum controle de tentativas, o que
permitia ataques de força-bruta por varredura de senhas sem custo extra para o
atacante.

**Solução** (`src/app/acoes-conta.ts`):

- Adicionados dois contadores de tentativas usando a biblioteca já existente em
  `src/lib/limite-tentativas.ts` (em memória, no processo, adequada para VPS de
  instância única).
- **Por IP:** máximo de 10 tentativas em 10 minutos. Bloqueia varredura a partir
  de um mesmo ponto de origem.
- **Por e-mail:** máximo de 10 tentativas em 10 minutos. Protege contas
  específicas contra ataques distribuídos, em que múltiplos IPs miram o mesmo
  alvo.
- Ambos os contadores são zerados em caso de login bem-sucedido, para não punir
  o titular legítimo se o limite ainda não tiver expirado.
- A mensagem de erro é genérica (não distingue "IP bloqueado" de "e-mail
  bloqueado"), por paridade com a proteção existente nas demais partes da
  plataforma.

#### 2. Revogação de sessões JWT ao trocar a senha

**Problema:** ao alterar a senha, o token JWT em circulação (por exemplo, em
outro dispositivo) permanecia válido pelo prazo original de 30 dias — o titular
não tinha como encerrar sessões abertas em outros lugares.

**Solução — três mudanças coordenadas:**

**a) Schema e migração** (`prisma/schema.prisma` +
`prisma/migrations/20260902000000_revogacao_sessao_e_limite_login/`):

Adicionado o campo `senhaAlteradaEm DateTime?` ao modelo `Usuario`. Contas
existentes ficam com `NULL`, o que significa "senha nunca trocada neste sistema"
e mantém todos os tokens anteriores válidos enquanto não houver alteração.

```sql
ALTER TABLE "Usuario" ADD COLUMN "senhaAlteradaEm" TIMESTAMP(3);
```

**b) Validação de sessão** (`src/lib/sessao.ts`):

`sessaoAtual()` passou a fazer uma consulta ao banco após verificar a assinatura
JWT. Se `senhaAlteradaEm` estiver preenchida e o campo `iat` (issued at) do
token for anterior a essa data, a sessão é rejeitada — o usuário cai para o
estado não autenticado e precisa entrar de novo.

```typescript
if (payload.iat && usuario?.senhaAlteradaEm) {
  const emitidoEm = payload.iat * 1000; // segundos → ms
  if (emitidoEm < usuario.senhaAlteradaEm.getTime()) {
    return null; // Sessão anterior à última troca de senha
  }
}
```

**c) Gravação da data de troca** (`src/app/acoes-conta-privacidade.ts`):

`alterarSenha()` agora inclui `senhaAlteradaEm: new Date()` no `UPDATE`, junto
com o novo `senhaHash`. As duas colunas são escritas na mesma operação atômica.

**Escopo da proteção:** tokens emitidos ANTES da troca de senha passam a ser
rejeitados imediatamente, em qualquer dispositivo, sem necessidade de rotacionar
o segredo JWT nem de manter lista negra. Tokens emitidos APÓS a troca (inclusive
o da sessão do próprio titular, que permanece ativa) continuam aceitos
normalmente.

#### O que ficou de fora desta iteração (documentado para referência)

- **Gestão de segredos em produção** — `AUTH_SECRET`, `DATABASE_URL` e demais
  variáveis sensíveis vivem no `.env` da VPS. Migrá-las para um cofre (ex.:
  Vault, Infisical ou AWS Secrets Manager) exige mudança na infraestrutura, não
  no código da aplicação.
- **Plano de resposta a incidentes e notificação à ANPD** — item de processo,
  não de código. A notificação ao titular de incidente significativo já existe
  via `SEGURANCA_CONTA`; o procedimento interno e o prazo de 72 h para a ANPD
  (art. 48 da LGPD) dependem de documento operacional.
- **Hardening de VPS** — SSH por chave, desativação de autenticação por senha,
  backups em três camadas (Hostinger semanal + backup próprio diário +
  cópia criptografada fora da Hostinger) e atualizações automáticas do SO via
  `unattended-upgrades` são medidas de infraestrutura, não alterações no
  repositório da aplicação.
