<?php
/**
 * Tema Capital Jurídico. Toda a parte de dados (livros, edições, hotsites,
 * SEO) está no plugin "Capital Jurídico — Núcleo"; o tema só apresenta.
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('after_setup_theme', function () {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('custom-logo', ['height' => 80, 'width' => 280, 'flex-width' => true, 'flex-height' => true]);
    add_theme_support('html5', ['search-form', 'gallery', 'caption', 'style', 'script']);
    add_theme_support('responsive-embeds');
    add_theme_support('editor-styles');
    add_theme_support('align-wide');
    add_image_size('cj-capa', 480, 680, false);
    register_nav_menus([
        'principal' => 'Menu principal',
        'rodape'    => 'Menu do rodapé',
    ]);
});

add_action('wp_enqueue_scripts', function () {
    $v = wp_get_theme()->get('Version');
    wp_enqueue_style('cj-main', get_template_directory_uri() . '/assets/css/main.css', [], $v);
    wp_enqueue_script('cj-menu', get_template_directory_uri() . '/assets/menu.js', [], $v, ['strategy' => 'defer', 'in_footer' => true]);
});

add_action('admin_notices', function () {
    if (!class_exists('CJ_Livros')) {
        echo '<div class="notice notice-error"><p>O tema Capital Jurídico precisa do plugin <strong>Capital Jurídico — Núcleo</strong> ativo.</p></div>';
    }
});

/** Opção institucional com valor padrão (definida no plugin). */
function cj_opt(string $key): string
{
    return class_exists('CJ_Settings') ? CJ_Settings::get($key) : (string) get_option($key, '');
}

/** Menu padrão enquanto nenhum for montado em Aparência → Menus. */
function cj_menu_padrao(): void
{
    $itens = [
        home_url('/livros')            => 'Catálogo',
        home_url('/lancamentos')       => 'Lançamentos',
        home_url('/publique-seu-livro') => 'Publique',
        home_url('/numerosanteriores') => 'Revista (acervo)',
        home_url('/sobre')             => 'Sobre',
    ];
    $atual = untrailingslashit((string) strtok((string) ($_SERVER['REQUEST_URI'] ?? ''), '?'));
    echo '<ul class="menu">';
    foreach ($itens as $url => $label) {
        $path = untrailingslashit((string) wp_parse_url($url, PHP_URL_PATH));
        $cur  = $atual !== '' && ($atual === $path || str_starts_with($atual, $path . '/'));
        echo '<li><a href="' . esc_url($url) . '"' . ($cur ? ' aria-current="page"' : '') . '>' . esc_html($label) . '</a></li>';
    }
    echo '<li><a href="' . esc_url(home_url('/contato')) . '">Contato</a></li>';
    echo '</ul>';
}

/** Autoria de um artigo (campo importado do Wix ou usuário do WordPress). */
function cj_autoria(int $post_id = 0): string
{
    $post_id = $post_id ?: get_the_ID();
    return get_post_meta($post_id, '_cj_autor_artigo', true) ?: get_the_author_meta('display_name', (int) get_post_field('post_author', $post_id));
}

/** Data em português, independente do idioma do painel: "8 de outubro de 2026" ou, abreviada (ABNT), "8 out. 2026". */
function cj_data(int $timestamp, bool $abnt = false): string
{
    $meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    $abrev = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
    $d = (int) wp_date('j', $timestamp);
    $m = (int) wp_date('n', $timestamp) - 1;
    $a = wp_date('Y', $timestamp);
    return $abnt ? "$d {$abrev[$m]} $a" : "$d de {$meses[$m]} de $a";
}

/** "Fulano de Tal; Beltrana Silva" → "TAL, Fulano de; SILVA, Beltrana" (entrada da ABNT NBR 6023). */
function cj_autores_abnt(string $autores): string
{
    $saida = [];
    foreach (preg_split('/\s*;\s*/u', trim($autores)) as $nome) {
        $partes = preg_split('/\s+/u', trim($nome));
        if (!$partes || $partes[0] === '') {
            continue;
        }
        $sobrenome = array_pop($partes);
        // Sobrenomes compostos com indicação de parentesco: "Silva Júnior", "Souza Neto".
        if ($partes && preg_match('/^(J[úu]nior|Filho|Filha|Neto|Neta|Sobrinho)$/iu', $sobrenome)) {
            $sobrenome = array_pop($partes) . ' ' . $sobrenome;
        }
        $saida[] = mb_strtoupper($sobrenome) . ($partes ? ', ' . implode(' ', $partes) : '');
    }
    return implode('; ', $saida);
}

