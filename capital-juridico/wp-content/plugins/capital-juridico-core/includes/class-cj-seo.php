<?php
/**
 * SEO próprio do site: título, descrição, imagem de compartilhamento,
 * canonical, indexação e dados estruturados (JSON-LD) por página.
 *
 * Os valores importados do Wix são gravados nestes mesmos campos, de modo que
 * cada artigo mantém o título e a descrição que já tinha no Google.
 * Se um plugin de SEO (Yoast, Rank Math, AIOSEO, SEOPress) for ativado, este
 * módulo deixa de imprimir as tags para não duplicá-las.
 */

if (!defined('ABSPATH')) {
    exit;
}

class CJ_SEO
{
    private const TIPOS = ['post', 'page', 'cj_livro', 'cj_hotsite'];

    public static function init(): void
    {
        add_action('add_meta_boxes', [__CLASS__, 'meta_box']);
        foreach (self::TIPOS as $t) {
            add_action('save_post_' . $t, [__CLASS__, 'save'], 20, 1);
        }
        add_action('wp', [__CLASS__, 'setup_front']);
        add_filter('wp_sitemaps_add_provider', [__CLASS__, 'sitemap_filter'], 10, 2);
        add_filter('wp_sitemaps_posts_query_args', [__CLASS__, 'sitemap_exclude_noindex'], 10, 2);
        add_action('init', [__CLASS__, 'register_sitemap_provider']);
    }

    public static function plugin_ativo(): bool
    {
        return defined('WPSEO_VERSION') || defined('RANK_MATH_VERSION') || defined('AIOSEO_VERSION') || defined('SEOPRESS_VERSION');
    }

    public static function fields(): array
    {
        return [
            ['key' => '_cj_seo_title', 'label' => 'Título para o Google', 'help' => 'Até ~60 caracteres. Em branco: título da página + nome do site.'],
            ['key' => '_cj_seo_desc', 'label' => 'Descrição', 'type' => 'textarea', 'rows' => 3, 'help' => 'Até ~155 caracteres. Aparece no resultado de busca e no compartilhamento.'],
            ['key' => '_cj_seo_image', 'label' => 'Imagem de compartilhamento', 'type' => 'media', 'help' => 'Ideal: 1200 × 630 px. Em branco: imagem destacada.'],
            ['key' => '_cj_seo_canonical', 'label' => 'URL canônica', 'type' => 'url', 'help' => 'Deixe em branco, salvo se este conteúdo tiver uma versão principal em outro endereço.'],
            ['key' => '_cj_seo_noindex', 'label' => 'Indexação', 'type' => 'checkbox', 'checkbox_label' => 'Não indexar esta página (noindex)'],
            ['key' => '_cj_seo_jsonld', 'label' => 'Dados estruturados extras (JSON-LD)', 'type' => 'code', 'rows' => 4, 'help' => 'Opcional. Cole apenas o JSON, sem a tag &lt;script&gt;.'],
        ];
    }

    public static function meta_box(): void
    {
        foreach (self::TIPOS as $t) {
            add_meta_box('cj_seo', 'SEO e compartilhamento', function (WP_Post $post) {
                wp_nonce_field('cj_seo', 'cj_seo_nonce');
                echo '<table class="form-table" role="presentation">';
                foreach (self::fields() as $f) {
                    cj_field($f, get_post_meta($post->ID, $f['key'], true));
                }
                echo '</table>';
            }, $t, 'normal', 'low');
        }
    }

    public static function save(int $post_id): void
    {
        if (cj_can_save($post_id, 'cj_seo')) {
            cj_save_fields($post_id, self::fields());
        }
    }

    /* ------------------------------------------------------------------ */
    /* Saída no <head>                                                     */
    /* ------------------------------------------------------------------ */

    public static function setup_front(): void
    {
        if (is_admin() || self::plugin_ativo()) {
            return;
        }
        remove_action('wp_head', 'rel_canonical');
        add_filter('pre_get_document_title', [__CLASS__, 'document_title'], 20);
        add_action('wp_head', function () {
            echo self::head_tags(0, false, false); // phpcs:ignore -- escapado em head_tags.
        }, 2);
    }

    private static function current_id(): int
    {
        $id = (int) apply_filters('cj_seo_post_id', 0);
        if ($id) {
            return $id;
        }
        if (is_front_page()) {
            return (int) get_option('page_on_front');
        }
        if (is_home()) {
            return (int) get_option('page_for_posts');
        }
        return is_singular() ? (int) get_queried_object_id() : 0;
    }

    public static function document_title(string $title): string
    {
        $id = self::current_id();
        $t  = $id ? (string) get_post_meta($id, '_cj_seo_title', true) : '';
        return $t !== '' ? $t : $title;
    }

