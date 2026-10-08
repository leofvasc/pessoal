<?php
/**
 * Redirecionamentos 301 e registro de páginas não encontradas (404).
 *
 * Cobre os formatos de endereço do Wix que não existem no WordPress e permite
 * cadastrar redirecionamentos manuais em Configurações → Capital Jurídico.
 * O registro de 404 mostra, depois da migração, quais endereços antigos ainda
 * recebem visitas e precisam de redirecionamento.
 */

if (!defined('ABSPATH')) {
    exit;
}

class CJ_Redirects
{
    private const LIMITE_LOG = 300;

    public static function init(): void
    {
        add_action('template_redirect', [__CLASS__, 'handle'], 5);
        add_action('parse_request', [__CLASS__, 'sitemap'], 0);
        add_action('plugins_loaded', [__CLASS__, 'dominio_antigo'], 0);
        add_filter('request', [__CLASS__, 'normalizar_termos']);
    }

    /**
     * Categorias e tags com acento (/artigos/categories/direito-público): o slug é
     * gravado codificado (direito-p%c3%bablico), mas o endereço pode chegar decodificado.
     */
    public static function normalizar_termos(array $vars): array
    {
        foreach (['category_name', 'tag'] as $k) {
            if (!empty($vars[$k]) && preg_match('/[^\x20-\x7E]|%[0-9A-F]{2}/', $vars[$k])) {
                $vars[$k] = implode('/', array_map(
                    fn($p) => sanitize_title_with_dashes(rawurldecode($p), '', 'save'),
                    explode('/', $vars[$k])
                ));
            }
        }
        return $vars;
    }

    /**
     * Domínio antigo → domínio principal, preservando caminho e parâmetros:
     * revistacapitaljuridico.com.br/post/x → capitaljur.com.br/post/x (301).
     * Também unifica www e sem www do domínio principal.
     */
    public static function dominio_antigo(): void
    {
        if ((defined('WP_CLI') && WP_CLI) || wp_doing_cron() || empty($_SERVER['HTTP_HOST'])) {
            return;
        }
        $host     = strtolower(preg_replace('/:\d+$/', '', (string) $_SERVER['HTTP_HOST']));
        $home     = (string) home_url('/');
        $principal = strtolower((string) wp_parse_url($home, PHP_URL_HOST));
        if ($host === '' || $host === $principal) {
            return;
        }
        $antigos = array_filter(array_map(fn($d) => strtolower(trim($d)), preg_split('/\R/', CJ_Settings::get('cj_dominios_antigos'))));
        $variante = $host === 'www.' . $principal || $principal === 'www.' . $host;
        if (!$variante && !in_array($host, $antigos, true)) {
            return;
        }
        $porta = wp_parse_url($home, PHP_URL_PORT);
        $base  = wp_parse_url($home, PHP_URL_SCHEME) . '://' . $principal . ($porta ? ':' . $porta : '');
        header('Cache-Control: max-age=86400');
        wp_redirect($base . ($_SERVER['REQUEST_URI'] ?? '/'), 301, 'Capital Juridico');
        exit;
    }

    /** O sitemap do Wix ficava em /sitemap.xml; o do WordPress fica em /wp-sitemap.xml. */
    public static function sitemap(): void
    {
        $path = (string) strtok((string) ($_SERVER['REQUEST_URI'] ?? ''), '?');
        $home = rtrim((string) wp_parse_url(home_url('/'), PHP_URL_PATH), '/');
        if (in_array($path, [$home . '/sitemap.xml', $home . '/sitemap_index.xml'], true)) {
            wp_redirect(home_url('/wp-sitemap.xml'), 301, 'Capital Juridico');
            exit;
        }
    }

