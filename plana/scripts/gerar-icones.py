#!/usr/bin/env python3
"""
Gera os ícones do PWA e a imagem de compartilhamento a partir da especificação
do símbolo PlanA.

Manual de identidade visual:
  seção 03 — malha 11u, módulo 3u, calha 1u, raio 1u;
  seção 06 — ficha violeta com gradiente 150°, de #7E5CFF a #5B36E8;
  seção 17 — símbolo branco na ficha, 76% de ocupação da área segura;
             ícone maskable com 20% de margem extra;
             favicon de 16 px apenas com a base e as duas diagonais.

Rodar depois de qualquer alteração na especificação:
    python3 scripts/gerar-icones.py
"""
import math
from PIL import Image, ImageDraw, ImageFont

MALHA, MODULO, CALHA, RAIO = 11, 3, 1, 1

# Papel de cada módulo, em ordem row-major. Índices 6,7,8 são a base sólida;
# 1,3,5 as diagonais que formam o "A"; 0,2,4 os vazios.
PAPEIS = ["vazio", "diagonal", "vazio",
          "diagonal", "vazio", "diagonal",
          "base", "base", "base"]

# Versão em negativo como na miniatura oficial: base e diagonais em branco
# cheio, vazios a 40% de alfa.
CORES = {
    "base": (255, 255, 255, 255),
    "diagonal": (255, 255, 255, 255),
    "vazio": (255, 255, 255, 102),
}

FICHA_DE = (0x7E, 0x5C, 0xFF)
FICHA_ATE = (0x5B, 0x36, 0xE8)

SUPERAMOSTRAGEM = 8


def gradiente(lado, angulo_graus=150):
    """Gradiente linear no ângulo do manual, medido como em CSS."""
    img = Image.new("RGB", (lado, lado))
    px = img.load()
    # Em CSS, 0° aponta para cima e o ângulo cresce no sentido horário.
    rad = math.radians(angulo_graus)
    dx, dy = math.sin(rad), -math.cos(rad)
    # Projeção normalizada de cada pixel sobre o eixo do gradiente.
    extensao = abs(dx) + abs(dy)
    for y in range(lado):
        for x in range(lado):
            u = ((x / (lado - 1) - 0.5) * dx + (y / (lado - 1) - 0.5) * dy)
            t = min(1.0, max(0.0, u / extensao + 0.5))
            px[x, y] = tuple(
                round(FICHA_DE[c] + (FICHA_ATE[c] - FICHA_DE[c]) * t) for c in range(3)
            )
    return img


def desenhar_simbolo(lado, sem_vazios=False):
    """Símbolo em negativo, com canal alfa, num quadrado de `lado` px."""
    s = lado * SUPERAMOSTRAGEM
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = s / MALHA
    for i, papel in enumerate(PAPEIS):
        if sem_vazios and papel == "vazio":
            continue
        col, lin = i % 3, i // 3
        x0 = col * (MODULO + CALHA) * u
        y0 = lin * (MODULO + CALHA) * u
        d.rounded_rectangle(
            [x0, y0, x0 + MODULO * u, y0 + MODULO * u],
            radius=RAIO * u,
            fill=CORES[papel],
        )
    return img.resize((lado, lado), Image.LANCZOS)


def icone(lado, maskable=False, sem_vazios=False):
    fundo = gradiente(lado).convert("RGBA")
    if not maskable:
        # Canto arredondado do próprio ícone, para uso fora de máscara.
        mascara = Image.new("L", (lado * 4, lado * 4), 0)
        ImageDraw.Draw(mascara).rounded_rectangle(
            [0, 0, lado * 4 - 1, lado * 4 - 1], radius=lado * 4 * 0.22, fill=255
        )
        fundo.putalpha(mascara.resize((lado, lado), Image.LANCZOS))

    # 76% da área segura; o maskable reserva 20% de margem extra.
    ocupacao = 0.76 * (0.8 if maskable else 1.0)
    interno = round(lado * ocupacao)
    simbolo = desenhar_simbolo(interno, sem_vazios=sem_vazios)
    deslocamento = (lado - interno) // 2
    fundo.alpha_composite(simbolo, (deslocamento, deslocamento))
    return fundo


