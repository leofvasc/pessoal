"use client";

/**
 * Registro de presença.
 * Planejamento, seção 7 e 8.1: a leitura do QR Code é cruzada com o login do
 * participante e com a geolocalização do dispositivo, exigindo permissão de
 * localização ativa no celular.
 *
 * Manual, seção 11: o loop de check-in é o indicador de progresso desta tela —
 * no lugar de qualquer spinner genérico. Ao validar, a base pulsa em verde.
 */
import { useState } from "react";
import Link from "next/link";
import { registrarPresenca } from "@/app/acoes-presenca";
import { LoopCheckin } from "@/components/marca/LoopCheckin";
import { Aviso, Botao, BotaoLink, Titulo } from "@/components/ui";
import { TOLERANCIA_METROS } from "@/lib/geo";

type Fase = "pronto" | "localizando" | "registrando" | "confirmado" | "falhou";

type Props = {
  token: string;
  nomeEvento: string;
  exigeGeolocalizacao: boolean;
  autorizouGeolocalizacao: boolean;
  inscrito: boolean;
  jaPresente: boolean;
};

function lerLocalizacao(): Promise<GeolocationPosition> {
  return new Promise((resolver, rejeitar) => {
    if (!("geolocation" in navigator)) {
      rejeitar(new Error("Este aparelho não informa localização."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolver, rejeitar, {
      enableHighAccuracy: true,
      timeout: 20_000,
      // Uma leitura em cache poderia ser de outro lugar, de horas atrás.
      maximumAge: 0,
    });
  });
}

export function TelaCheckin({
  token,
  nomeEvento,
  exigeGeolocalizacao,
  autorizouGeolocalizacao,
  inscrito,
  jaPresente,
}: Props) {
  const [fase, setFase] = useState<Fase>(jaPresente ? "confirmado" : "pronto");
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function registrar() {
    setMensagem(null);
    try {
      let latitude = 0;
      let longitude = 0;
      let precisao: number | undefined;

      if (exigeGeolocalizacao) {
        setFase("localizando");
        const posicao = await lerLocalizacao();
        latitude = posicao.coords.latitude;
        longitude = posicao.coords.longitude;
        precisao = posicao.coords.accuracy;
      }

      setFase("registrando");
      const resultado = await registrarPresenca({ tokenQr: token, latitude, longitude, precisao });

      if (resultado.ok) {
        setFase("confirmado");
      } else {
        setFase("falhou");
        setMensagem(resultado.mensagem);
      }
    } catch (erro) {
      setFase("falhou");
      const negada =
        typeof erro === "object" &&
        erro !== null &&
        "code" in erro &&
        (erro as GeolocationPositionError).code === 1;
      setMensagem(
        negada
          ? "Você negou o acesso à localização. Autorize nas configurações do navegador e tente de novo, ou peça o lançamento manual à organização."
          : "Não foi possível ler sua localização. Tente perto de uma janela ou peça o lançamento manual à organização.",
      );
    }
  }

  if (!inscrito) {
    return (
      <div className="w-full max-w-sm text-center">
        <Titulo nivel={2}>Você não está inscrito</Titulo>
        <p className="mt-3 text-sm text-texto-2">
          A presença só pode ser registrada para quem está inscrito em {nomeEvento}.
        </p>
        <BotaoLink href="/conta" className="mt-6">
          Ir para minha conta
        </BotaoLink>
      </div>
    );
  }

  if (exigeGeolocalizacao && !autorizouGeolocalizacao) {
    return (
      <div className="w-full max-w-sm text-center">
        <Titulo nivel={2}>Falta uma autorização</Titulo>
        <p className="mt-3 text-sm text-texto-2">
          Para registrar presença pelo QR Code é preciso autorizar a leitura da localização — é ela
          que confirma que você está a até {TOLERANCIA_METROS} metros do local.
        </p>
        <BotaoLink href="/conta/privacidade" className="mt-6">
          Autorizar na minha conta
        </BotaoLink>
        <p className="mt-4 text-xs text-texto-2">
          Prefere não autorizar? Peça o lançamento manual à organização do evento.
        </p>
      </div>
    );
  }

  const emCurso = fase === "localizando" || fase === "registrando";

  return (
    <div className="flex w-full max-w-sm flex-col items-center text-center">
      <LoopCheckin
        tamanho={132}
        modo={emCurso ? "continuo" : "umCiclo"}
        confirmado={fase === "confirmado"}
        rotulo={
          fase === "confirmado" ? "Presença confirmada" : "Registrando presença"
        }
      />

      <Titulo nivel={2} className="mt-8">
        {fase === "confirmado" ? "Presença confirmada" : nomeEvento}
      </Titulo>

      {fase === "confirmado" ? (
        <>
          <p className="mt-3 text-sm text-texto-2">
            Seu certificado de {nomeEvento} fica disponível ao fim do evento, na sua conta.
          </p>
          <BotaoLink href="/conta/certificados" className="mt-6">
            Meus certificados
          </BotaoLink>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm text-texto-2">
            {fase === "localizando"
              ? "Lendo a localização do aparelho…"
              : fase === "registrando"
                ? "Confirmando sua presença…"
                : "Confirme para registrar sua presença neste evento."}
          </p>

          {mensagem ? (
            <div className="mt-6 w-full text-left">
              <Aviso tom="erro">{mensagem}</Aviso>
            </div>
          ) : null}

          <Botao className="mt-6 w-full" onClick={registrar} disabled={emCurso}>
            {emCurso ? "Aguarde…" : fase === "falhou" ? "Tentar de novo" : "Registrar presença"}
          </Botao>

          <Link href="/conta" className="mt-4 text-xs text-texto-2 hover:text-violeta">
            Voltar para minha conta
          </Link>
        </>
      )}
    </div>
  );
}