    /** Regras automáticas para padrões de URL do Wix (expressão => destino). */
    private static function patterns(): array
    {
        return [
            '#^/single-post/(?:\d{4}/\d{2}/\d{2}/)?([^/]+)/?$#' => '/post/$1',
            '#^/blog-feed\.xml$#'                              => '/feed',
            '#^/feed\.xml$#'                                   => '/feed',
            '#^/post/([^/]+)/amp/?$#'                          => '/post/$1',
            '#^/profile/.+$#'                                  => '/artigos',
            '#^/blog/?$#'                                      => '/artigos',
            '#^/blog/categories/(.+)$#'                        => '/artigos/categories/$1',
            '#^/blog/(?:hashtags|tags)/(.+)$#'                 => '/artigos/tags/$1',
            '#^/artigos/hashtags/(.+)$#'                       => '/artigos/tags/$1',
            '#^/artigos/(?:categories|tags|hashtags)/?$#'      => '/artigos',
            '#^/(?:blank|copy-of-[^/]+)/?$#'                   => '/',
        ];
    }

    /** Redirecionamentos manuais: uma linha por regra, "origem destino". */
    public static function manual(): array
    {
        $map = [];
        foreach (preg_split('/\R/', (string) get_option('cj_redirects', '')) as $line) {
            $parts = preg_split('/\s+/', trim($line));
            if (count($parts) >= 2 && str_starts_with($parts[0], '/')) {
                $map[self::normalize($parts[0])] = $parts[1];
            }
        }
        return $map;
    }

    private static function normalize(string $path): string
    {
        $path = strtolower(rawurldecode(strtok($path, '?')));
        return $path === '/' ? '/' : rtrim($path, '/');
    }

    public static function handle(): void
    {
        if (!is_404()) {
            return;
        }
        $uri  = (string) ($_SERVER['REQUEST_URI'] ?? '/');
        $home = (string) wp_parse_url(home_url('/'), PHP_URL_PATH);
        $path = '/' . ltrim(substr(strtok($uri, '?'), strlen(rtrim($home, '/'))), '/');
        $key  = self::normalize($path);

        $manual = self::manual();
        if (isset($manual[$key])) {
            self::go($manual[$key]);
        }
        foreach (self::patterns() as $re => $dest) {
            if (preg_match($re, $path)) {
                self::go(preg_replace($re, $dest, $path));
            }
        }
        // Arquivos que o Wix servia no próprio domínio (/_files/ugd/…pdf): o importador
        // copiou cada um para a biblioteca de mídia e guardou o endereço de origem.
        if (str_starts_with($path, '/_files/')) {
            global $wpdb;
            $id = (int) $wpdb->get_var($wpdb->prepare(
                "SELECT post_id FROM $wpdb->postmeta WHERE meta_key = '_cj_origem' AND meta_value LIKE %s LIMIT 1",
                '%' . $wpdb->esc_like(rawurldecode($path)) . '%'
            ));
            if ($id && ($url = wp_get_attachment_url($id))) {
                self::go($url);
            }
        }
        // Artigo com slug alterado na importação: o importador registra o slug do Wix.
        if (preg_match('#^/post/([^/]+)/?$#', $path, $m)) {
            if ($found = CJ_Importador_Wix::post_por_slug_wix(rawurldecode($m[1]), 'publish')) {
                self::go(get_permalink($found));
            }
        }
        self::log($key);
    }

    private static function go(string $dest): void
    {
        $url = preg_match('#^https?://#', $dest) ? $dest : home_url($dest);
        wp_redirect($url, 301, 'Capital Juridico');
        exit;
    }

    private static function log(string $path): void
    {
        if (preg_match('#\.(?:php|env|js|css|map|png|jpe?g|gif|ico|txt)$|^/wp-#', $path)) {
            return; // ignora varreduras automáticas e arquivos estáticos
        }
        $log = (array) get_option('cj_404_log', []);
        $log[$path] = ['n' => ($log[$path]['n'] ?? 0) + 1, 't' => time()];
        if (count($log) > self::LIMITE_LOG) {
            uasort($log, fn($a, $b) => $b['t'] <=> $a['t']);
            $log = array_slice($log, 0, self::LIMITE_LOG, true);
        }
        update_option('cj_404_log', $log, false);
    }
}
