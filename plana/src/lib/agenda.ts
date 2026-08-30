/**
 * Salvar o evento na agenda pessoal do participante.
 *
 * Duas saídas, porque são dois mundos diferentes:
 *
 *  - **Google Agenda**: um endereço de "novo evento já preenchido". O
 *    navegador abre o Google com os campos prontos e a pessoa confirma. Nada
 *    é enviado por nós: o dado viaja na própria URL que ela clicou.
 *
 *  - **Apple, Outlook e o resto**: um arquivo .ics, que é o formato padrão de
 *    calendário (RFC 5545). No iPhone e no Mac, abrir o arquivo já propõe
 *    adicionar ao Calendário; no Outlook e no Thunderbird, o mesmo.
 *
 * O que este módulo deliberadamente **não** faz: pedir acesso à agenda da
 * pessoa, guardar token de calendário, registrar que ela salvou o evento ou
 * saber qual agenda ela usa. Integração por API exigiria autorização OAuth e
 * um token guardado no nosso banco — dado novo, de finalidade nova, para uma
 * comodidade que o link resolve. Coleta mínima é escolher o caminho que não
 * cria o dado.
 *
 * Só entra aqui informação que já é pública na página do evento. Nome do
 * participante, e-mail e inscrição não aparecem no arquivo nem na URL.
 */

export type EventoParaAgenda = {
  nome: string;
  descricao: string;
  inicioEm: Date;
  fimEm: Date;
  /** Local físico, meio de transmissão ou os dois, conforme a modalidade. */
  local: string | null;
  /** Endereço público do evento, para quem abrir o compromisso depois. */
  url: string;
  /** Código do evento — vira a identidade do compromisso no calendário. */
  codigoEvento: string;
};

/** Instante em UTC no formato do iCalendar: 20260914T170000Z. */
function carimbo(instante: Date): string {
  return instante.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Endereço do formulário de novo evento do Google, já preenchido.
 *
 * `dates` vai em UTC porque o Google interpreta o sufixo Z; mandar horário
 * local exigiria declarar o fuso à parte e erraria para quem estivesse em
 * outro — e a plataforma atende Acre e Brasília ao mesmo tempo.
 */
export function urlGoogleAgenda(evento: EventoParaAgenda): string {
  const parametros = new URLSearchParams({
    action: "TEMPLATE",
    text: evento.nome,
    dates: `${carimbo(evento.inicioEm)}/${carimbo(evento.fimEm)}`,
    details: `${evento.descricao}\n\n${evento.url}`,
    location: evento.local ?? "",
  });
  return `https://calendar.google.com/calendar/render?${parametros.toString()}`;
}

/**
 * Escapa o texto conforme a RFC 5545: barra invertida, ponto e vírgula,
 * vírgula e quebra de linha têm significado próprio no formato.
 */
function escapar(texto: string): string {
  return texto
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Dobra a linha em 75 octetos, como manda a RFC 5545.
 *
 * A conta é em bytes, não em caracteres: acento em UTF-8 ocupa dois, e cortar
 * no meio de um deles produziria arquivo inválido — que alguns calendários
 * simplesmente recusam a abrir, sem dizer por quê.
 */
function dobrar(linha: string): string {
  const codificador = new TextEncoder();
  const decodificador = new TextDecoder();
  const bytes = codificador.encode(linha);
  if (bytes.length <= 75) return linha;

  const partes: string[] = [];
  let inicio = 0;
  let limite = 75;

  while (inicio < bytes.length) {
    let fim = Math.min(inicio + limite, bytes.length);
    // Recua até o começo de um caractere completo: 10xxxxxx é continuação.
    while (fim < bytes.length && (bytes[fim] & 0b1100_0000) === 0b1000_0000) fim--;
    partes.push(decodificador.decode(bytes.subarray(inicio, fim)));
    inicio = fim;
    // As linhas seguintes começam por espaço, que também conta no limite.
    limite = 74;
  }

  return partes.join("\r\n ");
}

/**
 * Arquivo .ics de um evento, com um único compromisso.
 *
 * O UID é derivado do código do evento: se a pessoa salvar duas vezes, o
 * calendário reconhece o mesmo compromisso e atualiza em vez de duplicar.
 */
export function icsDoEvento(evento: EventoParaAgenda, origem: string): string {
  const dominio = origem.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || "eventosplana.app";

  const linhas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PlanA//Gestao de eventos//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${evento.codigoEvento}@${dominio}`,
    // DTSTAMP é a hora de geração do arquivo, exigida pela norma.
    `DTSTAMP:${carimbo(new Date())}`,
    `DTSTART:${carimbo(evento.inicioEm)}`,
    `DTEND:${carimbo(evento.fimEm)}`,
    `SUMMARY:${escapar(evento.nome)}`,
    `DESCRIPTION:${escapar(`${evento.descricao}\n\n${evento.url}`)}`,
    `URL:${escapar(evento.url)}`,
    ...(evento.local ? [`LOCATION:${escapar(evento.local)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // Terminador CRLF, inclusive no fim do arquivo: a norma é literal quanto a
  // isso, e o Outlook é o que menos perdoa.
  return linhas.map(dobrar).join("\r\n") + "\r\n";
}

/** Nome do arquivo oferecido ao participante. */
export function nomeDoArquivoIcs(codigoEvento: string): string {
  return `plana-${codigoEvento.toLowerCase()}.ics`;
}