    /** Dados de SEO resolvidos para a página atual (ou para um post específico). */
    public static function data(int $id = 0): array
    {
        $id = $id ?: self::current_id();
        $site = get_bloginfo('name');
        $d = ['title' => '', 'desc' => '', 'image' => '', 'url' => '', 'noindex' => false, 'type' => 'website', 'jsonld' => ''];

        if ($id) {
            $post = get_post($id);
            $d['title']   = (string) get_post_meta($id, '_cj_seo_title', true) ?: (get_the_title($id) . ' — ' . $site);
            $d['desc']    = (string) get_post_meta($id, '_cj_seo_desc', true) ?: wp_trim_words(wp_strip_all_tags($post->post_excerpt ?: strip_shortcodes($post->post_content)), 28, '…');
            $img          = (int) get_post_meta($id, '_cj_seo_image', true) ?: (int) get_post_thumbnail_id($id);
            $d['image']   = $img ? (string) wp_get_attachment_image_url($img, 'large') : '';
            $d['url']     = (string) get_post_meta($id, '_cj_seo_canonical', true) ?: (string) get_permalink($id);
            $d['noindex'] = (bool) get_post_meta($id, '_cj_seo_noindex', true);
            $d['type']    = $post->post_type === 'post' ? 'article' : ($post->post_type === 'cj_livro' ? 'book' : 'website');
            $d['jsonld']  = trim((string) get_post_meta($id, '_cj_seo_jsonld', true));
            if (is_front_page() && $id === (int) get_option('page_on_front')) {
                $d['url'] = home_url('/');
            }
            if (is_home() && $id === (int) get_option('page_for_posts') && is_paged()) {
                $d['url'] = get_pagenum_link(get_query_var('paged'));
            }
        } elseif (is_category() || is_tag() || is_tax()) {
            $term = get_queried_object();
            $d['title'] = $term->name . ' — ' . $site;
            $d['desc']  = wp_trim_words(wp_strip_all_tags(term_description($term)), 28, '…');
            $d['url']   = (string) get_term_link($term);
            if ($term->taxonomy === 'cj_edicao' && ($capa = (int) get_term_meta($term->term_id, 'cj_capa', true))) {
                $d['image'] = (string) wp_get_attachment_image_url($capa, 'large');
            }
        } elseif (is_post_type_archive('cj_livro')) {
            $d['title'] = 'Catálogo de livros — ' . $site;
            $d['desc']  = (string) get_option('cj_catalogo_desc', 'Catálogo de livros jurídicos da Editora Capital Jurídico: obras gratuitas para download, à venda e esgotadas.');
            $d['url']   = (string) get_post_type_archive_link('cj_livro');
        } elseif (is_search() || is_404()) {
            $d['noindex'] = true;
        }
        if ($d['image'] === '' && ($fallback = (int) get_option('cj_og_padrao'))) {
            $d['image'] = (string) wp_get_attachment_image_url($fallback, 'large');
        }
        return $d;
    }

