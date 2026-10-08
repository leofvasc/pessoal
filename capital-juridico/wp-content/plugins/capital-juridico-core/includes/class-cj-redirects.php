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
            '#^/profile/.+$#'                                  => '/blog',
            '#^/blog/categories/?$#'                           => '/blog',
            '#^/blog/hashtags/?$#'                             => '/blog',
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
        // Artigo com slug alterado na importação: o importador registra o slug do Wix.
        if (preg_match('#^/post/([^/]+)/?$#', $path, $m)) {
            $found = get_posts([
                'post_type' => 'post', 'post_status' => 'publish', 'numberposts' => 1, 'fields' => 'ids',
                'meta_key' => '_cj_slug_wix', 'meta_value' => rawurldecode($m[1]),
            ]);
            if ($found) {
                self::go(get_permalink($found[0]));
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
