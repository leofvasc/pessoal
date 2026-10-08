<?php
/**
 * /publique — normas para publicação da Revista Capital Jurídico (endereço do Wix).
 * Mantidas no acervo como registro histórico exigido pelo ISSN. A editora
 * recebe originais de livros em /publique-seu-livro.
 */
get_header();
?>
<main id="conteudo">
    <?php get_template_part('template-parts/acervo-cabecalho'); ?>
    <div class="wrap pagina">
        <?php while (have_posts()) : the_post(); ?>
            <h1 class="pagina-titulo"><?php the_title(); ?></h1>
            <p class="aviso">Submissões encerradas. A revista foi descontinuada, e as normas abaixo permanecem publicadas como registro das regras sob as quais os artigos do acervo foram recebidos e avaliados. Para publicar um livro, veja <a href="<?php echo esc_url(home_url('/publique-seu-livro')); ?>">Publique seu livro</a>.</p>
            <div class="conteudo">
                <?php if (trim(get_the_content()) !== '') :
                    the_content();
                else : ?>
                    <p>A Revista Capital Jurídico recebia, em fluxo contínuo e sem cobrança de taxas, artigos jurídicos inéditos, enviados por e-mail em arquivo Word e acompanhados de minibiografia do autor.</p>
                    <p class="miudo">Texto provisório. O importador do site antigo substitui este resumo pelo texto integral das normas originais.</p>
                <?php endif; ?>
            </div>
        <?php endwhile; ?>
    </div>
</main>
<?php get_footer();
