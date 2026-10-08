<?php
/** Artigo da revista: /post/slug (endereço preservado do Wix). */
get_header();
?>
<main id="conteudo">
<?php get_template_part('template-parts/acervo-cabecalho'); ?>
<div class="wrap pagina artigo">
    <?php while (have_posts()) : the_post();
        $ed = get_the_terms(get_the_ID(), 'cj_edicao'); ?>
        <?php if ($ed && !is_wp_error($ed)) : ?><p class="sobretitulo"><a href="<?php echo esc_url(get_term_link($ed[0])); ?>"><?php echo esc_html($ed[0]->name); ?></a></p><?php endif; ?>
        <h1 class="pagina-titulo"><?php the_title(); ?></h1>
        <p class="artigo-autor"><?php echo esc_html(cj_autoria()); ?> · <time datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(cj_data((int) get_post_timestamp())); ?></time></p>
        <div class="conteudo"><?php the_content(); ?></div>
        <aside class="como-citar">
            <hr class="cj-rule cj-rule--hairline">
            <p class="sobretitulo">Como citar</p>
            <p><?php echo cj_referencia_artigo(get_the_ID()); // phpcs:ignore -- montada com esc_html. ?></p>
        </aside>
        <?php
        $cats = array_filter(get_the_category(), fn($c) => (int) $c->term_id !== (int) get_option('default_category'));
        if ($cats) : ?><p class="miudo">Categorias: <?php the_category(', '); ?></p><?php endif;
        the_tags('<p class="miudo">Hashtags: ', ', ', '</p>');
        the_post_navigation(['prev_text' => '← %title', 'next_text' => '%title →']);
    endwhile; ?>
</div>
</main>
<?php get_footer();
