<?php
/** Catálogo: /livros (mesmo endereço do Wix). */
get_header();
$areas = get_terms(['taxonomy' => 'cj_area', 'hide_empty' => true]);
?>
<main id="conteudo" class="wrap pagina">
    <p class="sobretitulo"><?php bloginfo('name'); ?></p>
    <h1 class="pagina-titulo"><?php echo is_tax() ? esc_html(single_term_title('', false)) : 'Catálogo de livros'; ?></h1>
    <?php if ($areas && !is_wp_error($areas)) : ?>
        <nav class="filtros" aria-label="Áreas do Direito">
            <a href="<?php echo esc_url(get_post_type_archive_link('cj_livro')); ?>"<?php echo is_tax() ? '' : ' aria-current="page"'; ?>>Todos</a>
            <?php foreach ($areas as $a) : ?>
                <a href="<?php echo esc_url(get_term_link($a)); ?>"<?php echo is_tax('cj_area', $a->term_id) ? ' aria-current="page"' : ''; ?>><?php echo esc_html($a->name); ?></a>
            <?php endforeach; ?>
        </nav>
    <?php endif; ?>
    <div class="grade-livros">
        <?php if (have_posts()) : while (have_posts()) : the_post(); get_template_part('template-parts/card-livro'); endwhile; else : ?>
            <p>Nenhum livro cadastrado ainda.</p>
        <?php endif; ?>
    </div>
    <?php the_posts_pagination(); ?>
</main>
<?php get_footer();
