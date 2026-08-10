# Avaliação técnica — sistema privado de extração de dados de documentos jurídicos

Data: 10/08/2026
Objeto: avaliação da proposta apresentada (via GPT) para construir um extrator de dados
documentais com modelos de peso aberto hospedados em nuvem, como alternativa a um
sistema de anonimização.

---

## 1. Veredito

A arquitetura proposta está **fundamentalmente correta** e vale prosseguir. A separação
entre leitura do documento (OCR/layout) e compreensão do conteúdo (extração de campos)
é a decisão certa, e a exigência de evidência e página para cada campo é o que separa
um extrator utilizável de um gerador de texto plausível.

Há, porém, **quatro correções materiais** antes de gastar dinheiro com infraestrutura:

| # | Ponto | Situação |
|---|---|---|
| 1 | Premissa "modelo chinês = proteção contratual" | Incorreta — a proteção vem de outro lugar |
| 2 | Qwen3-VL-8B-Instruct | Desatualizado em ~5 meses |
| 3 | "Nuvem privada" via RunPod Secure Cloud | RunPod é multi-tenant; não é nuvem privada |
| 4 | Campo `confianca: 0.98` gerado pelo modelo | Número sem valor; precisa de verificação determinística |

E há **uma omissão grave**: o plano não prevê conjunto de avaliação com gabarito. Sem
isso não há como saber se qualquer alteração melhorou ou piorou o sistema.

---

## 2. Correção da premissa central

O objetivo declarado foi "usar modelo de código aberto chinês e hospedar em nuvem privada
para ter uma camada a mais de proteção de dados contratualmente".

A proteção **não decorre da nacionalidade do modelo**. Pesos de modelo são arquivos
inertes: não abrem conexão de rede, não telemetram, não comunicam nada ao autor. A Alibaba
não vê o que passa pelo Qwen rodando na sua máquina — mas a Meta também não veria com o
Llama, nem a Mistral com os modelos franceses, nem o Google com o Gemma.

O que efetivamente produz a proteção são três coisas, nesta ordem:

1. **Peso aberto** — nenhum dado sai para o provedor do modelo, porque não há provedor.
2. **Licença permissiva** — Apache 2.0 permite uso comercial sem obrigação de abertura.
3. **Onde a inferência roda** — este é o único ponto que gera obrigação contratual real,
   e é justamente onde a proposta está mais frágil (item 5).

Consequência prática: a origem chinesa não adiciona nada e pode **subtrair**. Políticas de
compras e de segurança de vários órgãos públicos e de clientes corporativos restringem
componentes de origem chinesa. Se parte do material vier de atuação junto a órgão público,
isso é uma objeção previsível — e evitável, já que existem alternativas ocidentais de peso
aberto equivalentes.

Ainda assim **a conclusão prática se mantém**: a família Qwen é hoje a melhor opção aberta
para compreensão documental e é Apache 2.0. Adote-a pelo mérito técnico e pela licença,
não pela nacionalidade — e esteja preparado para justificar isso a um cliente que pergunte.

### 2.1. Extração *versus* anonimização: não é escolha excludente

A proposta foi apresentada como substituta de um sistema de anonimização. São coisas
diferentes e complementares:

- **Anonimização** protege permitindo que o dado descaracterizado saia.
- **Auto-hospedagem** protege fazendo com que o dado não saia.

A segunda é mais forte e não perde informação. Mas haverá momentos em que se quer usar um
modelo de fronteira (Claude, GPT) para raciocínio jurídico sobre o material — e aí a
anonimização volta a ser necessária.

E aqui está o ponto mais útil desta avaliação: **o extrator é exatamente o que viabiliza a
anonimização de qualidade.** Um sistema que já localizou nome das partes, CPF, número do
processo, endereços e valores sabe precisamente o que mascarar e onde. Construir o extrator
não abandona a anonimização — constrói o seu melhor insumo. Vale planejar desde já um perfil
de saída "mascarado" ao lado do JSON e do Excel.

---

## 3. Modelos: uma escolha confirmada, uma desatualizada

### 3.1. PaddleOCR-VL-1.6 — confirmado, mantenha

A recomendação está correta e atual. Versão 1.6 liberada em 28/05/2026, com relatório
técnico em 03/06/2026; 0,9B de parâmetros, estado da arte em OmniDocBench v1.6 (96,33%),
compatível com a 1.5 sem custo de adaptação. Saída em Markdown e JSON, coordenadas via
PP-StructureV3. Para o papel de "o que está escrito e onde está escrito", é a escolha certa
e absurdamente barata de rodar.

