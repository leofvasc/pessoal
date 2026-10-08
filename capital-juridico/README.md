# Novo site da Editora Capital Jurídico (WordPress na Hostinger)

Este diretório contém o site novo da Capital Jurídico em duas peças que se instalam pelo painel do WordPress: o plugin **Capital Jurídico — Núcleo** (`wp-content/plugins/capital-juridico-core`), que guarda e administra todo o conteúdo, e o tema **Capital Jurídico** (`wp-content/themes/capital-juridico`), que cuida apenas da aparência e segue o design system "Capital Jurídico" (tokens, fontes Zilla Slab, Source Serif 4 e Source Sans 3, logotipos e componentes). A separação é deliberada: trocar o tema no futuro não apaga livros, artigos, hotsites ou configurações.

Os arquivos prontos para envio estão em `dist/` (`capital-juridico-core.zip` e `capital-juridico-tema.zip`). Depois de qualquer alteração no código, gere-os de novo com `./build.sh`.

## O que o painel administra

Tudo é feito em `seudominio/wp-admin`, sem editar arquivos.

O menu **Livros** guarda o catálogo publicado em `/livros` (mesmo endereço do Wix). Cada obra tem capa, sinopse, autoria, ISBN, DOI e a disponibilidade em dois formatos. A versão impressa pode estar disponível, em pré-venda, esgotada ou não existir. A versão digital pode ser gratuita (com arquivo ou link de download), estar à venda (com link de compra) ou estar indisponível. O site mostra automaticamente o botão "Baixar gratuitamente", "Comprar", ou os avisos "Impresso esgotado" e "Digital indisponível".

O menu **Hotsites** cria páginas de lançamento a partir do código desenvolvido para cada obra. O código é colado ou enviado como arquivo `.js` ou `.html`, e o hotsite passa a responder no endereço escolhido (por exemplo, `/livro-ia`). O formato aceito é o mesmo dos hotsites feitos para o Wix, que funcionam sem alteração. O chatbot de cada hotsite, com instruções, base de conhecimento, modelo e limite diário, é configurado na mesma tela, e o botão "Testar conexão" faz uma chamada real fora da cota. Cada troca de código guarda a versão anterior para desfazer. Por padrão o hotsite não aparece em menus nem na lista de lançamentos; isso é ligado por hotsite.

A **Revista Capital Jurídico** tem uma área própria de acervo histórico, que a apresenta expressamente como periódico descontinuado (13 números bimestrais, de dezembro de 2020 a abril de 2024) e exibe o ISSN 2763-9959 em todas as suas páginas, como exige o registro do ISSN. Todos os endereços são os do Wix: a lista dos números em `/numerosanteriores`, cada número em `/numero01` a `/numero13`, os artigos em `/artigos` e `/post/slug`, as categorias em `/artigos/categories/…`, as tags em `/artigos/tags/…`, o expediente em `/expediente` e as normas para publicação em `/publique`. Os números ficam em **Posts → Edições da Revista**, com capa, período e PDF. O quadro do expediente (título, ISSN, periodicidade, período, idiomas, editor-chefe, editores científicos, autor corporativo, endereço, editora, mantenedora e contato) e o texto de apresentação do acervo ficam em **Configurações → Capital Jurídico**.

O endereço `/publique` continua sendo das normas da revista, porque é o que o Google associa a ele. A editora recebe originais de livros em `/publique-seu-livro`. Da mesma forma, o antigo "Sobre a Revista" (`/sobre` no Wix) é importado para o expediente do acervo, e `/sobre` passa a apresentar a editora, com o editor-chefe e a mantenedora.

Em **Configurações → Capital Jurídico** ficam os textos da página inicial, os contatos, o editor-chefe da editora (nome, minibiografia, foto e currículo), a mantenedora (Instituto Lovelace de Inteligência Artificial Aplicada, CNPJ 68.069.042/0001-12, exibida no rodapé de todas as páginas, na página Sobre e nos dados estruturados), os dados da revista, a chave da OpenAI e as chaves da verificação "não sou robô" (Cloudflare Turnstile). As chaves são gravadas cifradas e nunca reaparecem na tela. Na mesma página ficam os redirecionamentos 301 manuais e o registro de endereços não encontrados (404). Em **Aparência → Menus** montam-se os menus do topo e do rodapé, e em **Aparência → Personalizar → Identidade do site** troca-se o logotipo e o ícone.

