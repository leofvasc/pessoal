<?php
/**
 * Cabeçalho comum a toda a área do acervo da Revista Capital Jurídico:
 * nome do periódico, ISSN, situação (descontinuado) e navegação interna.
 * O registro do ISSN exige que título, ISSN, expediente e normas estejam
 * acessíveis em todas as páginas do periódico.
 *
 * $args['completo'] = true na página principal do acervo (com o texto de apresentação).
 */
$completo = !empty($args['completo']);
$titulo   = cj_opt('cj_titulo_periodico');
$acervo   = home_url('/numerosanteriores');
$blog     = get_permalink((int) get_option('page_for_posts')) ?: home_url('/artigos');
$itens = [
    $acervo                                   => 'Números',
    $blog                                     => 'Artigos',
    home_url('/expediente')                   => 'Expediente',
    home_url('/publique')                     => 'Normas para publicação',
];
$atual = untrailingslashit((string) strtok((string) ($_SERVER['REQUEST_URI'] ?? ''), '?'));
?>
<section class="acervo-faixa<?php echo $completo ? ' acervo-faixa--completa' : ''; ?>" aria-label="<?php echo esc_attr($titulo); ?> — acervo histórico">
    <div class="wrap">
        <p class="sobretitulo">Acervo histórico · ISSN <?php echo esc_html(cj_opt('cj_issn')); ?></p>
        <?php if ($completo) : ?>
            <h1 class="acervo-titulo"><?php echo esc_html($titulo); ?></h1>
        <?php else : ?>
            <p class="acervo-titulo acervo-titulo--compacto"><a href="<?php echo esc_url($acervo); ?>"><?php echo esc_html($titulo); ?></a></p>
        <?php endif; ?>
        <p class="acervo-situacao">
            <span class="selo selo-aviso">Periódico descontinuado</span>
            <?php echo esc_html(implode(' · ', array_filter([
                cj_opt('cj_rev_periodo') ? 'Publicada de ' . cj_opt('cj_rev_periodo') : '',
                cj_opt('cj_rev_numeros') ? cj_opt('cj_rev_numeros') . ' números' : '',
                cj_opt('cj_rev_periodicidade'),
                cj_opt('cj_rev_local'),
            ]))); ?>
        </p>
        <?php if ($completo) : ?>
            <hr class="cj-rule cj-rule--double">
            <p class="acervo-texto"><?php echo esc_html(cj_opt('cj_aviso_revista')); ?></p>
        <?php endif; ?>
        <nav class="acervo-nav" aria-label="Acervo da revista">
            <?php foreach ($itens as $url => $label) :
                $path = untrailingslashit((string) wp_parse_url($url, PHP_URL_PATH));
                $cur  = $atual === $path; ?>
                <a href="<?php echo esc_url($url); ?>"<?php echo $cur ? ' aria-current="page"' : ''; ?>><?php echo esc_html($label); ?></a>
            <?php endforeach; ?>
        </nav>
    </div>
</section>