### 3.2. Qwen3-VL-8B-Instruct — desatualizado, substitua

O Qwen3-VL é de outubro de 2025. Em fevereiro/março de 2026 saiu o **Qwen3.5**, e a mudança
é relevante para este projeto:

- **Toda a família Qwen3.5 é nativamente multimodal** (imagem e vídeo), não só uma linha "VL".
- Fusão precoce (*early fusion*) treinada em multimodalidade desde a base, com desempenho
  superior ao Qwen3-VL inclusive em compreensão visual.
- Apache 2.0, contexto de 262K.
- Modo *thinking*/não-*thinking* unificado no mesmo modelo.

Tamanhos disponíveis: 0,8B / 2B / 4B / 9B (série *small*), 27B denso, e os MoE 35B-A3B,
122B-A10B, 397B-A17B.

**Recomendação:** comece com **Qwen3.5-9B** para provar o pipeline e suba para
**Qwen3.5-27B** (denso, quantizado em FP8) se a medição justificar. O 35B-A3B é interessante
por ativar só 3B por token — rápido e barato por token — mas exige mais VRAM para carregar.
Evite dimensionar a GPU antes de ter a medição do item 7.

Observação sobre a orientação de "evitar a versão Thinking": o princípio está certo — para
extração se quer resposta direta e baixa variabilidade. Mas no Qwen3.5 isso deixou de ser
escolha de modelo e virou um *flag* de execução. Mantenha o modo não-*thinking* como padrão
e reserve o *thinking* para campos que exijam inferência (ex.: cálculo de período aquisitivo).

### 3.3. MinerU — a licença mudou, e para melhor; mas não use agora

O MinerU saiu da AGPL-3.0 para a "MinerU Open Source License", baseada em Apache 2.0. Uso
comercial liberado abaixo de 100 milhões de usuários mensais ou US$ 20 milhões de receita
mensal. **Ressalva relevante:** quem presta serviço on-line a terceiros com base no MinerU
precisa indicar de forma clara e visível esse uso na interface ou na documentação pública.
Se a ferramenta for oferecida a clientes, essa obrigação de atribuição incide.

Cuidado adicional: o *Flash-MinerU* é um projeto distinto e **continua sob AGPL-3.0** —
evite-o em produto oferecido a terceiros.

**Recomendação:** não incluir o MinerU na v0. É redundância com o PaddleOCR-VL e dobra a
superfície de manutenção. Adicione depois, e apenas se houver casos concretos medidos em que
o Paddle falhe.

---

## 4. O que a proposta acertou

Vale registrar, porque a base é sólida:

- Separar OCR de compreensão, cada componente na tarefa para a qual foi feito.
- Esquema rígido de campos em vez de "extraia os dados importantes".
- Exigir página e trecho de origem para cada campo.
- Testar primeiro a extração nativa do PDF e só cair para OCR quando necessário — a maioria
  dos documentos de PJe/eproc tem camada de texto, e OCR neles é desperdício e fonte de erro.
- Não treinar do zero e não fazer *fine-tuning* agora.
- Não enviar o processo inteiro numa única requisição.
- Começar por um único tipo documental.
- Docker para reprodutibilidade.
- Disco efêmero para os documentos, volume persistente separado só para pesos e código.
- Reconhecer que não substitui auditoria independente de segurança.

---

## 5. Hospedagem: o ponto mais frágil da proposta

### 5.1. RunPod Secure Cloud não é nuvem privada

A própria documentação da RunPod é explícita: Pods e *workers* rodam em **ambiente
multi-tenant com isolamento por contêiner**. Isso é nuvem pública com datacenter melhor
(T3/T4, parceiros com SOC 2) — não é nuvem privada, não há GPU fisicamente dedicada nem
isolamento em nível de hipervisor de instância única.

Para um protótipo com documentos fictícios, é perfeitamente adequado. Para o objetivo
declarado de "camada a mais de proteção contratual" sobre documento sob sigilo profissional,
é fraco — e chamar isso de "nuvem privada" numa conversa com cliente seria impreciso.

### 5.2. Transferência internacional (LGPD art. 33)

A RunPod tem DPA e conformidade com o RGPD em regiões europeias, com cláusulas-padrão para
transferência para fora da UE. **Não há região no Brasil.** Portanto:

