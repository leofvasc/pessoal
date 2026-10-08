<?php
/** Lista de artigos (/blog), categorias (/blog/categories/…), hashtags e busca. */
get_header();
$no_acervo = is_home() || is_category() || is_tag() || is_tax('cj_edicao');
?>
<main id="conteudo">
<?php if ($no_acervo) {
    get_template_part('template-parts/acervo-cabecalho');
} ?>
<div class="wrap pagina">
    <h1 class="pagina-titulo"><?php
        if (is_search()) {
            printf('Resultados para “%s”', esc_html(get_search_query()));
        } elseif (is_archive()) {
            echo esc_html(single_term_title('', false) ?: post_type_archive_title('', false));
        } else {
            echo esc_html(get_the_title(get_option('page_for_posts')) ?: 'Artigos');
        }
    ?></h1>
    <?php if (is_tax('cj_edicao')) :
        $t = get_queried_object();
        $pdf = (int) get_term_meta($t->term_id, 'cj_pdf', true);
        $pdf = $pdf ? wp_get_attachment_url($pdf) : get_term_meta($t->term_id, 'cj_pdf_link', true);
        ?>
        <?php if ($periodo = get_term_meta($t->term_id, 'cj_periodo', true)) : ?><p class="artigo-autor"><?php echo esc_html(ucfirst($periodo)); ?> · ISSN <?php echo esc_html(cj_opt('cj_issn')); ?></p><?php endif; ?>
        <div class="conteudo"><?php echo wp_kses_post(term_description()); ?></div>
        <?php if ($pdf) : ?><p><a class="botao" href="<?php echo esc_url($pdf); ?>">Baixar a edição completa (PDF)</a></p><?php endif; ?>
    <?php elseif (is_archive()) : ?>
        <div class="conteudo"><?php echo wp_kses_post(term_description()); ?></div>
    <?php endif; ?>
    <?php get_search_form(); ?>
    <div class="lista-artigos">
        <?php if (have_posts()) : while (have_posts()) : the_post();
            get_post_type() === 'cj_livro' ? get_template_part('template-parts/card-livro') : get_template_part('template-parts/card-artigo');
        endwhile; else : ?>
            <p>Nada encontrado.</p>
        <?php endif; ?>
    </div>
    <?php the_posts_pagination(['prev_text' => '← Anteriores', 'next_text' => 'Próximos →']); ?>
</div>
</main>
<?php get_footer();