Todas as páginas, artigos, livros e hotsites têm o painel **SEO e compartilhamento**, com título para o Google, descrição, imagem de compartilhamento, canonical, opção de não indexar e campo para dados estruturados. O sitemap fica em `/wp-sitemap.xml`, e o antigo `/sitemap.xml` redireciona para ele.

Em **Ferramentas → Importar do Wix** fica o importador do site antigo.

## Como a migração preserva os endereços e o SEO

O importador lê o sitemap do Wix (inclusive o dos posts, que o índice do Wix deixa de listar) e recria cada um dos 97 artigos com o mesmo slug, inclusive os acentuados, e com a mesma data, o mesmo título de SEO (a tag `<title>` exata que o Google conhece), a mesma descrição, a mesma imagem de compartilhamento, a autoria, as categorias e as tags. Imagens hospedadas no Wix e os arquivos que o Wix servia no próprio domínio (`/_files/ugd/…pdf`, onde estão os PDFs dos números, os e-books, as diretrizes e os documentos do CAMPIA) são copiados para a biblioteca de mídia; os links são reescritos e o endereço antigo de cada arquivo passa a redirecionar para a cópia. Na etapa final, com base no levantamento do site antigo gravado em `includes/migracao-wix.json`, o importador cria os 13 números da revista (período, capa, PDF e artigos de cada um) e os cinco livros do catálogo antigo. As páginas institucionais recebem o título e a descrição de SEO que tinham; `/publique` recebe também o texto original; as páginas sem equivalente no site novo (eventos, vídeos, prêmio, seminário, CAMPIA e edital do livro de IA) são recriadas no mesmo endereço com o texto original; `/numeroatual` e `/cópia-número-atual` passam a redirecionar para os números 10 e 13. Por fim, a etapa "Verificar" confere se cada endereço antigo responde no site novo. O relatório completo sai em CSV.

Endereços do Wix sem equivalente direto já redirecionam sozinhos: `/single-post/slug` vai para `/post/slug`, `/blog-feed.xml` vai para `/feed`, `/sitemap.xml` vai para `/wp-sitemap.xml`, e artigos cujo slug o WordPress precisou ajustar são redirecionados pelo slug original.

## Domínios

O domínio principal passa a ser `capitaljur.com.br`. O domínio `revistacapitaljuridico.com.br` continua registrado e apontado para a mesma hospedagem, e todo acesso a ele (com ou sem `www`) é redirecionado com código 301 para o mesmo caminho no domínio novo: `revistacapitaljuridico.com.br/post/x` vai para `capitaljur.com.br/post/x`. O redirecionamento é feito pelo plugin (**Configurações → Capital Jurídico → Domínios**) e preserva caminho e parâmetros. Se a Hostinger não permitir apontar o domínio antigo para o mesmo site, a alternativa é o arquivo `dominio-antigo/.htaccess`.

O importador também reescreve, nos artigos e páginas, os links internos que apontavam para o domínio antigo, para que passem a apontar direto para o novo.

## Passo a passo de instalação na Hostinger

