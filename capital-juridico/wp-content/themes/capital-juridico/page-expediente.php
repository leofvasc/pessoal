<?php
/**
 * Expediente da Revista Capital Jurídico (/numerosanteriores/expediente).
 * Os dados do quadro vêm de Configurações → Capital Jurídico; o texto abaixo
 * dele (conselho editorial, equipe, histórico) é editado na própria página.
 */
get_header();
$dados = array_filter([
    'Título'          => cj_opt('cj_titulo_periodico'),
    'ISSN'            => cj_opt('cj_issn'),
    'Situação'        => 'Descontinuada; não recebe novas submissões',
    'Período'         => cj_opt('cj_rev_periodo'),
    'Periodicidade'   => cj_opt('cj_rev_periodicidade'),
    'Local'           => cj_opt('cj_rev_local'),
    'Editor-chefe'    => cj_opt('cj_rev_editor'),
    'Editora'         => get_bloginfo('name'),
    'Mantenedora'     => cj_opt('cj_mantenedora') ? cj_opt('cj_mantenedora') . (cj_opt('cj_mantenedora_cnpj') ? ' (CNPJ ' . cj_opt('cj_mantenedora_cnpj') . ')' : '') : '',
    'Contato'         => cj_opt('cj_rev_email') ?: cj_opt('cj_email'),
]);
?>
<main id="conteudo">
    <?php get_template_part('template-parts/acervo-cabecalho'); ?>
    <div class="wrap pagina">
        <?php while (have_posts()) : the_post(); ?>
            <h1 class="pagina-titulo"><?php the_title(); ?></h1>
            <dl class="dados dados--expediente">
                <?php foreach ($dados as $k => $v) : ?><dt><?php echo esc_html($k); ?></dt><dd><?php echo esc_html($v); ?></dd><?php endforeach; ?>
            </dl>
            <div class="conteudo"><?php the_content(); ?></div>
        <?php endwhile; ?>
    </div>
</main>
<?php get_footer();
