<?php
/**
 * /numerosanteriores — mesmo endereço do Wix. Lista as edições da revista
 * (Posts → Edições da Revista) com capa, período, PDF e artigos.
 */
get_header();
$edicoes = class_exists('CJ_Revista') ? CJ_Revista::edicoes() : [];
?>
<main id="conteudo" class="wrap pagina">
    <?php while (have_posts()) : the_post(); ?>
        <p class="sobretitulo">Acervo · ISSN <?php echo esc_html(cj_opt('cj_issn')); ?></p>
        <h1 class="pagina-titulo"><?php the_title(); ?></h1>
        <p class="aviso"><?php echo esc_html(cj_opt('cj_aviso_revista')); ?></p>
        <div class="conteudo"><?php the_content(); ?></div>
    <?php endwhile; ?>

    <div class="grade-edicoes">
        <?php foreach ($edicoes as $e) : ?>
            <article class="edicao">
                <a href="<?php echo esc_url($e['url']); ?>" class="edicao-capa">
                    <?php if ($e['capa']) : ?><img src="<?php echo esc_url($e['capa']); ?>" alt="Capa — <?php echo esc_attr($e['term']->name); ?>" loading="lazy"><?php else : ?><span class="capa-vazia"><?php echo esc_html($e['term']->name); ?></span><?php endif; ?>
                </a>
                <h2><a href="<?php echo esc_url($e['url']); ?>"><?php echo esc_html($e['term']->name); ?></a></h2>
                <?php if ($e['periodo']) : ?><p class="miudo"><?php echo esc_html($e['periodo']); ?></p><?php endif; ?>
                <p class="miudo"><?php echo (int) $e['term']->count; ?> artigo(s)<?php if ($e['pdf']) : ?> · <a href="<?php echo esc_url($e['pdf']); ?>">PDF da edição</a><?php endif; ?></p>
            </article>
        <?php endforeach; ?>
    </div>
    <p><a class="botao botao-linha" href="<?php echo esc_url(get_permalink(get_option('page_for_posts')) ?: home_url('/blog')); ?>">Todos os artigos</a></p>
</main>
<?php get_footer();
