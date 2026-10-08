<?php get_header(); ?>
<main id="conteudo" class="wrap pagina">
    <?php while (have_posts()) : the_post(); ?>
        <h1 class="pagina-titulo"><?php the_title(); ?></h1>
        <div class="conteudo"><?php the_content(); ?></div>
    <?php endwhile; ?>
</main>
<?php get_footer();