/**
 * Autoria resumida para os cartões do catálogo. Obra com organização mostra os
 * organizadores; com mais de três nomes, mostra os três primeiros e "et al.".
 * A página do livro continua exibindo a lista completa.
 */
function cj_autoria_curta(int $post_id): string
{
    $org = trim((string) get_post_meta($post_id, '_cj_organizadores', true));
    $lista = $org !== '' ? $org : trim((string) get_post_meta($post_id, '_cj_autores', true));
    $nomes = array_values(array_filter(array_map('trim', preg_split('/\s*[;,]\s*|\s+e\s+(?=[A-ZÀ-Ý])/u', $lista))));
    if (!$nomes) {
        return '';
    }
    $texto = count($nomes) > 3 ? implode(', ', array_slice($nomes, 0, 3)) . ' et al.' : implode(', ', $nomes);
    return ($org !== '' ? (count($nomes) > 1 ? 'Orgs.: ' : 'Org.: ') : '') . $texto;
}

/** Referência ABNT do artigo; o campo "Referência (ABNT)" do painel, se preenchido, prevalece. */
function cj_referencia_artigo(int $post_id): string
{
    $manual = trim((string) get_post_meta($post_id, '_cj_referencia', true));
    if ($manual !== '') {
        return wp_kses($manual, ['em' => [], 'i' => [], 'strong' => [], 'b' => []]);
    }
    $titulo = wp_strip_all_tags(get_the_title($post_id));
    $titulo .= preg_match('/[.?!]$/u', $titulo) ? '' : '.';
    $ed = get_the_terms($post_id, 'cj_edicao');
    $numero = ($ed && !is_wp_error($ed)) ? (int) get_term_meta($ed[0]->term_id, 'cj_numero', true) : 0;
    $local = trim(explode(',', cj_opt('cj_endereco'))[0]) ?: 'Rio Branco';
    $partes = [
        esc_html(cj_autores_abnt(cj_autoria($post_id))) . '. ' . esc_html($titulo) . ' <em>' . esc_html(cj_opt('cj_titulo_periodico')) . '</em>',
        esc_html($local),
    ];
    if ($numero) {
        $partes[] = 'n. ' . $numero;
    }
    $partes[] = esc_html(get_the_date('Y', $post_id)) . '. ISSN ' . esc_html(cj_opt('cj_issn'));
    return implode(', ', $partes) . '. Disponível em: ' . esc_html(get_permalink($post_id)) . '. Acesso em: ' . esc_html(cj_data(time(), true)) . '.';
}

/** "A Capital Jurídico é mantida pelo Instituto …, CNPJ …" com link para o site da mantenedora. */
function cj_mantenedora_html(): string
{
    $nome = cj_opt('cj_mantenedora');
    if ($nome === '') {
        return '';
    }
    $url  = cj_opt('cj_mantenedora_url');
    $cnpj = cj_opt('cj_mantenedora_cnpj');
    $link = $url ? '<a href="' . esc_url($url) . '" rel="noopener">' . esc_html($nome) . '</a>' : esc_html($nome);
    return 'A Editora ' . esc_html(get_bloginfo('name')) . ' é mantida pelo ' . $link . ($cnpj ? ', CNPJ ' . esc_html($cnpj) : '') . '.';
}

/** Link de WhatsApp a partir da configuração. */
function cj_whatsapp_url(string $texto = ''): string
{
    $n = preg_replace('/\D/', '', cj_opt('cj_whatsapp'));
    return $n ? 'https://wa.me/' . $n . ($texto ? '?text=' . rawurlencode($texto) : '') : '';
}

add_action('after_switch_theme', 'flush_rewrite_rules');
