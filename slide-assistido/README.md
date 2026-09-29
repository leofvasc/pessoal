# Slide Assistido

Protótipo local para importar apresentações, preparar informações de cada tela e sugerir mudanças durante a fala. A versão 12 mantém uma apresentação de demonstração, aceita arquivos próprios e pode ser instalada no Windows.

## Instalação no Windows

Execute `SlideAssistido-Instalador-v12.exe`. A instalação é feita apenas para o usuário atual, em `%LOCALAPPDATA%\Programs\SlideAssistido`, e não pede senha de administrador. O instalador já contém o Python e todas as dependências; não é preciso instalar nada antes. Como o instalador não tem assinatura digital, o Windows SmartScreen pode exibir o aviso “O Windows protegeu o computador”; nesse caso, clique em “Mais informações” e em “Executar assim mesmo”.

O atalho “Slide Assistido” no menu Iniciar (e, se escolhido, na área de trabalho) abre uma janela preta com o servidor local e o navegador em `http://localhost:4174`. Mantenha a janela preta aberta durante o uso e feche-a para encerrar o programa. Clicar de novo no atalho com o programa aberto apenas reabre o navegador. Confirme “Protótipo local · versão 12” no alto.

As apresentações importadas ficam em `%LOCALAPPDATA%\SlideAssistido\user_data`, fora da pasta do programa, e são preservadas em atualizações e na desinstalação. O menu Iniciar tem o atalho “Pasta das apresentações”. Para trazer as apresentações de uma versão anterior (iniciada pelo arquivo `.bat`), copie o conteúdo da antiga pasta `user_data` para essa pasta com o programa fechado.

O modelo semântico continua sendo baixado da internet na primeira preparação semântica (cerca de 470 MB) e depois permanece no cache do computador.

O instalador é gerado pelo GitHub Actions (`.github/workflows/slide-assistido-windows.yml`), que também o instala em uma máquina Windows limpa e testa importação de PDF e busca semântica. Para gerá-lo manualmente em um Windows com Python 3.12 e Inno Setup 6, execute `powershell -ExecutionPolicy Bypass -File windows\construir.ps1`; o resultado fica em `windows\build\saida`.

## Execução sem instalador

`INICIAR_NO_WINDOWS.bat` continua disponível para quem tem Python instalado. Ele instala PyMuPDF, WebSockets e Sentence Transformers, caso estejam ausentes, e grava as apresentações na pasta `user_data` ao lado do programa.

Para iniciar manualmente em outro sistema, instale as dependências com `python3 -m pip install pymupdf 'websockets>=14,<17' sentence-transformers`, execute `python3 server.py` dentro de `slide-assistido` e acesse `http://localhost:4174`. A variável de ambiente `SLIDE_ASSISTIDO_DATA` permite escolher outra pasta de dados.

## Biblioteca e arquivos

Use o botão “Nova apresentação” ou o cartão com o símbolo “+”. Selecione um PDF ou PPTX de até 60 MB e 150 telas. O conteúdo real do arquivo é validado. PDFs protegidos por senha e apresentações com macros são rejeitados.

O PPTX exige LibreOffice instalado no computador. Ele é convertido em PDF e perde animações, vídeos e entradas progressivas. Os arquivos importados ficam em `user_data`. Título, comentários, palavras-chave, configurações e última tela visitada ficam no arquivo da própria apresentação. A biblioteca permite pesquisar, renomear e excluir apresentações.

O comando “Baixar backup” gera um ZIP que contém a pasta `user_data`. Para restaurar, extraia o ZIP e copie o conteúdo dessa pasta para a pasta de dados com o programa fechado.

## Preparação e busca semântica

O título, o comentário e as palavras-chave são editáveis em cada tela. A busca semântica utiliza esses dados e o texto extraído do PDF. O modelo multilíngue funciona no computador e não utiliza uma API de embeddings. A Deepgram participa somente da transcrição da fala.

Os vetores de cada apresentação são gravados ao lado dos arquivos e reutilizados depois que o servidor é reiniciado. A edição de uma tela invalida o índice para que ele seja atualizado no próximo ensaio ou apresentação.

O ensaio aceita texto digitado e fala captada pelo botão “Testar microfone”. Após uma fala final, o sistema coloca a transcrição no campo de ensaio e apresenta as cinco candidatas mais próximas com suas pontuações. A calibração avançada controla compatibilidade mínima, diferença entre candidatas, janela da fala, intervalo entre sugestões e tempo de bloqueio após uma recusa.

## Deepgram e microfone

Cole uma chave da API da Deepgram e clique em “Ativar Deepgram”. A chave permanece apenas na memória do servidor e precisa ser informada novamente depois que o programa é fechado. O áudio é enviado à Deepgram somente durante o teste ou a apresentação.