- Todo processamento é transferência internacional de dados pessoais.
- Exige instrumento adequado nos termos do art. 33 e das cláusulas-padrão contratuais
  aprovadas pela ANPD (Resolução CD/ANPD nº 19/2024) — **não basta o SCC do RGPD**, que é
  o que a maioria dos fornecedores estrangeiros oferece de prateleira. Confirmar por escrito
  se a RunPod assina no padrão brasileiro antes de contratar.
- Petição inicial trabalhista contém rotineiramente **dado pessoal sensível** (saúde,
  filiação sindical, por vezes dado de menor). Isso agrava o regime e torna prudente o
  relatório de impacto (art. 38), além do registro de operações (art. 37).

### 5.3. Alternativas mais alinhadas ao objetivo

Em ordem crescente de proteção:

1. **RunPod Secure Cloud** — bom para a fase de documentos fictícios. Barato, rápido de subir.
2. **AWS sa-east-1 (São Paulo) com instância GPU** — mantém o dado em território nacional e
   elimina a discussão do art. 33. Mais caro por hora, mas o objetivo declarado é proteção
   contratual, não preço. H100 disponível na região; H200/B200 ainda não estão disponíveis
   em nenhum hyperscaler no Brasil — irrelevante aqui, porque um modelo 9B/27B quantizado
   não precisa de nada perto disso: uma L4, L40S ou A10G resolve.
3. **Máquina própria no escritório** (RTX 6000 Ada, 5090 ou equivalente) — é a única coisa
   que merece o nome "nuvem privada" e, para material sob sigilo profissional, é o argumento
   mais forte que existe: o documento nunca sai da sala. Custo inicial na casa de dezenas de
   milhares de reais, com retorno frente a GPU em nuvem 24/7 em prazo da ordem de 6 a 12 meses.

**Recomendação:** RunPod para as fases 0–2 (dados fictícios), decisão entre AWS sa-east-1 e
máquina local antes de qualquer documento real.

### 5.4. Custo — variável ausente do plano

Uma GPU em nuvem ligada 24/7 custa, em ordem de grandeza, de US$ 600 a US$ 1.400 por mês,
conforme a placa. O plano não menciona isso, e é o que costuma matar protótipos. Mitigações:
ligar o Pod sob demanda e desligar após o uso; ou usar execução *serverless*, ao custo de
partida a frio e de um desenho de dados diferente. Números a confirmar no momento da
contratação.

### 5.5. Sobre "você precisaria apenas criar a conta e executar a implantação"

Isso subestima materialmente o esforço de operação. Pods reiniciam, pesos precisam ser
rebaixados, versões de vLLM e CUDA conflitam, segredos precisam ser geridos, é preciso
monitoramento e cópia de segurança. Não é intransponível, mas não é "apenas". Planeje horas
recorrentes de manutenção, não só de construção.

---

## 6. Correção técnica: confiança auto-reportada não vale nada

O esquema proposto inclui `"confianca": 0.98`, gerado pelo próprio modelo. **Esse número é
inventado.** Modelos de linguagem não são calibrados ao auto-reportar confiança; produzem
valores altos com a mesma facilidade quando acertam e quando alucinam. Pior: dá falsa
segurança exatamente onde se precisa de ceticismo.

Substitua por **verificação determinística de ancoragem**, feita em código, não pelo modelo:
o trecho devolvido em `evidencia` precisa casar literalmente (correspondência exata ou
aproximada com limiar) com o texto extraído da página indicada. Se não casar, o campo é
rejeitado ou marcado para revisão obrigatória. Isso é um teste real de alucinação.

Esquema sugerido:

```json
{
  "data_admissao": {
    "valor": "2021-03-15",
    "valor_literal": "15 de março de 2021",
    "pagina": 4,
    "span": [1204, 1223],
    "evidencia": "O reclamante foi admitido em 15 de março de 2021",
    "ancoragem_verificada": true,
    "status": "extraido"
  }
}
```

Três mudanças em relação ao original:

- `ancoragem_verificada` é calculada pelo sistema, nunca pelo modelo.
- `valor` normalizado (data em ISO, dinheiro em decimal) separado de `valor_literal`.
- `status` com vocabulário fechado: `extraido`, `ausente_no_documento`, `ambiguo`,
  `rejeitado_sem_ancoragem`. Distinguir "não existe no documento" de "não encontrei" é
  essencial para medir o sistema.