# --------------------------------------------------------------------------
# Imagem de compartilhamento (Open Graph)
# --------------------------------------------------------------------------
#
# É a miniatura que aparece quando o endereço da PlanA é colado no WhatsApp,
# no Telegram ou num cliente de e-mail. Sem ela declarada, o raspador escolhe
# sozinho a primeira imagem grande da página — que na vitrine é o banner de um
# evento qualquer. A plataforma passaria a se anunciar com a arte de terceiros.
#
# 1200 x 630 é a proporção que WhatsApp e Open Graph recortam sem cortar nada.

FONTE_LOGOTIPO = "src/assets/fontes/PlusJakartaSans-ExtraBold.ttf"
FONTE_DESCRITOR = "src/assets/fontes/PlusJakartaSans-Regular.ttf"

# Manual, seção 04: altura de maiúscula da Plus Jakarta Sans.
ALTURA_MAIUSCULA = 0.73
# Seção 09: a distância entre símbolo e logotipo é um módulo (3u) da malha 11u.
PROPORCAO_INTERVALO = 3 / 11


def imagem_de_compartilhamento(largura=1200, altura=630):
    fundo = gradiente(max(largura, altura)).crop((0, 0, largura, altura)).convert("RGBA")

    # Lockup horizontal centrado, reproduzindo as proporções do componente.
    altura_simbolo = 132
    intervalo = round(altura_simbolo * PROPORCAO_INTERVALO)
    corpo_logotipo = round(altura_simbolo / ALTURA_MAIUSCULA)

    fonte_palavra = ImageFont.truetype(FONTE_LOGOTIPO, corpo_logotipo)
    fonte_descritor = ImageFont.truetype(FONTE_DESCRITOR, 30)

    palavra = "PlanA"
    # Tracking de -3,8% do manual, aplicado letra a letra.
    tracking = round(corpo_logotipo * -0.038)
    larguras = [fonte_palavra.getlength(letra) for letra in palavra]
    largura_palavra = sum(larguras) + tracking * (len(palavra) - 1)

    descritor = "gestão de eventos"
    espacamento_descritor = 8
    larguras_descritor = [fonte_descritor.getlength(c) for c in descritor]
    largura_descritor = sum(larguras_descritor) + espacamento_descritor * (len(descritor) - 1)

    bloco_texto = max(largura_palavra, largura_descritor)
    largura_total = altura_simbolo + intervalo + bloco_texto
    x = round((largura - largura_total) / 2)
    centro_y = round(altura / 2) - 18

    simbolo = desenhar_simbolo(altura_simbolo)
    fundo.alpha_composite(simbolo, (x, centro_y - altura_simbolo // 2))

    d = ImageDraw.Draw(fundo)
    caixa = fonte_palavra.getbbox(palavra)
    cursor = x + altura_simbolo + intervalo
    linha_base = centro_y + altura_simbolo // 2
    for letra, avanco in zip(palavra, larguras):
        d.text((cursor, linha_base - caixa[3]), letra, font=fonte_palavra, fill=(255, 255, 255, 255))
        cursor += avanco + tracking

    cursor = x + altura_simbolo + intervalo
    topo_descritor = linha_base + 34
    for caractere, avanco in zip(descritor, larguras_descritor):
        d.text(
            (cursor, topo_descritor),
            caractere,
            font=fonte_descritor,
            fill=(255, 255, 255, 190),
        )
        cursor += avanco + espacamento_descritor

    return fundo.convert("RGB")


if __name__ == "__main__":
    icone(192).save("public/icones/icone-192.png")
    icone(512).save("public/icones/icone-512.png")
    icone(512, maskable=True).save("public/icones/icone-512-maskable.png")
    icone(180).save("public/icones/apple-touch-icon.png")
    icone(32).save("public/icones/favicon-32.png")
    # Seção 17: em 16 px, apenas a base sólida e as duas diagonais.
    icone(16, sem_vazios=True).save("public/icones/favicon-16.png")
    # O App Router também serve /favicon.ico por convenção. A ficha e o símbolo
    # da marca substituem o ícone abstrato que vinha no arquivo inicial.
    icone(256).save(
        "src/app/favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (256, 256)],
    )
    imagem_de_compartilhamento().save("public/og/plana.png", quality=92)
    print("ícones gerados em public/icones/ e imagem de compartilhamento em public/og/")
