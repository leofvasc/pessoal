<?php get_header(); ?>
<main id="conteudo" class="wrap pagina">
    <h1 class="pagina-titulo">Página não encontrada</h1>
    <p>O endereço pode ter mudado. Procure pelo título do artigo ou do livro:</p>
    <?php get_search_form(); ?>
    <p><a href="<?php echo esc_url(home_url('/')); ?>">Voltar ao início</a> · <a href="<?php echo esc_url(home_url('/numerosanteriores')); ?>">Acervo de artigos</a> · <a href="<?php echo esc_url(home_url('/livros')); ?>">Catálogo</a></p>
</main>
<?php get_footer();
