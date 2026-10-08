# Novo site da Editora Capital Jurídico (WordPress na Hostinger)

Este diretório contém o site novo da Capital Jurídico em duas peças que se instalam pelo painel do WordPress: o plugin **Capital Jurídico — Núcleo** (`wp-content/plugins/capital-juridico-core`), que guarda e administra todo o conteúdo, e o tema **Capital Jurídico** (`wp-content/themes/capital-juridico`), que cuida apenas da aparência e segue o design system "Capital Jurídico" (tokens, fontes Zilla Slab, Source Serif 4 e Source Sans 3, logotipos e componentes). A separação é deliberada: trocar o tema no futuro não apaga livros, artigos, hotsites ou configurações.

Os arquivos prontos para envio estão em `dist/` (`capital-juridico-core.zip` e `capital-juridico-tema.zip`). Depois de qualquer alteração no código, gere-os de novo com `./build.sh`.

## O que o painel administra

Tudo é feito em `seudominio/wp-admin`, sem editar arquivos.

O menu **Livros** guarda o catálogo publicado em `/livros` (mesmo endereço do Wix). Cada obra tem capa, sinopse, autoria, ISBN, DOI e a disponibilidade em dois formatos. A versão impressa pode estar disponível, em pré-venda, esgotada ou não existir. A versão digital pode ser gratuita (com arquivo ou link de download), estar à venda (com link de compra) ou estar indisponível. O site mostra automaticamente o botão "Baixar gratuitamente", "Comprar", ou os avisos "Impresso esgotado" e "Digital indisponível".

O menu **Hotsites** cria páginas de lançamento a partir do código desenvolvido para cada obra. O código é colado ou enviado como arquivo `.js` ou `.html`, e o hotsite passa a responder no endereço escolhido (por exemplo, `/livro-ia`). O formato aceito é o mesmo dos hotsites feitos para o Wix, que funcionam sem alteração. O chatbot de cada hotsite, com instruções, base de conhecimento, modelo e limite diário, é configurado na mesma tela, e o botão "Testar conexão" faz uma chamada real fora da cota. Cada troca de código guarda a versão anterior para desfazer. Por padrão o hotsite não aparece em menus nem na lista de lançamentos; isso é ligado por hotsite.

A **Revista Capital Jurídico** tem uma área própria de acervo histórico, que a apresenta expressamente como periódico descontinuado e exibe o ISSN 2763-9959 em todas as suas páginas, como exige o registro do ISSN. A área tem quatro partes, ligadas por uma navegação comum: os números (`/numerosanteriores`, endereço do Wix), os artigos (`/blog` e cada artigo em `/post/slug`, endereços do Wix), o expediente (`/numerosanteriores/expediente`) e as normas para publicação (`/publique`, endereço do Wix). Os números ficam em **Posts → Edições da Revista**, com capa, período e PDF. O quadro do expediente e os dados do periódico (título, ISSN, periodicidade, período, local, editor-chefe, e-mail e texto de apresentação) ficam em **Configurações → Capital Jurídico**; o texto do conselho editorial e do histórico é editado na própria página do expediente. As categorias e hashtags mantêm os endereços do Wix (`/blog/categories/…` e `/blog/hashtags/…`).

O endereço `/publique` continua sendo das normas da revista, porque é o que o Google associa a ele. A editora recebe originais de livros em `/publique-seu-livro`. Da mesma forma, o antigo "Sobre a Revista" (`/sobre` no Wix) é importado para o expediente do acervo, e `/sobre` passa a apresentar a editora, com o editor-chefe e a mantenedora.

Em **Configurações → Capital Jurídico** ficam os textos da página inicial, os contatos, o editor-chefe da editora (nome, minibiografia, foto e currículo), a mantenedora (Instituto Lovelace de Inteligência Artificial Aplicada, CNPJ 68.069.042/0001-12, exibida no rodapé de todas as páginas, na página Sobre e nos dados estruturados), os dados da revista, a chave da OpenAI e as chaves da verificação "não sou robô" (Cloudflare Turnstile). As chaves são gravadas cifradas e nunca reaparecem na tela. Na mesma página ficam os redirecionamentos 301 manuais e o registro de endereços não encontrados (404). Em **Aparência → Menus** montam-se os menus do topo e do rodapé, e em **Aparência → Personalizar → Identidade do site** troca-se o logotipo e o ícone.

Todas as páginas, artigos, livros e hotsites têm o painel **SEO e compartilhamento**, com título para o Google, descrição, imagem de compartilhamento, canonical, opção de não indexar e campo para dados estruturados. O sitemap fica em `/wp-sitemap.xml`, e o antigo `/sitemap.xml` redireciona para ele.

Em **Ferramentas → Importar do Wix** fica o importador do site antigo.

## Como a migração preserva os endereços e o SEO

O importador lê o sitemap do Wix e recria cada artigo com o mesmo slug, a mesma data, o mesmo título de SEO (a tag `<title>` exata que o Google conhece), a mesma descrição, a mesma imagem de compartilhamento, a autoria, as categorias e as hashtags. Imagens e PDFs hospedados nos servidores do Wix são copiados para a biblioteca de mídia, e os links são reescritos, porque esses arquivos deixarão de existir quando a assinatura do Wix for encerrada. Nas páginas que não são artigos (`/publique`, `/numerosanteriores`, `/livro-ia` e outras), o importador aplica título, descrição e imagem de SEO à página ou ao hotsite de mesmo endereço e, se a página nova ainda estiver vazia, copia também o texto original (é assim que as normas da revista e o expediente chegam ao acervo). Por fim, a etapa "Verificar" confere se cada endereço antigo responde no site novo e aponta os que precisam de redirecionamento. O relatório completo sai em CSV.

