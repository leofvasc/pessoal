#!/usr/bin/env bash
#
# Cria o arquivo .env da VPS com as senhas já geradas.
#
# Rodar uma vez, dentro da pasta do projeto no servidor:
#     bash scripts/preparar-env.sh
#
# Ele pergunta só o domínio; o resto é sorteado com o gerador criptográfico do
# sistema. Não sobrescreve um .env existente — se você já tem um, ele avisa e
# para, para não apagar as senhas de um servidor que já está no ar.

set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo "Já existe um arquivo .env aqui."
  echo "Se quiser começar de novo, renomeie o atual antes:  mv .env .env-antigo"
  exit 1
fi

if ! command -v openssl > /dev/null; then
  echo "Preciso do openssl para gerar as senhas. Instale com:  apt install -y openssl"
  exit 1
fi

read -r -p "Qual o seu domínio? (exemplo: eventosplana.app) " DOMINIO
DOMINIO="${DOMINIO#http://}"
DOMINIO="${DOMINIO#https://}"
DOMINIO="${DOMINIO%%/*}"

if [ -z "$DOMINIO" ]; then
  echo "Sem domínio não dá para emitir o certificado de segurança. Rode de novo."
  exit 1
fi

read -r -p "Qual e-mail usar nas notificações push? (pode deixar vazio) " EMAIL
EMAIL="${EMAIL:-contato@$DOMINIO}"

cat > .env <<ARQUIVO
DOMINIO="$DOMINIO"
PUBLIC_ORIGIN="https://$DOMINIO"
POSTGRES_PASSWORD="$(openssl rand -hex 24)"
AUTH_SECRET="$(openssl rand -base64 48)"

# Necessário para o fluxo "Esqueci a senha". Crie a chave no Resend,
# valide o domínio e preencha as duas linhas antes de publicar o recurso.
RESEND_API_KEY=""
EMAIL_REMETENTE="PlanA <nao-responda@$DOMINIO>"

# Preencha depois de subir a aplicação, com:
#     docker compose run --rm migracoes npm run chaves:vapid
VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_SUBJECT="mailto:$EMAIL"
ARQUIVO

chmod 600 .env

echo
echo "Pronto. Arquivo .env criado para o domínio $DOMINIO."
echo "As senhas foram geradas e ficam só neste arquivo — não precisa decorá-las."
echo
echo "Próximo passo:  docker compose up -d --build"
