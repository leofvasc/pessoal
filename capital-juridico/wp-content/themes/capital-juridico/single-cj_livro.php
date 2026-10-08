<?php
/** Ficha do livro: /livros/slug. */
get_header();
?>
<main id="conteudo" class="wrap pagina">
    <?php while (have_posts()) : the_post();
        $id = get_the_ID();
        $acoes = CJ_Livros::acoes($id);
        $hotsite = CJ_Livros::hotsite_url($id);
        $dados = array_filter([
            'Autoria'        => str_replace(';', ',', (string) get_post_meta($id, '_cj_autores', true)),
            'Organização'    => str_replace(';', ',', (string) get_post_meta($id, '_cj_organizadores', true)),
            'Edição'         => get_post_meta($id, '_cj_edicao_livro', true),
            'Ano'            => get_post_meta($id, '_cj_ano', true),
            'Páginas'        => get_post_meta($id, '_cj_paginas', true),
            'ISBN impresso'  => get_post_meta($id, '_cj_isbn_impresso', true),
            'ISBN digital'   => get_post_meta($id, '_cj_isbn_digital', true),
            'DOI'            => get_post_meta($id, '_cj_doi', true),
        ]);
        ?>
        <div class="livro-ficha">
            <div class="livro-ficha-capa"><?php if (has_post_thumbnail()) : the_post_thumbnail('large'); else : ?><span class="capa-vazia"><?php the_title(); ?></span><?php endif; ?></div>
            <div>
                <p class="sobretitulo"><a href="<?php echo esc_url(get_post_type_archive_link('cj_livro')); ?>">Catálogo</a></p>
                <h1 class="pagina-titulo"><?php the_title(); ?></h1>
                <?php if ($sub = get_post_meta($id, '_cj_subtitulo', true)) : ?><p class="subtitulo"><?php echo esc_html($sub); ?></p><?php endif; ?>
                <dl class="dados">
                    <?php foreach ($dados as $k => $v) : ?><dt><?php echo esc_html($k); ?></dt><dd><?php echo esc_html($v); ?></dd><?php endforeach; ?>
                </dl>
                <div class="acoes-livro">
                    <?php foreach ($acoes as $ac) :
                        if ($ac['tipo'] === 'aviso' || !$ac['url']) : ?>
                            <span class="selo selo-aviso"><?php echo esc_html($ac['label']); ?></span>
                        <?php else : ?>
                            <a class="botao<?php echo $ac['tipo'] === 'compra' ? ' botao-linha' : ''; ?>" href="<?php echo esc_url($ac['url']); ?>"<?php echo $ac['tipo'] === 'download' ? ' download' : ' rel="noopener"'; ?>><?php echo esc_html($ac['label']); ?></a>
                        <?php endif;
                    endforeach; ?>
                    <?php if ($hotsite) : ?><a class="botao botao-linha" href="<?php echo esc_url($hotsite); ?>">Página de lançamento</a><?php endif; ?>
                </div>
                <div class="conteudo"><?php the_content(); ?></div>
            </div>
        </div>
    <?php endwhile; ?>
</main>
<?php get_footer();