Endereços do Wix sem equivalente direto já redirecionam sozinhos: `/single-post/slug` vai para `/post/slug`, `/blog-feed.xml` vai para `/feed`, `/sitemap.xml` vai para `/wp-sitemap.xml`, e artigos cujo slug o WordPress precisou ajustar são redirecionados pelo slug original.

## Passo a passo de implantação

1. Na Hostinger, contrate a hospedagem e crie o site com o instalador de WordPress em um **domínio temporário** (a Hostinger oferece um), sem mexer ainda no domínio `revistacapitaljuridico.com.br`, que continua apontando para o Wix.
2. No WordPress, em **Configurações → Geral**, escolha o idioma Português do Brasil e o fuso horário de Rio Branco.
3. Em **Plugins → Adicionar novo → Enviar plugin**, envie `dist/capital-juridico-core.zip` e ative.
4. Em **Aparência → Temas → Adicionar novo → Enviar tema**, envie `dist/capital-juridico-tema.zip` e ative.
5. Em **Configurações → Capital Jurídico**, preencha os textos, os contatos e a chave da OpenAI. Crie as chaves gratuitas do Cloudflare Turnstile em dash.cloudflare.com e cole-as ali.
6. Em **Hotsites → Criar hotsite**, crie o `livro-ia`: título da obra, endereço `livro-ia`, envio do arquivo `livro-ia.js` do pacote do Wix, chatbot ligado, instruções coladas de `migracao/livro-ia/instrucoes-chatbot.txt` e base colada de `migracao/livro-ia/base-conhecimento.md`. Use "Testar conexão". Repita com o `coletanea-empresarial`.
7. Crie os hotsites **antes** de importar, para que o importador aplique a eles o SEO que tinham no Wix.
8. Em **Ferramentas → Importar do Wix**, clique em "1. Ler sitemap" e depois em "2. Importar pendentes", e deixe a página aberta até a mensagem "Importação concluída".
9. Leia a tabela de resultados. Linhas com "texto curto" ou "erro" pedem conferência manual do artigo. Baixe o relatório CSV e guarde-o.
10. Em **Posts → Edições da Revista**, confira os números criados pelo importador, preencha número, período e capa, e associe a cada edição os artigos que não foram associados automaticamente.
11. Cadastre os livros em **Livros**, com capa e disponibilidade, e monte os menus em **Aparência → Menus**.
12. Confira o texto importado para as normas (`/publique`) e para o expediente (`/numerosanteriores/expediente`), confira os dados da revista em **Configurações → Capital Jurídico** e escreva o conteúdo das páginas Sobre a editora, Publique seu livro, Contato e Política de privacidade (**Páginas**).
13. Aponte o domínio `revistacapitaljuridico.com.br` para a Hostinger e ative o SSL gratuito no painel da Hostinger.
14. Em **Configurações → Geral**, troque os dois endereços do site para `https://www.revistacapitaljuridico.com.br`. Use a mesma forma que o Wix usava, com `www`; mudar isso mudaria todos os endereços.
15. Em **Ferramentas → Importar do Wix**, clique em "3. Verificar endereços no site novo". Todos os artigos devem responder 200. Cadastre redirecionamentos para o que aparecer com 404.
16. No Google Search Console, envie `https://www.revistacapitaljuridico.com.br/wp-sitemap.xml` e acompanhe a cobertura nas semanas seguintes.
17. Durante os primeiros meses, consulte o registro de 404 em **Configurações → Capital Jurídico** e crie redirecionamentos para os endereços antigos que ainda recebem visitas.
18. Só cancele o plano do Wix depois que a verificação estiver limpa e o relatório CSV estiver guardado.

Se o domínio for transferido antes da importação, o site do Wix continua acessível pelo endereço gratuito `usuario.wixsite.com/…`. Nesse caso, informe esse endereço no campo do importador.

## Pontos de atenção

Para que o importador alcance o site antigo a partir de um ambiente com rede restrita, é preciso liberar `www.revistacapitaljuridico.com.br`, e não só `revistacapitaljuridico.com.br`, porque o Wix redireciona todas as páginas para o endereço com `www`. No servidor da Hostinger não há essa restrição.

O importador procura o texto do artigo nos marcadores que o Wix usa no HTML dos posts (`data-hook="post-description"` e, em seguida, outros mais genéricos). Ele foi testado contra uma simulação desse HTML, não contra o site real, porque o ambiente em que foi desenvolvido não tinha acesso ao domínio. Rode a importação primeiro no domínio temporário e confira alguns artigos antes de mudar o domínio.

O Cloudflare Turnstile substitui o reCAPTCHA nativo do Wix. Sem as duas chaves, o chatbot funciona apenas com o limite diário por hotsite e com o limite de 40 perguntas por hora por endereço IP.

O código colado em um hotsite roda com os mesmos privilégios do site, por isso só administradores podem gravá-lo. Use apenas código de origem conhecida.