1. Contrate na Hostinger um plano de hospedagem com WordPress (Premium ou Business).
2. Faça os passos 1 e 2 da lista de domínios (registro de `capitaljur.com.br` na própria Hostinger).
3. No hPanel, em **Sites → Adicionar site**, escolha WordPress e selecione o domínio `capitaljur.com.br`. Defina usuário e senha do administrador.
4. Confira a versão do PHP: em **Sites**, clique em **Painel** (ou **Gerenciar**) ao lado do site, digite "PHP" na busca da barra lateral e abra **Configuração do PHP**; na aba da versão, escolha 8.2 ou superior e clique em **Atualizar**. Os limites de envio e de tempo de execução da Hostinger já vêm no máximo do plano e não precisam ser alterados; se a opção não aparecer, siga adiante e confira a versão depois, no WordPress, em **Ferramentas → Saúde do site → Informações → Servidor** (o plugin exige PHP 8.0 ou superior).
5. Depois de confirmar que `capitaljur.com.br` abre o site (passos 3 e 4 da lista de domínios), vá em **Segurança → SSL**, instale o certificado gratuito para `capitaljur.com.br` e ative "Forçar HTTPS".
6. Entre no WordPress (`capitaljur.com.br/wp-admin`). Em **Configurações → Geral**, escolha Português do Brasil, fuso de Rio Branco e confira que os dois endereços estão como `https://capitaljur.com.br`.
7. Apague o post "Olá, mundo!" e a "Página de exemplo".
8. Em **Plugins → Adicionar novo → Enviar plugin**, envie `dist/capital-juridico-core.zip` e ative.
9. Em **Aparência → Temas → Adicionar novo → Enviar tema**, envie `dist/capital-juridico-tema.zip` e ative.
10. Em **Configurações → Links permanentes**, apenas clique em "Salvar alterações" (isso grava as regras de endereço no servidor).
11. Em **Configurações → Capital Jurídico**, confira textos, contatos, editor-chefe, mantenedora, dados da revista e domínios antigos; cole a chave da OpenAI e as chaves do Cloudflare Turnstile (crie-as em dash.cloudflare.com → Turnstile, cadastrando os dois domínios).
12. Em **Hotsites → Criar hotsite**, crie `livro-ia` (arquivo `livro-ia.js`, chatbot ligado, instruções de `migracao/livro-ia/instrucoes-chatbot.txt` e base de `migracao/livro-ia/base-conhecimento.md`) e use "Testar conexão". Crie `coletanea-empresarial` com o código dessa obra.
13. Em **Ferramentas → Importar do Wix**, mantenha o endereço `https://www.revistacapitaljuridico.com.br`, clique em "1. Ler sitemap" e depois em "2. Importar pendentes", e deixe a página aberta até "Importação concluída". Isso precisa ser feito enquanto o domínio antigo ainda aponta para o Wix.
14. Leia a tabela de resultados; se houver linha com "erro", clique em "Marcar tudo para reimportar" e repita o passo 13. Baixe o relatório CSV e guarde-o.
15. Confira **Posts → Edições da Revista** (13 números), **Livros** (5 obras) e as páginas recriadas (eventos, vídeos, prêmio, seminário, CAMPIA, edital), e escreva as páginas Sobre a editora, Publique seu livro, Contato e Política de privacidade.
16. Em **Aparência → Menus**, monte os menus do topo e do rodapé; em **Aparência → Personalizar → Identidade do site**, envie o ícone do site.
17. Faça os passos 5 a 11 da lista de domínios (domínio antigo).
18. Em **Ferramentas → Importar do Wix**, clique em "3. Verificar endereços no site novo" e cadastre redirecionamentos para o que não responder 200 ou 301.
19. Em **Sites → Gerenciar → Backups**, confirme que os backups automáticos estão ativos.
20. Nos meses seguintes, consulte o registro de endereços não encontrados em **Configurações → Capital Jurídico** e crie redirecionamentos para os que ainda recebem visitas.

## Passo a passo de configuração dos domínios

`capitaljur.com.br` fica registrado e com DNS na Hostinger; `revistacapitaljuridico.com.br` continua registrado na Locaweb.