Se usar vLLM, os *logprobs* dos tokens do valor são um sinal adicional que, ao contrário da
autoavaliação, tem alguma base estatística.

---

## 7. A omissão grave: não há conjunto de avaliação

Este é o item mais importante desta avaliação.

O plano descreve construir o sistema e depois coletar correções do usuário para melhorar.
Isso inverte a ordem. **Sem um conjunto de documentos com gabarito preenchido à mão, não há
como saber se uma alteração de prompt melhorou ou piorou o resultado** — e ajuste de prompt
sem medição é troca aleatória de texto.

O primeiro artefato do projeto deve ser, antes de qualquer GPU:

- **25 a 30 documentos** do tipo escolhido, fictícios ou públicos.
- **Gabarito preenchido manualmente**, campo a campo, incluindo os campos que legitimamente
  não existem em cada documento.
- **Harness de avaliação** que roda o pipeline e reporta, por campo: acerto exato, precisão,
  recall, taxa de alucinação (evidência não ancorada) e taxa de abstenção correta.

Custo: zero em infraestrutura, alguns dias de trabalho seu. Retorno: todas as decisões
seguintes deixam de ser opinião.

---

## 8. Interface: Streamlit não entrega o que foi prometido

A proposta promete "clicar num campo, abrir a página correspondente e destacar o trecho de
origem" — em Streamlit. Isso exige componente customizado com PDF.js e é desproporcionalmente
trabalhoso na plataforma.

**Recomendação:** na v0, dispense o realce visual. Exiba o número da página e o trecho citado
em texto ao lado do campo. Isso já resolve a conferência na prática e economiza semanas. Se o
realce se mostrar necessário depois, vá direto para FastAPI + PDF.js, sem passar por um
componente Streamlit customizado.

---

## 9. Discordância sobre o primeiro tipo documental

A proposta sugere começar por contratos, por serem objetivos e fáceis de validar. O critério
é bom, mas a conclusão tem um risco: se contrato não é o documento que consome o seu tempo,
o sistema será calibrado para um caso de uso que você não usa, e a migração para o documento
real pode invalidar decisões de arquitetura.

**Alternativa melhor:** escolha o documento de **maior volume real** no seu trabalho e recorte
dentro dele um subconjunto pequeno de **8 a 12 campos objetivos**. Isso preserva a facilidade
de validação e entrega utilidade desde o primeiro dia.

---

## 10. Plano ajustado

**Fase 0 — Definição e medição (sem GPU, sem nuvem, custo zero)**
Escolher o tipo documental e fechar o esquema de 8 a 12 campos. Montar 25 PDFs com gabarito
manual. Escrever o harness de avaliação. Nada mais.

**Fase 1 — Pipeline de texto nativo**
Extração da camada de texto (PyMuPDF/pdfplumber) → Qwen3.5-9B → validação de ancoragem →
JSON e Excel. Medir contra o gabarito. É só aqui que se descobre se um modelo de visão é
mesmo necessário, e para qual fração dos documentos.

**Fase 2 — Visão, apenas onde a medição mostrar necessidade**
Acrescentar PaddleOCR-VL-1.6 para os documentos digitalizados que reprovaram na fase 1.
Medir de novo, contra o mesmo gabarito.

**Fase 3 — Interface e endurecimento**
Autenticação, criptografia em repouso, expurgo automático, registro de auditoria, bloqueio de
saída de rede do contêiner, política de retenção. Só ao fim desta fase entra documento real,
e só depois de decidida a questão de hospedagem do item 5.3.

**Fase 4 — Ampliação**
Novos tipos documentais, lote, comparação entre documentos, API, perfil de saída mascarado
para uso com modelos de fronteira (item 2.1).

---

## 11. Decisões necessárias antes de prosseguir

1. **Qual tipo documental e quais campos exatos.** A proposta acertou ao identificar esta
   como a decisão primeira — ela determina o resto da arquitetura.

2. **Qual a natureza do material que o sistema tratará em produção** — documento de cliente
   sob sigilo profissional, material de órgão público, ou documento próprio. Esta decisão não
   apareceu na proposta e é a que determina se nuvem estrangeira é viável ou se será preciso
   AWS São Paulo ou máquina local. Ela precisa ser tomada **antes**, porque muda o desenho de
   armazenamento, de log e de expurgo — não é algo que se acrescenta ao final.
