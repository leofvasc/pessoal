<?php
/** /lancamentos: hotsites marcados como "Mostrar na lista de lançamentos". */
get_header();
$lista = class_exists('CJ_Hotsites') ? CJ_Hotsites::lancamentos() : [];
?>
<main id="conteudo" class="wrap pagina">
    <?php while (have_posts()) : the_post(); ?>
        <h1 class="pagina-titulo"><?php the_title(); ?></h1>
        <div class="conteudo"><?php the_content(); ?></div>
    <?php endwhile; ?>
    <div class="grade-lancamentos claro">
        <?php foreach ($lista as $h) : ?>
            <a class="lancamento" href="<?php echo esc_url(CJ_Hotsites::url($h->ID)); ?>">
                <?php echo get_the_post_thumbnail($h->ID, 'large', ['loading' => 'lazy']); ?>
                <span class="lancamento-texto">
                    <strong><?php echo esc_html(get_the_title($h)); ?></strong>
                    <?php if ($h->post_excerpt) : ?><span><?php echo esc_html($h->post_excerpt); ?></span><?php endif; ?>
                    <span class="seta">Conhecer a obra →</span>
                </span>
            </a>
        <?php endforeach; ?>
        <?php if (!$lista) : ?><p>Nenhum lançamento em destaque no momento.</p><?php endif; ?>
    </div>
</main>
<?php get_footer();