1. No hPanel da Hostinger, em **Domínios → Registrar novo domínio**, registre `capitaljur.com.br`. Domínios `.com.br` exigem o CPF ou o CNPJ do titular; defina com cuidado quem será o titular (você ou o Instituto Lovelace), porque trocar a titularidade depois é um procedimento no Registro.br.
2. Conclua os dados de contato pedidos pelo Registro.br e aguarde a ativação do domínio (pode levar algumas horas).
3. Ao criar o site com o domínio registrado na própria Hostinger (passo 3 da instalação), o apontamento é automático; confirme em **Domínios → capitaljur.com.br → DNS / Nameservers** que o domínio usa os servidores DNS da Hostinger.
4. Aguarde a propagação e confirme que `capitaljur.com.br` abre o site; só então instale o SSL (passo 5 da instalação).
5. Antes de mexer no domínio antigo, conclua a importação do Wix (passo 13 da instalação).
6. No hPanel, em **Domínios → Domínios estacionados** do site `capitaljur.com.br`, adicione `revistacapitaljuridico.com.br`. Se o seu plano não oferecer essa opção, crie o domínio antigo como site separado e coloque nele o arquivo `dominio-antigo/.htaccess`.
7. Anote o IP do site, em **Sites → Gerenciar → Painel**, campo "IP do site".
8. No painel da Locaweb, na zona DNS de `revistacapitaljuridico.com.br`, substitua os registros que apontam para o Wix: o registro A de `@` passa a apontar para o IP da Hostinger, e o registro de `www` passa a ser CNAME para `revistacapitaljuridico.com.br`. Não altere os registros MX nem TXT de e-mail.
9. Após a propagação, instale no hPanel o SSL também para `revistacapitaljuridico.com.br` e `www.revistacapitaljuridico.com.br`. Sem esse certificado, quem acessa os endereços antigos com `https` (que é como o Google os conhece) vê um aviso de segurança antes do redirecionamento.
10. Teste no navegador: `https://www.revistacapitaljuridico.com.br/post/ia-juridica-e-software-de-plagio` deve abrir `https://capitaljur.com.br/post/ia-juridica-e-software-de-plagio`; `https://revistacapitaljuridico.com.br/numero01` deve abrir `https://capitaljur.com.br/numero01`.
11. No Wix, só depois dos testes, desconecte o domínio do site e encerre o plano.
12. No Google Search Console, adicione a propriedade de domínio `capitaljur.com.br`; a verificação por registro TXT é feita na zona DNS da Hostinger (**Domínios → capitaljur.com.br → DNS**). Depois envie o sitemap `https://capitaljur.com.br/wp-sitemap.xml`.
13. No Search Console, na propriedade de `revistacapitaljuridico.com.br` (crie-a e verifique-a por registro TXT na zona DNS da Locaweb, se ainda não existir), use **Configurações → Mudança de endereço** e indique `capitaljur.com.br`.
14. Comunique o novo endereço da revista ao IBICT (centro brasileiro do ISSN), porque o registro do ISSN 2763-9959 informa a URL do periódico.
15. Atualize o endereço nos perfis e cadastros externos (Instagram, Lattes, assinaturas de e-mail, Google Meu Negócio, se houver).
16. Mantenha `revistacapitaljuridico.com.br` registrado e renovado na Locaweb indefinidamente, e ative a renovação automática também de `capitaljur.com.br` na Hostinger.

## Pontos de atenção

O importador foi testado contra o site real: dos 97 artigos, todos foram recriados com o mesmo endereço, e os 13 números, os 5 livros, as páginas e os PDFs foram migrados. Nesse teste, as imagens hospedadas em `static.wixstatic.com` não puderam ser baixadas por restrição de rede do ambiente de desenvolvimento; na Hostinger elas serão copiadas normalmente. Mesmo assim, confira algumas imagens de artigos depois da importação.

A troca do domínio principal tem um custo de SEO, ainda que pequeno e temporário. Com redirecionamento 301 página a página e a ferramenta de mudança de endereço do Search Console, o Google transfere os sinais do domínio antigo para o novo, mas é comum uma oscilação de posições por algumas semanas. Os redirecionamentos devem ser mantidos permanentemente.

O Cloudflare Turnstile substitui o reCAPTCHA nativo do Wix. Sem as duas chaves, o chatbot funciona apenas com o limite diário por hotsite e com o limite de 40 perguntas por hora por endereço IP.

O código colado em um hotsite roda com os mesmos privilégios do site, por isso só administradores podem gravá-lo. Use apenas código de origem conhecida.
