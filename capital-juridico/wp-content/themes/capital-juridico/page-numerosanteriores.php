<?php
/**
 * /numerosanteriores — mesmo endereço do Wix. Página principal do acervo
 * histórico da Revista Capital Jurídico, com todos os números publicados.
 */
get_header();
$edicoes = class_exists('CJ_Revista') ? CJ_Revista::edicoes() : [];
?>
<main id="conteudo">
    <?php get_template_part('template-parts/acervo-cabecalho', null, ['completo' => true]); ?>
    <div class="wrap pagina">
        <?php while (have_posts()) : the_post(); if (trim(get_the_content()) !== '') : ?>
            <div class="conteudo"><?php the_content(); ?></div>
        <?php endif; endwhile; ?>
        <h2 class="secao-titulo">Números publicados</h2>
        <div class="grade-edicoes">
            <?php foreach ($edicoes as $e) : ?>
                <article class="edicao">
                    <a href="<?php echo esc_url($e['url']); ?>" class="edicao-capa">
                        <?php if ($e['capa']) : ?><img src="<?php echo esc_url($e['capa']); ?>" alt="Capa — <?php echo esc_attr($e['term']->name); ?>" loading="lazy"><?php else : ?><span class="capa-vazia"><?php echo esc_html($e['term']->name); ?></span><?php endif; ?>
                    </a>
                    <h3><a href="<?php echo esc_url($e['url']); ?>"><?php echo esc_html($e['term']->name); ?></a></h3>
                    <?php if ($e['periodo']) : ?><p class="miudo"><?php echo esc_html($e['periodo']); ?></p><?php endif; ?>
                    <p class="miudo"><?php echo (int) $e['term']->count; ?> artigo(s)<?php if ($e['pdf']) : ?> · <a href="<?php echo esc_url($e['pdf']); ?>">PDF da edição</a><?php endif; ?></p>
                </article>
            <?php endforeach; ?>
            <?php if (!$edicoes) : ?><p>Os números serão listados aqui após a importação do acervo.</p><?php endif; ?>
        </div>
        <p><a class="botao botao-linha" href="<?php echo esc_url(get_permalink((int) get_option('page_for_posts')) ?: home_url('/artigos')); ?>">Todos os artigos</a></p>
    </div>
</main>
<?php get_footer();