    /**
     * Tags de SEO prontas para o <head>.
     *
     * @param bool $with_title inclui <title> (páginas de hotsite, que não passam pelo tema).
     */
    public static function head_tags(int $id, bool $preview = false, bool $with_title = true): string
    {
        $d = self::data($id);
        $o = '';
        if ($with_title && $d['title'] !== '') {
            $o .= '<title>' . esc_html($d['title']) . "</title>\n";
        }
        if ($d['desc'] !== '') {
            $o .= '<meta name="description" content="' . esc_attr($d['desc']) . "\">\n";
        }
        if ($d['noindex'] || $preview) {
            $o .= "<meta name=\"robots\" content=\"noindex, nofollow\">\n";
        } elseif ($d['url'] !== '') {
            $o .= '<link rel="canonical" href="' . esc_url($d['url']) . "\">\n";
        }
        $og = [
            'og:locale'      => 'pt_BR',
            'og:site_name'   => get_bloginfo('name'),
            'og:type'        => $d['type'] === 'book' ? 'book' : $d['type'],
            'og:title'       => $d['title'],
            'og:description' => $d['desc'],
            'og:url'         => $d['url'],
            'og:image'       => $d['image'],
        ];
        foreach ($og as $k => $v) {
            if ($v !== '') {
                $o .= '<meta property="' . esc_attr($k) . '" content="' . esc_attr($v) . "\">\n";
            }
        }
        $o .= '<meta name="twitter:card" content="' . ($d['image'] ? 'summary_large_image' : 'summary') . "\">\n";

        foreach (self::jsonld($id ?: self::current_id(), $d) as $graph) {
            $o .= '<script type="application/ld+json">' . wp_json_encode($graph, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "</script>\n";
        }
        if ($d['jsonld'] !== '' && json_decode($d['jsonld']) !== null) {
            $o .= '<script type="application/ld+json">' . str_ireplace('</script', '<\/script', $d['jsonld']) . "</script>\n";
        }
        return $o;
    }

    private static function jsonld(int $id, array $d): array
    {
        $org = [
            '@type' => 'Organization',
            '@id'   => home_url('/#editora'),
            'name'  => get_bloginfo('name'),
            'url'   => home_url('/'),
        ];
        if ($logo = get_site_icon_url(512)) {
            $org['logo'] = $logo;
        }
        if (is_front_page()) {
            return [array_merge(['@context' => 'https://schema.org'], $org, ['@type' => ['Organization', 'Publisher']]), [
                '@context' => 'https://schema.org', '@type' => 'WebSite', 'name' => get_bloginfo('name'), 'url' => home_url('/'),
                'potentialAction' => ['@type' => 'SearchAction', 'target' => home_url('/?s={busca}'), 'query-input' => 'required name=busca'],
            ]];
        }
        if (!$id) {
            return [];
        }
        $post = get_post($id);
        if ($post->post_type === 'post') {
            $autor = get_post_meta($id, '_cj_autor_artigo', true) ?: get_the_author_meta('display_name', (int) $post->post_author);
            $g = [
                '@context'      => 'https://schema.org',
                '@type'         => 'ScholarlyArticle',
                'headline'      => wp_strip_all_tags(get_the_title($id)),
                'description'   => $d['desc'],
                'datePublished' => get_the_date('c', $id),
                'dateModified'  => get_the_modified_date('c', $id),
                'mainEntityOfPage' => $d['url'],
                'author'        => array_map(fn($n) => ['@type' => 'Person', 'name' => trim($n)], preg_split('/\s*[;,]\s*|\s+e\s+/u', $autor)),
                'publisher'     => $org,
                'inLanguage'    => 'pt-BR',
            ];
            $edicoes = get_the_terms($id, 'cj_edicao');
            if ($edicoes && !is_wp_error($edicoes)) {
                $g['isPartOf'] = ['@type' => 'PublicationIssue', 'name' => $edicoes[0]->name, 'isPartOf' => ['@type' => 'Periodical', 'name' => CJ_Settings::get('cj_titulo_periodico'), 'issn' => CJ_Settings::get('cj_issn')]];
            }
            if ($d['image']) {
                $g['image'] = $d['image'];
            }
            return [$g];
        }
        if ($post->post_type === 'cj_livro') {
            $g = [
                '@context'  => 'https://schema.org',
                '@type'     => 'Book',
                'name'      => wp_strip_all_tags(get_the_title($id)),
                'url'       => $d['url'],
                'description' => $d['desc'],
                'publisher' => $org,
                'inLanguage' => 'pt-BR',
            ];
            if ($a = get_post_meta($id, '_cj_autores', true)) {
                $g['author'] = array_map(fn($n) => ['@type' => 'Person', 'name' => trim($n)], explode(';', $a));
            }
            if ($o = get_post_meta($id, '_cj_organizadores', true)) {
                $g['editor'] = array_map(fn($n) => ['@type' => 'Person', 'name' => trim($n)], explode(';', $o));
            }
            if ($ano = get_post_meta($id, '_cj_ano', true)) {
                $g['datePublished'] = (string) $ano;
            }
            if ($isbn = get_post_meta($id, '_cj_isbn_impresso', true) ?: get_post_meta($id, '_cj_isbn_digital', true)) {
                $g['isbn'] = $isbn;
            }
            if ($d['image']) {
                $g['image'] = $d['image'];
            }
            return [$g];
        }
        return [];
    }

    /* ------------------------------------------------------------------ */
    /* Sitemap (núcleo do WordPress: /wp-sitemap.xml; /sitemap.xml redireciona) */
    /* ------------------------------------------------------------------ */

    public static function sitemap_filter($provider, string $name)
    {
        return $name === 'users' ? false : $provider;
    }

    public static function sitemap_exclude_noindex(array $args, string $post_type): array
    {
        $args['meta_query'] = [
            'relation' => 'OR',
            ['key' => '_cj_seo_noindex', 'compare' => 'NOT EXISTS'],
            ['key' => '_cj_seo_noindex', 'value' => '1', 'compare' => '!='],
        ];
        return $args;
    }

    public static function register_sitemap_provider(): void
    {
        if (!function_exists('wp_register_sitemap_provider') || !class_exists('WP_Sitemaps_Provider')) {
            return;
        }
        require_once CJ_CORE_DIR . 'includes/class-cj-sitemap-hotsites.php';
        wp_register_sitemap_provider('hotsites', new CJ_Sitemap_Hotsites());
    }
}
