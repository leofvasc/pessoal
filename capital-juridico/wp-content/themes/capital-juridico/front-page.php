<?php
/**
 * Página inicial. Os textos vêm de Configurações → Capital Jurídico; o bloco
 * "Sobre" vem do conteúdo da página "Início" (editável no editor de blocos).
 */
get_header();
$destaques = new WP_Query(['post_type' => 'cj_livro', 'posts_per_page' => 8, 'meta_key' => '_cj_destaque', 'meta_value' => '1', 'orderby' => ['menu_order' => 'ASC', 'date' => 'DESC']]);
if (!$destaques->have_posts()) {
    $destaques = new WP_Query(['post_type' => 'cj_livro', 'posts_per_page' => 8, 'orderby' => ['menu_order' => 'ASC', 'date' => 'DESC']]);
}
$lancamentos = class_exists('CJ_Hotsites') ? CJ_Hotsites::lancamentos(3) : [];
$artigos = new WP_Query(['post_type' => 'post', 'posts_per_page' => 4, 'ignore_sticky_posts' => true]);
?>
<main id="conteudo" class="front">
    <section class="hero">
        <div class="wrap hero-inner">
            <hr class="cj-rule cj-rule--double">
            <p class="sobretitulo">Editora</p>
            <h1><?php echo esc_html(cj_opt('cj_chamada')); ?></h1>
            <p class="hero-texto"><?php echo esc_html(cj_opt('cj_apresentacao')); ?></p>
            <p class="acoes">
                <a class="botao" href="<?php echo esc_url(get_post_type_archive_link('cj_livro') ?: home_url('/livros')); ?>">Ver o catálogo</a>
                <a class="botao botao-acento" href="<?php echo esc_url(home_url('/publique-seu-livro')); ?>">Publique seu livro</a>
            </p>
        </div>
    </section>

    <?php if ($lancamentos) : ?>
    <section class="secao secao-inversa no-inverso">
        <div class="wrap">
            <h2 class="secao-titulo">Lançamentos</h2>
            <div class="grade-lancamentos">
                <?php foreach ($lancamentos as $h) : ?>
                    <a class="lancamento" href="<?php echo esc_url(CJ_Hotsites::url($h->ID)); ?>">
                        <?php echo get_the_post_thumbnail($h->ID, 'large', ['loading' => 'lazy']); ?>
                        <span class="lancamento-texto">
                            <strong><?php echo esc_html(get_the_title($h)); ?></strong>
                            <?php if ($h->post_excerpt) : ?><span><?php echo esc_html($h->post_excerpt); ?></span><?php endif; ?>
                            <span class="seta">Conhecer a obra →</span>
                        </span>
                    </a>
                <?php endforeach; ?>
            </div>
        </div>
    </section>
    <?php endif; ?>

    <?php if ($destaques->have_posts()) : ?>
    <section class="secao">
        <div class="wrap">
            <div class="secao-cabeca">
                <h2 class="secao-titulo">Catálogo</h2>
                <a href="<?php echo esc_url(get_post_type_archive_link('cj_livro')); ?>">Todos os livros →</a>
            </div>
            <div class="grade-livros">
                <?php while ($destaques->have_posts()) : $destaques->the_post(); get_template_part('template-parts/card-livro'); endwhile; wp_reset_postdata(); ?>
            </div>
        </div>
    </section>
    <?php endif; ?>

    <?php while (have_posts()) : the_post(); if (trim(get_the_content()) !== '') : ?>
    <section class="secao secao-papel">
        <div class="wrap conteudo"><?php the_content(); ?></div>
    </section>
    <?php endif; endwhile; ?>

    <section class="secao">
        <div class="wrap duas-colunas">
            <div>
                <h2 class="secao-titulo">Publique conosco</h2>
                <p>Recebemos originais de obras individuais e coletivas, teses, dissertações e coletâneas jurídicas. Conheça as etapas e envie sua proposta.</p>
                <p><a class="botao" href="<?php echo esc_url(home_url('/publique-seu-livro')); ?>">Como publicar</a>
                <?php if ($w = cj_whatsapp_url('Olá! Gostaria de informações sobre publicação de livro.')) : ?>
                    <a class="botao botao-linha" href="<?php echo esc_url($w); ?>" rel="noopener">Falar pelo WhatsApp</a>
                <?php endif; ?></p>
            </div>
            <div>
                <h2 class="secao-titulo">Revista Capital Jurídico</h2>
                <p><span class="selo selo-aviso">Periódico descontinuado</span> <span class="miudo">ISSN <?php echo esc_html(cj_opt('cj_issn')); ?></span></p>
                <p><?php echo esc_html(wp_trim_words(cj_opt('cj_aviso_revista'), 45, '…')); ?></p>
                <ul class="lista-simples">
                    <?php while ($artigos->have_posts()) : $artigos->the_post(); ?>
                        <li><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></li>
                    <?php endwhile; wp_reset_postdata(); ?>
                </ul>
                <p><a class="botao botao-linha" href="<?php echo esc_url(home_url('/numerosanteriores')); ?>">Acessar o acervo da revista</a></p>
            </div>
        </div>
    </section>
</main>
<?php get_footer();