Escolha a entrada de áudio e clique em “Testar microfone”. A fala final também executa o ensaio semântico. Durante uma apresentação, o sistema tenta restabelecer automaticamente uma conexão interrompida. Após quatro falhas, continua em modo manual e mostra o estado no canto superior direito.

## Apresentação

A apresentação entra em tela cheia e carrega antecipadamente as telas próximas. Setas, Page Up, Page Down, espaço, clique nas laterais e controles compatíveis continuam funcionando sem inteligência artificial.

Quando outra tela supera os limites configurados, uma notificação aparece no canto inferior direito. A resposta pode ser dada pelos botões ou pela voz. Respostas evidentes são tratadas por regras; respostas naturais passam por um classificador semântico local restrito a afirmativa, negativa ou ambígua.

Uma sugestão recusada fica bloqueada pelo período configurado, e telas exibidas recentemente recebem uma redução temporária de prioridade. É possível usar um prazo ou manter a sugestão aberta até a resposta.

Os comandos isolados “próximo slide”, “passe para o próximo slide” e “avance para a próxima tela” avançam uma posição na ordem normal. “Slide anterior” e “passe para o slide anterior” recuam uma posição. Já “volte para a tela anterior”, “voltar ao slide anterior” e “voltar um slide” recuperam a última tela do histórico, inclusive depois de um salto ou da navegação manual. Pequenas variações de tempo verbal e a divisão do comando em dois trechos finais são aceitas. Uma frase narrativa, como “no próximo slide veremos os resultados”, não é um comando.

O botão “Comandos de voz”, na biblioteca e no painel de preparação, abre a tela de configuração dos três comandos: próximo slide, slide anterior e voltar ao histórico. Em cada um é possível cadastrar frases próprias, uma por linha, e desligar as frases padrão. As frases personalizadas valem para todas as apresentações, ficam no arquivo `voice_commands.json` da pasta de dados e têm prioridade sobre as padrão; por exemplo, “voltar um slide” pode ser cadastrada como slide anterior. Frases com menos de duas palavras e seis letras, frases iguais a respostas às sugestões e frases repetidas em comandos diferentes são recusadas. A tela permite verificar uma frase digitada ou falada antes de salvar. As frases personalizadas também são enviadas à Deepgram como termos prioritários de transcrição; se a Deepgram recusar esse recurso, a conexão é refeita sem ele.

Os comandos de navegação são analisados antes de respostas às sugestões. Se houver sugestão aberta, “próximo slide” a fecha e avança normalmente, sem aceitar a tela sugerida; “sim, pode abrir” aceita a sugestão. Os comandos por voz exigem a transcrição da Deepgram ativa. A tecla D mostra ou oculta o diagnóstico técnico.

Execute `node tests/voice-navigation.test.cjs` na pasta do aplicativo para verificar as frases reconhecidas, a separação de trechos e a navegação com sugestão aberta.

## Transcrição e privacidade

A transcrição fica disponível durante a sessão e pode ser baixada em TXT com horário, tela e métricas de sugestões. A opção “Guardar a transcrição após encerrar” vem desativada. Quando ativada, a última sessão fica no armazenamento do navegador. O áudio bruto não é gravado.

## Migração do modelo semântico para a VPS

Na versão local, o Sentence Transformers baixa o modelo `paraphrase-multilingual-MiniLM-L12-v2` para o cache do usuário e o Python o carrega quando necessário. Na VPS, o mesmo modelo ficará instalado uma única vez em um trabalhador semântico isolado, de preferência dentro da imagem do contêiner ou em volume persistente. Os computadores que acessarem o sistema pelo navegador não precisarão instalar nem baixar o modelo.

Ao importar ou editar uma apresentação, o trabalhador produzirá os vetores das telas e a arquitetura de produção os armazenará no PostgreSQL com a extensão pgvector. Durante a apresentação, a Deepgram continuará responsável somente por transformar áudio em texto. O trecho recente transcrito será transformado em vetor no próprio servidor e comparado aos vetores das telas. Portanto, não haverá chamada à OpenAI nem cobrança externa por comparação semântica.

Na Deepgram, será necessário manter conta ativa, chave de API e saldo ou plano para a transcrição. Não existe configuração no painel da Deepgram para habilitar o modelo semântico local. Na VPS, a chave ficará em um segredo do servidor, nunca no código ou no navegador. Antes da implantação definitiva, a memória e o processador da VPS serão medidos com apresentações reais; se o consumo do PyTorch for excessivo, o mesmo modelo poderá ser servido com ONNX Runtime.

## Limites desta versão

A versão 12 continua sendo local, sem conta administrativa, HTTPS, sincronização entre aparelhos ou banco de dados. A implantação em `apresenta.plana.app` exigirá a arquitetura de produção descrita no planejamento.

O código próprio do protótipo está sob a licença Apache 2.0, incluída em `LICENSE`. A licença não transfere direitos sobre a marca, os arquivos de apresentações ou os comentários do usuário.
