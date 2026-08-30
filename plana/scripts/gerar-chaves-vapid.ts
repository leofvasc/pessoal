/**
 * Gera o par de chaves VAPID das notificações push.
 * Rodar uma vez e guardar o resultado no .env:
 *
 *     npm run chaves:vapid
 *
 * Trocar as chaves depois invalida todas as inscrições de push já gravadas —
 * cada navegador terá de assinar de novo.
 */
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log(`VAPID_PUBLIC_KEY="${publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${privateKey}"`);
console.log('VAPID_SUBJECT="mailto:seu-email@dominio"');
