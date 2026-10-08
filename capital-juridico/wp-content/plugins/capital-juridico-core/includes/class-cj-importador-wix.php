<?php
/**
 * Importador do site antigo (Wix).
 *
 * Etapas, executadas pelo painel Ferramentas → Importar do Wix:
 *  1. Ler o sitemap do Wix e registrar todos os endereços.
 *  2. Importar, em pequenos lotes: cada /post/slug vira um artigo do WordPress
 *     com o MESMO slug, a mesma data, o mesmo título e a mesma descrição de SEO,
 *     com as imagens e PDFs copiados para a biblioteca de mídia. Das demais
 *     páginas são guardados os metadados de SEO (aplicados à página de mesmo
 *     endereço no WordPress, quando existir).
 *  3. Verificar: confere se cada endereço antigo responde no site novo.
 *  4. Baixar o relatório (CSV) para arquivamento.
 *
 * Rode a importação ANTES de apontar o domínio para a Hostinger, enquanto o
 * Wix ainda responde em www.revistacapitaljuridico.com.br.
 */

if (!defined('ABSPATH')) {
    exit;
}

class CJ_Importador_Wix
{
    private const LOTE = 2;
    private const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 CapitalJuridicoMigracao/1.0';

    /** Elementos do Wix que não fazem parte do texto do artigo. */
    private const HOOKS_DESCARTE = [
        'post-title', 'post-metadata', 'post-footer', 'post-social-actions', 'share-buttons', 'like-button',
        'post-main-actions', 'related-posts', 'recent-posts', 'post-categories-list', 'post-tags', 'tag-list',
        'post-header', 'more-button', 'comments', 'post-page-comments', 'post-stats', 'avatar',
    ];

    public static function init(): void
    {
        add_action('admin_menu', [__CLASS__, 'menu']);
        add_action('wp_ajax_cj_wix', [__CLASS__, 'ajax']);
        add_action('admin_post_cj_wix_csv', [__CLASS__, 'csv']);
    }

    public static function table(): string
    {
        global $wpdb;
        return $wpdb->prefix . 'cj_importacao';
    }

    public static function install_tables(): void
    {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $t = self::table();
        dbDelta("CREATE TABLE $t (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            url varchar(700) NOT NULL,
            path varchar(600) NOT NULL,
            tipo varchar(20) NOT NULL,
            lastmod varchar(40) NOT NULL DEFAULT '',
            status varchar(20) NOT NULL DEFAULT 'pendente',
            wp_id bigint(20) unsigned NOT NULL DEFAULT 0,
            metodo varchar(40) NOT NULL DEFAULT '',
            caracteres int(10) unsigned NOT NULL DEFAULT 0,
            imagens int(10) unsigned NOT NULL DEFAULT 0,
            seo_title text NULL,
            seo_desc text NULL,
            seo_image text NULL,
            robots varchar(100) NOT NULL DEFAULT '',
            mensagem text NULL,
            http_novo varchar(60) NOT NULL DEFAULT '',
            atualizado datetime NULL,
            PRIMARY KEY  (id),
            KEY path (path(191))
        ) {$wpdb->get_charset_collate()};");
    }

    /* ------------------------------------------------------------------ */
    /* Painel                                                              */
    /* ------------------------------------------------------------------ */

    public static function menu(): void
    {
        add_management_page('Importar do Wix', 'Importar do Wix', 'manage_options', 'cj-importar-wix', [__CLASS__, 'page']);
    }

    public static function page(): void
    {
        global $wpdb;
        self::install_tables();
        $t = self::table();
        $site = get_option('cj_wix_site', 'https://www.revistacapitaljuridico.com.br');
        $counts = $wpdb->get_results("SELECT tipo, status, COUNT(*) n FROM $t GROUP BY tipo, status", ARRAY_A);
        $rows = $wpdb->get_results("SELECT * FROM $t ORDER BY tipo DESC, path ASC LIMIT 1000", ARRAY_A);
        $nonce = wp_create_nonce('cj_wix');
        ?>
        <div class="wrap cj-import">
            <h1>Importar do site antigo (Wix)</h1>
            <p>Faça a importação <strong>antes</strong> de apontar o domínio para a Hostinger, enquanto o site do Wix ainda está no ar. Ela pode ser repetida: artigos já importados são atualizados, não duplicados.</p>
            <table class="form-table" role="presentation">
                <tr><th><label for="cj-site">Endereço do site no Wix</label></th>
                    <td><input type="url" id="cj-site" class="regular-text" value="<?php echo esc_attr($site); ?>">
                        <p class="description">Se o domínio já tiver sido transferido, use o endereço gratuito do Wix (ex.: https://usuario.wixsite.com/revista).</p></td></tr>
                <tr><th>Opções</th><td>
                    <label><input type="checkbox" id="cj-imagens" checked> Copiar imagens e PDFs para a biblioteca de mídia</label><br>
                    <label><input type="checkbox" id="cj-paginas" checked> Aplicar título e descrição de SEO às páginas de mesmo endereço</label><br>
                    <label><input type="checkbox" id="cj-rascunho"> Importar artigos como rascunho (para revisar antes de publicar)</label>
                </td></tr>
            </table>
            <p>
                <button class="button button-primary" data-acao="sitemap">1. Ler sitemap</button>
                <button class="button button-primary" data-acao="importar">2. Importar pendentes</button>
                <button class="button" data-acao="verificar">3. Verificar endereços no site novo</button>
                <a class="button" href="<?php echo esc_url(admin_url('admin-post.php?action=cj_wix_csv&_wpnonce=' . $nonce)); ?>">4. Baixar relatório (CSV)</a>
                <button class="button-link-delete" data-acao="refazer" style="margin-left:12px">Marcar tudo para reimportar</button>
            </p>
            <div id="cj-progresso" class="notice notice-info inline" style="display:none"><p></p></div>
            <h2>Situação</h2>
            <p><?php
            if (!$counts) {
                echo 'Nada registrado ainda.';
            }
            foreach ($counts as $c) {
                echo esc_html($c['tipo'] . ' · ' . $c['status'] . ': ' . $c['n']) . '<br>';
            }
            ?></p>
            <table class="widefat striped">
                <thead><tr><th>Endereço antigo</th><th>Tipo</th><th>Situação</th><th>Extração</th><th>No WordPress</th><th>Verificação</th><th>Observação</th></tr></thead>
                <tbody>
                <?php foreach ($rows as $r) : ?>
                    <tr>
                        <td><a href="<?php echo esc_url($r['url']); ?>" target="_blank" rel="noopener"><?php echo esc_html($r['path']); ?></a></td>
                        <td><?php echo esc_html($r['tipo']); ?></td>
                        <td><?php echo esc_html($r['status']); ?></td>
                        <td><?php echo $r['metodo'] ? esc_html($r['metodo'] . ' · ' . number_format_i18n((int) $r['caracteres']) . ' car. · ' . (int) $r['imagens'] . ' img') : ''; ?></td>
                        <td><?php echo $r['wp_id'] ? '<a href="' . esc_url(get_edit_post_link((int) $r['wp_id'])) . '">editar</a> · <a href="' . esc_url(get_permalink((int) $r['wp_id'])) . '" target="_blank">ver</a>' : ''; ?></td>
                        <td><?php echo esc_html($r['http_novo']); ?></td>
                        <td><?php echo esc_html((string) $r['mensagem']); ?></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <script>
        (function () {
            const nonce = <?php echo wp_json_encode($nonce); ?>;
            const box = document.getElementById('cj-progresso');
            const msg = box.querySelector('p');
            function opts() {
                return {
                    site: document.getElementById('cj-site').value,
                    imagens: document.getElementById('cj-imagens').checked ? 1 : 0,
                    paginas: document.getElementById('cj-paginas').checked ? 1 : 0,
                    rascunho: document.getElementById('cj-rascunho').checked ? 1 : 0,
                };
            }
            async function call(acao) {
                const body = new URLSearchParams({ action: 'cj_wix', acao, _wpnonce: nonce, ...opts() });
                const r = await fetch(ajaxurl, { method: 'POST', body });
                return r.json();
            }
            document.querySelectorAll('.cj-import [data-acao]').forEach(btn => btn.addEventListener('click', async e => {
                e.preventDefault();
                const acao = btn.dataset.acao;
                if (acao === 'refazer' && !confirm('Marcar todos os endereços para importar de novo?')) return;
                document.querySelectorAll('.cj-import [data-acao]').forEach(b => b.disabled = true);
                box.style.display = 'block';
                try {
                    let res;
                    do {
                        res = await call(acao);
                        msg.textContent = res.data && res.data.mensagem ? res.data.mensagem : 'Erro inesperado.';
                    } while (res.success && res.data.continuar);
                    if (res.success) setTimeout(() => location.reload(), 1200);
                } catch (err) {
                    msg.textContent = 'A conexão falhou. Clique de novo para continuar de onde parou.';
                }
                document.querySelectorAll('.cj-import [data-acao]').forEach(b => b.disabled = false);
            }));
        })();
        </script>
        <?php
    }

    public static function ajax(): void
    {
        if (!current_user_can('manage_options') || !check_ajax_referer('cj_wix', '_wpnonce', false)) {
            wp_send_json_error(['mensagem' => 'Sem permissão.']);
        }
        @set_time_limit(300);
        $site = untrailingslashit(esc_url_raw(wp_unslash($_POST['site'] ?? '')));
        if ($site) {
            update_option('cj_wix_site', $site, false);
        }
        $o = [
            'site'     => $site,
            'imagens'  => !empty($_POST['imagens']),
            'paginas'  => !empty($_POST['paginas']),
            'rascunho' => !empty($_POST['rascunho']),
        ];
        switch (sanitize_key($_POST['acao'] ?? '')) {
            case 'sitemap':
                wp_send_json_success(self::step_sitemap($o));
            case 'importar':
                wp_send_json_success(self::step_import($o));
            case 'verificar':
                wp_send_json_success(self::step_verify());
            case 'refazer':
                global $wpdb;
                $wpdb->query('UPDATE ' . self::table() . " SET status = 'pendente'");
                delete_option('cj_wix_final_idx');
                wp_send_json_success(['mensagem' => 'Todos os endereços voltaram para "pendente".']);
        }
        wp_send_json_error(['mensagem' => 'Ação desconhecida.']);
    }

    /* ------------------------------------------------------------------ */
    /* Etapa 1 — sitemap                                                   */
    /* ------------------------------------------------------------------ */

    /**
     * Baixa uma página do site antigo. O Wix responde 429 quando recebe muitas
     * requisições seguidas: nesse caso espera e tenta de novo.
     */
    private static function fetch(string $url, int $timeout = 30, bool $seguir = true): array
    {
        // Caminhos com acento (ex.: /post/a-evolução-…) precisam ir codificados.
        $url = preg_replace_callback('#[^\x21-\x7E]+#', fn($m) => rawurlencode($m[0]), $url);
        for ($tentativa = 0; $tentativa < 4; $tentativa++) {
            $r = wp_remote_get($url, ['timeout' => $timeout, 'redirection' => $seguir ? 5 : 0, 'user-agent' => self::UA, 'headers' => ['Accept-Language' => 'pt-BR,pt;q=0.9']]);
            if (is_wp_error($r)) {
                return ['code' => 0, 'body' => '', 'erro' => $r->get_error_message(), 'location' => ''];
            }
            $code = (int) wp_remote_retrieve_response_code($r);
            if ($code !== 429) {
                break;
            }
            sleep(8 + 8 * $tentativa);
        }
        return ['code' => $code, 'body' => (string) wp_remote_retrieve_body($r), 'erro' => '', 'location' => (string) wp_remote_retrieve_header($r, 'location')];
    }

    /** Dados da migração (números da revista, livros, destino de cada página), em migracao-wix.json. */
    public static function dados(): array
    {
        static $d = null;
        if ($d === null) {
            $d = json_decode((string) file_get_contents(__DIR__ . '/migracao-wix.json'), true) ?: [];
        }
        return $d;
    }

    private static function step_sitemap(array $o): array
    {
        global $wpdb;
        $t = self::table();
        // O índice de sitemaps do Wix pode omitir o dos posts do blog: ele é pedido diretamente.
        $fila = [$o['site'] . '/sitemap.xml', $o['site'] . '/blog-posts-sitemap.xml'];
        $vistos = [];
        $urls = [];
        while ($fila && count($vistos) < 60) {
            $sm = array_shift($fila);
            if (isset($vistos[$sm])) {
                continue;
            }
            $vistos[$sm] = true;
            $r = self::fetch($sm);
            if ($r['code'] !== 200) {
                if (count($vistos) === 1) {
                    return ['mensagem' => "Não foi possível ler $sm (HTTP {$r['code']} {$r['erro']})."];
                }
                continue;
            }
            $xml = @simplexml_load_string($r['body']);
            if (!$xml) {
                continue;
            }
            $xml->registerXPathNamespace('s', 'http://www.sitemaps.org/schemas/sitemap/0.9');
            foreach ($xml->xpath('//s:sitemap/s:loc') ?: [] as $loc) {
                $fila[] = trim((string) $loc);
            }
            foreach ($xml->xpath('//s:url') ?: [] as $u) {
                $loc = trim((string) $u->loc);
                $urls[$loc] = trim((string) $u->lastmod);
            }
        }
        $novos = 0;
        foreach ($urls as $loc => $lastmod) {
            $path = self::path_of($loc);
            $tipo = preg_match('#^/post/#', $path) ? 'artigo' : (preg_match('#^/(?:blog|artigos)/(categories|tags|hashtags)/#', $path) ? 'categoria' : 'pagina');
            $existe = $wpdb->get_var($wpdb->prepare("SELECT id FROM $t WHERE path = %s", $path));
            if ($existe) {
                $wpdb->update($t, ['url' => $loc, 'lastmod' => $lastmod], ['id' => $existe]);
            } else {
                $wpdb->insert($t, ['url' => $loc, 'path' => $path, 'tipo' => $tipo, 'lastmod' => $lastmod, 'status' => 'pendente']);
                $novos++;
            }
        }
        return ['mensagem' => sprintf('%d endereços encontrados em %d sitemaps (%d novos).', count($urls), count($vistos), $novos)];
    }

    private static function path_of(string $url): string
    {
        $p = (string) wp_parse_url($url, PHP_URL_PATH);
        return $p === '' ? '/' : $p;
    }

    /* ------------------------------------------------------------------ */
    /* Etapa 2 — importação                                                */
    /* ------------------------------------------------------------------ */

    private static function step_import(array $o): array
    {
        global $wpdb;
        $t = self::table();
        $rows = $wpdb->get_results("SELECT * FROM $t WHERE status = 'pendente' ORDER BY tipo = 'artigo' DESC, id ASC LIMIT " . self::LOTE, ARRAY_A);
        foreach ($rows as $row) {
            try {
                $res = $row['tipo'] === 'artigo' ? self::import_post($row, $o) : self::import_page($row, $o);
            } catch (Throwable $e) {
                $res = ['status' => 'erro', 'mensagem' => $e->getMessage()];
            }
            $res['atualizado'] = current_time('mysql');
            $wpdb->update($t, $res, ['id' => $row['id']]);
        }
        $restam = (int) $wpdb->get_var("SELECT COUNT(*) FROM $t WHERE status = 'pendente'");
        if ($restam > 0) {
            return ['continuar' => (bool) $rows, 'mensagem' => "Importando… faltam $restam endereços. Não feche esta página."];
        }
        return self::step_finalize($o);
    }

    private static function dom(string $html): DOMDocument
    {
        $doc = new DOMDocument();
        libxml_use_internal_errors(true);
        $doc->loadHTML('<?xml encoding="utf-8" ?>' . $html, LIBXML_NONET | LIBXML_COMPACT);
        libxml_clear_errors();
        return $doc;
    }

    /** Lê título, descrição, imagem, robots e JSON-LD do <head>. */
    private static function head_meta(DOMDocument $doc): array
    {
        $x = new DOMXPath($doc);
        $m = ['title' => '', 'desc' => '', 'og_title' => '', 'og_desc' => '', 'og_image' => '', 'robots' => '', 'published' => '', 'modified' => '', 'jsonld' => []];
        $title = $x->query('//title')->item(0);
        $m['title'] = $title ? trim($title->textContent) : '';
        foreach ($x->query('//meta') as $meta) {
            $k = strtolower($meta->getAttribute('name') ?: $meta->getAttribute('property'));
            $v = trim($meta->getAttribute('content'));
            match ($k) {
                'description'            => $m['desc'] = $v,
                'og:title'               => $m['og_title'] = $v,
                'og:description'         => $m['og_desc'] = $v,
                'og:image'               => $m['og_image'] = $m['og_image'] ?: $v,
                'robots'                 => $m['robots'] = $v,
                'article:published_time' => $m['published'] = $v,
                'article:modified_time'  => $m['modified'] = $v,
                default                  => null,
            };
        }
        foreach ($x->query('//script[@type="application/ld+json"]') as $s) {
            $j = json_decode(trim($s->textContent), true);
            if (!is_array($j)) {
                continue;
            }
            $items = isset($j['@graph']) ? $j['@graph'] : (array_is_list($j) ? $j : [$j]);
            foreach ($items as $it) {
                if (is_array($it)) {
                    $m['jsonld'][] = $it;
                }
            }
        }
        return $m;
    }

    private static function article_ld(array $jsonld): array
    {
        foreach ($jsonld as $it) {
            $type = (array) ($it['@type'] ?? []);
            if (array_intersect($type, ['BlogPosting', 'Article', 'NewsArticle', 'ScholarlyArticle'])) {
                return $it;
            }
        }
        return [];
    }

    /** Localiza o corpo do artigo no HTML do Wix, do seletor mais preciso ao mais genérico. */
    private static function find_body(DOMDocument $doc): array
    {
        $x = new DOMXPath($doc);
        $candidatos = [
            'post-description' => '//*[@data-hook="post-description"]',
            'content-viewer'   => '//*[@data-id="content-viewer"]',
            'rich-content'     => '//*[@data-id="rich-content-viewer"]',
            'ricos-viewer'     => '//*[@data-hook="ricos-viewer"]',
            'article'          => '//article',
        ];
        foreach ($candidatos as $nome => $q) {
            $nodes = $x->query($q);
            $best = null;
            foreach ($nodes as $n) {
                if (!$best || strlen($n->textContent) > strlen($best->textContent)) {
                    $best = $n;
                }
            }
            if ($best && mb_strlen(trim($best->textContent)) > 200) {
                return [$nome, $best];
            }
        }
        return ['', null];
    }

    /** Converte o HTML do Wix em HTML limpo e semântico. */
    private static function clean(DOMNode $node, DOMDocument $doc): string
    {
        $x = new DOMXPath($doc);
        foreach (['.//script', './/style', './/noscript', './/svg', './/button', './/form', './/nav', './/input', './/template'] as $q) {
            foreach (iterator_to_array($x->query($q, $node)) as $n) {
                $n->parentNode?->removeChild($n);
            }
        }
        foreach (iterator_to_array($x->query('.//*[@data-hook]', $node)) as $n) {
            if (in_array($n->getAttribute('data-hook'), self::HOOKS_DESCARTE, true)) {
                $n->parentNode?->removeChild($n);
            }
        }
        // Título repetido dentro do corpo.
        foreach (iterator_to_array($x->query('.//h1', $node)) as $n) {
            $n->parentNode?->removeChild($n);
        }
        // Imagens: a versão nítida do Wix fica em data-pin-media; o src costuma ser uma miniatura borrada.
        foreach (iterator_to_array($x->query('.//img', $node)) as $img) {
            $src = $img->getAttribute('data-pin-media') ?: $img->getAttribute('data-src') ?: $img->getAttribute('src');
            $img->setAttribute('src', self::wix_original($src));
        }
        // Vídeos incorporados viram link.
        foreach (iterator_to_array($x->query('.//iframe', $node)) as $f) {
            $src = $f->getAttribute('src');
            if ($src && preg_match('#youtube\.com|youtu\.be|vimeo\.com#', $src)) {
                $p = $doc->createElement('p');
                $p->appendChild($doc->createTextNode($src));
                $f->parentNode->replaceChild($p, $f);
            } else {
                $f->parentNode?->removeChild($f);
            }
        }

        $html = '';
        foreach ($node->childNodes as $child) {
            $html .= $doc->saveHTML($child);
        }
        $allowed = [
            'p' => [], 'br' => [], 'h2' => [], 'h3' => [], 'h4' => [], 'h5' => [], 'h6' => [],
            'strong' => [], 'b' => [], 'em' => [], 'i' => [], 'u' => [], 's' => [], 'sup' => [], 'sub' => [], 'mark' => [],
            'ul' => [], 'ol' => ['start' => true], 'li' => [], 'blockquote' => [], 'pre' => [], 'code' => [], 'hr' => [],
            'a' => ['href' => true], 'img' => ['src' => true, 'alt' => true],
            'figure' => [], 'figcaption' => [],
            'table' => [], 'thead' => [], 'tbody' => [], 'tr' => [], 'th' => ['colspan' => true, 'rowspan' => true], 'td' => ['colspan' => true, 'rowspan' => true],
        ];
        $html = wp_kses($html, $allowed);
        $html = preg_replace('#<p>(?:\s|&nbsp;|\xC2\xA0|<br\s*/?>)*</p>#u', '', $html);
        $html = preg_replace('#(\s*\n){3,}#', "\n\n", $html);
        return trim($html);
    }

    /** Endereço da imagem original no servidor de mídia do Wix (sem redimensionamento). */
    private static function wix_original(string $src): string
    {
        if (preg_match('#^(https?://[^/]+/media/[^/]+?\.(?:jpe?g|png|gif|webp|avif))(?:/v1/.*)?$#i', $src, $m)) {
            return $m[1];
        }
        return $src;
    }

    /** Copia um arquivo remoto para a biblioteca de mídia (uma única vez por endereço). */
    private static function sideload(string $url, int $post_id, string $desc = ''): int
    {
        if (!$url || !preg_match('#^https?://#', $url)) {
            return 0;
        }
        $found = get_posts(['post_type' => 'attachment', 'post_status' => 'any', 'numberposts' => 1, 'fields' => 'ids', 'meta_key' => '_cj_origem', 'meta_value' => $url]);
        if ($found) {
            return (int) $found[0];
        }
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';
        $tmp = download_url($url, 60);
        if (is_wp_error($tmp)) {
            return 0;
        }
        $name = sanitize_file_name(rawurldecode(basename((string) wp_parse_url($url, PHP_URL_PATH))));
        if (!preg_match('/\.[a-z0-9]{2,5}$/i', $name)) {
            $mime = wp_get_image_mime($tmp) ?: mime_content_type($tmp);
            $ext  = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp', 'application/pdf' => 'pdf'][$mime] ?? 'bin';
            $name .= '.' . $ext;
        }
        $id = media_handle_sideload(['name' => $name, 'tmp_name' => $tmp], $post_id, $desc);
        if (is_wp_error($id)) {
            @unlink($tmp);
            return 0;
        }
        update_post_meta($id, '_cj_origem', $url);
        return (int) $id;
    }

    /** Domínios onde o Wix guarda mídia (expressão regular, filtrável). */
    private static function media_hosts(): string
    {
        // O Wix também serve arquivos enviados (PDFs dos números, e-books) no próprio domínio, em /_files/.
        $proprio = preg_quote((string) wp_parse_url((string) get_option('cj_wix_site', ''), PHP_URL_HOST), '#');
        return (string) apply_filters('cj_wix_media_hosts', 'wixstatic\.com|wixmp\.com|usrfiles\.com|filesusr\.com' . ($proprio ? '|' . $proprio . '/_files' : ''));
    }

    /** Copia imagens e PDFs hospedados no Wix e reescreve os endereços no HTML. */
    private static function localize_media(string $html, int $post_id, int &$count): string
    {
        $hosts = self::media_hosts();
        $html = preg_replace_callback('#<img([^>]*?)src="([^"]+)"#i', function ($m) use ($post_id, &$count, $hosts) {
            $src = html_entity_decode($m[2]);
            if (!preg_match('#' . $hosts . '#', $src)) {
                return $m[0];
            }
            $id = self::sideload($src, $post_id);
            if (!$id) {
                return $m[0];
            }
            $count++;
            return '<img' . $m[1] . 'class="wp-image-' . $id . '" src="' . esc_url(wp_get_attachment_url($id)) . '"';
        }, $html);
        return preg_replace_callback('#href="([^"]+)"#i', function ($m) use ($post_id, $hosts) {
            $href = html_entity_decode($m[1]);
            if (!preg_match('#(?:' . $hosts . ')/[^"]*\.(?:pdf|docx?|epub)(?:\?|$)#i', $href)) {
                return $m[0];
            }
            $id = self::sideload($href, $post_id);
            return $id ? 'href="' . esc_url(wp_get_attachment_url($id)) . '"' : $m[0];
        }, $html);
    }

    /**
     * Categorias e tags do próprio artigo. No Wix elas ficam no rodapé do post
     * (data-hook="post-footer"); o menu do blog, no topo, lista todas e é ignorado.
     */
    private static function taxonomies_from_links(DOMDocument $doc, ?DOMNode $scope): array
    {
        $x = new DOMXPath($doc);
        $cats = [];
        $tags = [];
        $links = $x->query('//*[@data-hook="post-footer"]//a[contains(@href,"/categories/") or contains(@href,"/tags/") or contains(@href,"/hashtags/")]');
        foreach ($links as $a) {
            $href = $a->getAttribute('href');
            $name = trim($a->textContent);
            if (!preg_match('#/(categories|tags|hashtags)/([^/?\#]+)#', $href, $m) || $name === '') {
                continue;
            }
            if ($m[1] === 'categories') {
                $cats[rawurldecode($m[2])] = $name;
            } else {
                $tags[rawurldecode($m[2])] = ltrim($name, '#');
            }
        }
        return [$cats, $tags];
    }

    private static function import_post(array $row, array $o): array
    {
        // O Wix às vezes devolve uma página incompleta quando limita as requisições:
        // sem o texto do artigo, espera e tenta outra vez.
        for ($tentativa = 0; $tentativa < 3; $tentativa++) {
            $r = self::fetch($row['url']);
            if ($r['code'] !== 200 || $r['body'] === '') {
                return ['status' => 'erro', 'mensagem' => "HTTP {$r['code']} {$r['erro']}"];
            }
            $doc = self::dom($r['body']);
            [$metodo, $node] = self::find_body($doc);
            if ($node) {
                break;
            }
            sleep(5);
        }
        $meta = self::head_meta($doc);
        $ld   = self::article_ld($meta['jsonld']);
        [$cats, $tags] = self::taxonomies_from_links($doc, $node);
        $content = $node ? self::clean($node, $doc) : '';
        if ($content === '' && !empty($ld['articleBody'])) {
            $metodo  = 'json-ld';
            $content = wpautop(esc_html($ld['articleBody']));
        }
        if ($content === '') {
            return ['status' => 'erro', 'mensagem' => 'Texto do artigo não localizado no HTML.', 'seo_title' => $meta['title'], 'seo_desc' => $meta['desc']];
        }

        $slug_wix = rawurldecode(preg_replace('#^/post/#', '', rtrim($row['path'], '/')));
        $titulo = trim(html_entity_decode((string) ($ld['headline'] ?? '')), " \t\n") ?: ($meta['og_title'] ?: preg_replace('/\s+[|\-–]\s+[^|\-–]+$/u', '', $meta['title']));
        $data = $ld['datePublished'] ?? $meta['published'] ?: $row['lastmod'];
        $mod  = $ld['dateModified'] ?? $meta['modified'] ?: $data;
        $autor = '';
        if (!empty($ld['author'])) {
            $autores = isset($ld['author']['name']) ? [$ld['author']] : (array) $ld['author'];
            $autor = implode('; ', array_filter(array_map(fn($a) => is_array($a) ? ($a['name'] ?? '') : (string) $a, $autores)));
        }

        $existing = get_posts(['post_type' => 'post', 'post_status' => 'any', 'numberposts' => 1, 'fields' => 'ids', 'meta_key' => '_cj_url_wix', 'meta_value' => $row['url']]);
        if (!$existing) {
            $existing = get_posts(['post_type' => 'post', 'post_status' => 'any', 'numberposts' => 1, 'fields' => 'ids', 'name' => sanitize_title($slug_wix)]);
        }
        $gmt = $data ? gmdate('Y-m-d H:i:s', strtotime($data)) : current_time('mysql', true);
        $gmt_mod = $mod ? gmdate('Y-m-d H:i:s', strtotime($mod)) : $gmt;
        $postarr = [
            'ID'            => $existing ? (int) $existing[0] : 0,
            'post_type'     => 'post',
            'post_status'   => $o['rascunho'] ? 'draft' : 'publish',
            'post_title'    => wp_strip_all_tags($titulo),
            'post_content'  => $content,
            'post_excerpt'  => $meta['desc'] ?: $meta['og_desc'],
            'post_name'     => $slug_wix,
            'post_date_gmt' => $gmt,
            'post_date'     => get_date_from_gmt($gmt),
            'post_author'   => get_current_user_id(),
        ];
        $post_id = wp_insert_post(wp_slash($postarr), true);
        if (is_wp_error($post_id)) {
            return ['status' => 'erro', 'mensagem' => $post_id->get_error_message()];
        }

        // O WordPress remove acentos do slug ao salvar; o slug do Wix é regravado exatamente como era.
        global $wpdb;
        $desejado = sanitize_title_with_dashes($slug_wix, '', 'save');
        $wpdb->update($wpdb->posts, ['post_name' => $desejado, 'post_modified_gmt' => $gmt_mod, 'post_modified' => get_date_from_gmt($gmt_mod)], ['ID' => $post_id]);
        clean_post_cache($post_id);
        $obs = [];
        if (get_post_field('post_name', $post_id) !== $desejado) {
            $obs[] = 'slug ajustado pelo WordPress; redirecionamento automático ativo';
        }

        $imgs = 0;
        $novo = $o['imagens'] ? self::localize_media($content, $post_id, $imgs) : $content;
        $novo = self::rewrite_internal_links($novo);
        if ($novo !== $content) {
            $wpdb->update($wpdb->posts, ['post_content' => $novo], ['ID' => $post_id]);
            clean_post_cache($post_id);
        }
        if ($o['imagens']) {
            $capa = $meta['og_image'] ?: (is_string($ld['image'] ?? null) ? $ld['image'] : ($ld['image']['url'] ?? ''));
            if ($capa && ($thumb = self::sideload(self::wix_original($capa), $post_id))) {
                set_post_thumbnail($post_id, $thumb);
            }
        }

        $metas = [
            '_cj_url_wix'      => $row['url'],
            '_cj_slug_wix'     => $slug_wix,
            '_cj_seo_title'    => $meta['title'],
            '_cj_seo_desc'     => $meta['desc'] ?: $meta['og_desc'],
            '_cj_autor_artigo' => $autor,
            '_cj_wix_jsonld'   => $meta['jsonld'] ? wp_json_encode($meta['jsonld'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '',
            // Cópia para plugins de SEO, caso algum venha a ser instalado.
            '_yoast_wpseo_title'    => $meta['title'],
            '_yoast_wpseo_metadesc' => $meta['desc'],
            'rank_math_title'       => $meta['title'],
            'rank_math_description' => $meta['desc'],
        ];
        foreach ($metas as $k => $v) {
            if ($v !== '') {
                update_post_meta($post_id, $k, wp_slash($v));
            }
        }
        if (stripos($meta['robots'], 'noindex') !== false) {
            update_post_meta($post_id, '_cj_seo_noindex', '1');
            $obs[] = 'estava como noindex no Wix';
        }

        self::assign_terms($post_id, $cats, $tags);

        if (mb_strlen(wp_strip_all_tags($content)) < 1500) {
            $obs[] = 'texto curto: conferir se o artigo veio completo';
        }
        return [
            'status'     => 'importado',
            'wp_id'      => $post_id,
            'metodo'     => $metodo,
            'caracteres' => mb_strlen(wp_strip_all_tags($content)),
            'imagens'    => $imgs,
            'seo_title'  => $meta['title'],
            'seo_desc'   => $meta['desc'],
            'seo_image'  => $meta['og_image'],
            'robots'     => $meta['robots'],
            'mensagem'   => implode('; ', $obs),
        ];
    }

    /** Cria categorias e tags com os mesmos slugs do Wix. */
    private static function assign_terms(int $post_id, array $cats, array $tags): void
    {
        $cat_ids = [];
        foreach ($cats as $slug => $name) {
            $term = get_term_by('slug', sanitize_title_with_dashes($slug, '', 'save'), 'category') ?: get_term_by('name', $name, 'category');
            if (!$term) {
                $new = wp_insert_term($name, 'category', ['slug' => sanitize_title_with_dashes($slug, '', 'save')]);
                $term = is_wp_error($new) ? null : get_term($new['term_id'], 'category');
            }
            if ($term) {
                $cat_ids[] = (int) $term->term_id;
            }
        }
        if ($cat_ids) {
            wp_set_post_categories($post_id, $cat_ids, false);
        }
        $tag_ids = [];
        foreach ($tags as $slug => $name) {
            $term = get_term_by('slug', sanitize_title_with_dashes($slug, '', 'save'), 'post_tag');
            if (!$term) {
                $new = wp_insert_term($name, 'post_tag', ['slug' => sanitize_title_with_dashes($slug, '', 'save')]);
                $term = is_wp_error($new) ? null : get_term($new['term_id'], 'post_tag');
            }
            if ($term) {
                $tag_ids[] = (int) $term->term_id;
            }
        }
        if ($tag_ids) {
            wp_set_object_terms($post_id, $tag_ids, 'post_tag', false);
        }
    }

    private static function import_page(array $row, array $o): array
    {
        $path  = trim(rawurldecode($row['path']), '/');
        $regra = self::dados()['paginas'][$path] ?? [];
        $acao  = $regra['acao'] ?? '';

        if ($acao === 'ignorar') {
            return ['status' => 'registrado', 'mensagem' => 'Não migrada. ' . ($regra['motivo'] ?? '')];
        }
        if ($acao === 'redirecionar') {
            self::add_redirect('/' . $path, $regra['para']);
            return ['status' => 'redirecionado', 'mensagem' => 'Redireciona para ' . $regra['para']];
        }

        $r = self::fetch($row['url'], 30, false);
        if (in_array($r['code'], [301, 302, 307, 308], true) && $r['location']) {
            $destino = self::path_of($r['location']);
            self::add_redirect('/' . $path, $destino);
            return ['status' => 'redirecionado', 'mensagem' => 'No Wix redirecionava para ' . $destino . '; o redirecionamento foi mantido'];
        }
        if ($r['code'] !== 200) {
            return ['status' => 'erro', 'mensagem' => "HTTP {$r['code']} {$r['erro']}"];
        }
        $doc  = self::dom($r['body']);
        $meta = self::head_meta($doc);
        $out  = ['status' => 'registrado', 'seo_title' => $meta['title'], 'seo_desc' => $meta['desc'], 'seo_image' => $meta['og_image'], 'robots' => $meta['robots']];

        if ($acao === 'edicao') {
            $out['mensagem'] = 'Página de número da revista: criada na etapa final, com os artigos, a capa e o PDF';
            return $out;
        }
        if ($acao === 'livros') {
            $out['mensagem'] = 'Catálogo: os livros são criados na etapa final';
            return $out;
        }

        // Destino no site novo: hotsite, página existente ou página nova com o mesmo endereço.
        $paths  = (array) get_option('cj_hotsite_paths', []);
        $target = 0;
        $onde   = 'página';
        $main   = (new DOMXPath($doc))->query('//main')->item(0);
        $html   = $main ? self::clean($main, $doc) : '';
        $texto  = mb_strlen(wp_strip_all_tags($html));
        if (isset($paths[$path])) {
            $target = (int) $paths[$path];
            $onde = 'hotsite';
        } elseif ($page = get_page_by_path($path)) {
            $target = $page->ID;
        } elseif ($texto < 80) {
            $out['mensagem'] = 'Página sem texto no Wix (provável hotsite ou elemento personalizado): crie um hotsite com o endereço /' . $path;
            return $out;
        } elseif ($o['paginas']) {
            $target = wp_insert_post(wp_slash([
                'post_type' => 'page', 'post_status' => 'publish', 'post_name' => $path,
                'post_title' => $meta['og_title'] ?: preg_replace('/\s*[|\-–]\s*Revista Capital.*$/u', '', $meta['title']) ?: $path,
                'post_content' => '',
            ]));
            global $wpdb;
            $wpdb->update($wpdb->posts, ['post_name' => sanitize_title_with_dashes($path, '', 'save')], ['ID' => $target]);
            clean_post_cache($target);
            $onde = 'página nova';
        }

        if (!$target || !$o['paginas']) {
            $out['mensagem'] = 'Não há página com este endereço no site novo: crie-a ou cadastre um redirecionamento';
            return $out;
        }

        $aplicados = [];
        foreach (['_cj_seo_title' => $meta['title'], '_cj_seo_desc' => $meta['desc']] as $k => $v) {
            if ($v !== '' && get_post_meta($target, $k, true) === '') {
                update_post_meta($target, $k, wp_slash($v));
                $aplicados[] = $k === '_cj_seo_title' ? 'título' : 'descrição';
            }
        }
        if ($meta['og_image'] && $o['imagens'] && !get_post_meta($target, '_cj_seo_image', true)) {
            if ($img = self::sideload(self::wix_original($meta['og_image']), $target)) {
                update_post_meta($target, '_cj_seo_image', $img);
                $aplicados[] = 'imagem';
            }
        }
        // Texto: só em páginas vazias (nunca sobrescreve o que foi escrito) e só quando a regra permite.
        $com_texto = $acao === '' || str_contains($acao, 'conteudo');
        if ($com_texto && get_post_type($target) === 'page' && $target !== (int) get_option('page_on_front')
            && trim((string) get_post_field('post_content', $target)) === '' && $texto > 80) {
            $n = 0;
            if ($o['imagens']) {
                $html = self::localize_media($html, $target, $n);
            }
            wp_update_post(wp_slash(['ID' => $target, 'post_content' => self::rewrite_internal_links($html)]));
            $aplicados[] = 'texto (' . number_format_i18n($texto) . ' car.' . ($n ? ", $n img" : '') . ')';
        }
        // Arquivos ligados na página (PDFs, formulários): copiados para que o endereço antigo redirecione.
        if ($o['imagens'] && preg_match_all('#href="([^"]*?(?:' . self::media_hosts() . ')/[^"]*?\.(?:pdf|docx?)[^"]*)"#i', $r['body'], $mm)) {
            $n = 0;
            foreach (array_unique($mm[1]) as $arq) {
                if (self::sideload(html_entity_decode($arq), $target)) {
                    $n++;
                }
            }
            $aplicados[] = "$n arquivo(s)";
        }
        $out['wp_id'] = $target;
        $out['mensagem'] = 'Aplicado à ' . $onde . ': ' . ($aplicados ? implode(', ', $aplicados) : 'nada novo (já preenchido)');
        return $out;
    }

    /**
     * Links internos do site antigo (https://www.revistacapitaljuridico.com.br/post/x)
     * passam a apontar para o domínio novo, sem depender do redirecionamento.
     */
    private static function rewrite_internal_links(string $html): string
    {
        $host = (string) wp_parse_url((string) get_option('cj_wix_site', ''), PHP_URL_HOST);
        if ($host === '') {
            return $html;
        }
        $nu = preg_quote(preg_replace('/^www\./', '', $host), '#');
        return preg_replace_callback('#href="https?://(?:www\.)?' . $nu . '(/[^"]*)?"#i', fn($m) => 'href="' . esc_url(home_url($m[1] ?? '/')) . '"', $html);
    }

    /** Acrescenta um redirecionamento à lista manual (Configurações → Capital Jurídico), sem duplicar. */
    private static function add_redirect(string $de, string $para): void
    {
        $atual = (string) get_option('cj_redirects', '');
        if (array_key_exists(strtolower(rtrim($de, '/')), CJ_Redirects::manual())) {
            return;
        }
        update_option('cj_redirects', trim($atual . "\n" . $de . ' ' . $para));
    }

    /* ------------------------------------------------------------------ */
    /* Etapa final — números da revista, livros e redirecionamentos        */
    /* ------------------------------------------------------------------ */

    /**
     * Executada um item por chamada, porque cada número tem PDF de vários
     * megabytes. Os dados vêm de migracao-wix.json, levantados do site antigo.
     */
    private static function step_finalize(array $o): array
    {
        $d     = self::dados();
        $itens = array_merge(
            array_map(fn($e) => ['edicao', $e], $d['edicoes'] ?? []),
            array_map(fn($l) => ['livro', $l], $d['livros'] ?? []),
            [['redirecionamentos', $d['redirecionamentos'] ?? []]]
        );
        $i = (int) get_option('cj_wix_final_idx', 0);
        if ($i >= count($itens)) {
            delete_option('cj_wix_final_idx');
            return ['continuar' => false, 'mensagem' => 'Importação concluída: artigos, páginas, números da revista e livros.'];
        }
        [$tipo, $item] = $itens[$i];
        if ($tipo === 'edicao') {
            self::import_edicao($item, $d, $o);
            $msg = 'Número ' . $item['numero'] . ' da revista';
        } elseif ($tipo === 'livro') {
            self::import_livro($item, $o);
            $msg = 'Livro "' . $item['titulo'] . '"';
        } else {
            foreach ($item as $de => $para) {
                self::add_redirect($de, $para);
            }
            $msg = 'Redirecionamentos';
        }
        update_option('cj_wix_final_idx', $i + 1, false);
        return ['continuar' => true, 'mensagem' => "Etapa final ($i/" . count($itens) . "): $msg. Não feche esta página."];
    }

    private static function import_edicao(array $e, array $d, array $o): void
    {
        $slug = $e['slug'];
        $term = get_term_by('slug', $slug, 'cj_edicao');
        if (!$term) {
            $new  = wp_insert_term('Número ' . sprintf('%02d', $e['numero']), 'cj_edicao', ['slug' => $slug]);
            $term = is_wp_error($new) ? null : get_term($new['term_id'], 'cj_edicao');
        }
        if (!$term) {
            return;
        }
        $tid = (int) $term->term_id;
        update_term_meta($tid, 'cj_numero', (int) $e['numero']);
        update_term_meta($tid, 'cj_periodo', $e['mes'] . ' de ' . $e['ano'] . ($e['nota'] ? ' · ' . $e['nota'] : ''));
        if ($o['imagens']) {
            if ($e['pdf'] && !get_term_meta($tid, 'cj_pdf', true) && ($pdf = self::sideload($e['pdf'], 0, 'Revista Capital Jurídico, nº ' . $e['numero']))) {
                update_term_meta($tid, 'cj_pdf', $pdf);
            }
            if ($e['capa'] && !get_term_meta($tid, 'cj_capa', true) && ($capa = self::sideload($e['capa'], 0, 'Capa — Revista Capital Jurídico, nº ' . $e['numero']))) {
                update_term_meta($tid, 'cj_capa', $capa);
            }
        }
        $slugs = $e['artigos'];
        foreach (($d['artigos_por_data'] ?? []) as $dia => $num) {
            if ((int) $num === (int) $e['numero']) {
                $ids = get_posts(['post_type' => 'post', 'post_status' => 'any', 'numberposts' => -1, 'fields' => 'ids',
                    'date_query' => [['year' => (int) substr($dia, 0, 4), 'month' => (int) substr($dia, 5, 2), 'day' => (int) substr($dia, 8, 2)]]]);
                foreach ($ids as $id) {
                    $slugs[] = (string) get_post_meta($id, '_cj_slug_wix', true);
                }
            }
        }
        foreach (array_filter(array_unique($slugs)) as $sl) {
            $found = get_posts(['post_type' => 'post', 'post_status' => 'any', 'numberposts' => 1, 'fields' => 'ids', 'meta_key' => '_cj_slug_wix', 'meta_value' => $sl]);
            if ($found) {
                wp_set_object_terms((int) $found[0], [$tid], 'cj_edicao', true);
            }
        }
    }

    private static function import_livro(array $l, array $o): void
    {
        $existe = get_posts(['post_type' => 'cj_livro', 'post_status' => 'any', 'numberposts' => 1, 'fields' => 'ids', 'title' => $l['titulo']]);
        if ($existe) {
            return; // nunca sobrescreve um livro já cadastrado ou editado
        }
        $id = wp_insert_post(wp_slash([
            'post_type' => 'cj_livro', 'post_status' => 'publish', 'post_title' => $l['titulo'],
            'post_content' => '<p>' . esc_html($l['sinopse']) . '</p>', 'post_excerpt' => $l['sinopse'],
        ]));
        if (!$id) {
            return;
        }
        foreach (['_cj_autores' => $l['autores'] ?? '', '_cj_ano' => $l['ano'] ?? '', '_cj_digital_status' => $l['digital'] ?? '', '_cj_impresso_status' => $l['impresso'] ?? ''] as $k => $v) {
            if ($v !== '') {
                update_post_meta($id, $k, $v);
            }
        }
        if ($o['imagens']) {
            if (!empty($l['arquivo']) && ($arq = self::sideload($l['arquivo'], $id))) {
                update_post_meta($id, '_cj_digital_arquivo', $arq);
            }
            if (!empty($l['capa']) && ($capa = self::sideload($l['capa'], $id))) {
                set_post_thumbnail($id, $capa);
            }
        }
    }

    /* ------------------------------------------------------------------ */
    /* Etapa 3 — verificação                                               */
    /* ------------------------------------------------------------------ */

    private static function step_verify(): array
    {
        global $wpdb;
        $t = self::table();
        $offset = (int) get_transient('cj_wix_verify_offset');
        $rows = $wpdb->get_results($wpdb->prepare("SELECT id, path FROM $t ORDER BY id LIMIT %d, 15", $offset), ARRAY_A);
        foreach ($rows as $row) {
            $url = home_url(preg_replace_callback('#[^\x21-\x7E]+#', fn($m) => rawurlencode($m[0]), rawurldecode($row['path'])));
            $r = wp_remote_head($url, ['timeout' => 15, 'redirection' => 0, 'sslverify' => false]);
            if (is_wp_error($r)) {
                $res = 'falha: ' . $r->get_error_message();
            } else {
                $code = (int) wp_remote_retrieve_response_code($r);
                $res = (string) $code;
                if ($code >= 300 && $code < 400) {
                    $res .= ' → ' . self::path_of((string) wp_remote_retrieve_header($r, 'location'));
                }
            }
            $wpdb->update($t, ['http_novo' => substr($res, 0, 60)], ['id' => $row['id']]);
        }
        if (count($rows) < 15) {
            delete_transient('cj_wix_verify_offset');
            $falhas = (int) $wpdb->get_var("SELECT COUNT(*) FROM $t WHERE http_novo NOT LIKE '200%' AND http_novo NOT LIKE '301%'");
            return ['continuar' => false, 'mensagem' => 'Verificação concluída. Endereços sem resposta 200/301: ' . $falhas . '.'];
        }
        set_transient('cj_wix_verify_offset', $offset + 15, HOUR_IN_SECONDS);
        return ['continuar' => true, 'mensagem' => 'Verificando… ' . ($offset + 15) . ' endereços conferidos.'];
    }

    /* ------------------------------------------------------------------ */
    /* Etapa 4 — relatório                                                 */
    /* ------------------------------------------------------------------ */

    public static function csv(): void
    {
        if (!current_user_can('manage_options') || !wp_verify_nonce(sanitize_key($_GET['_wpnonce'] ?? ''), 'cj_wix')) {
            wp_die('Sem permissão.');
        }
        global $wpdb;
        $rows = $wpdb->get_results('SELECT * FROM ' . self::table() . ' ORDER BY tipo DESC, path', ARRAY_A);
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="migracao-wix-' . gmdate('Y-m-d') . '.csv"');
        $out = fopen('php://output', 'w');
        fwrite($out, "\xEF\xBB\xBF");
        fputcsv($out, ['url_antiga', 'caminho', 'tipo', 'situacao', 'url_nova', 'resposta_site_novo', 'titulo_seo', 'descricao_seo', 'imagem_seo', 'robots', 'metodo_extracao', 'caracteres', 'imagens', 'observacao'], ';');
        foreach ($rows as $r) {
            fputcsv($out, [
                $r['url'], $r['path'], $r['tipo'], $r['status'], $r['wp_id'] ? get_permalink((int) $r['wp_id']) : '', $r['http_novo'],
                $r['seo_title'], $r['seo_desc'], $r['seo_image'], $r['robots'], $r['metodo'], $r['caracteres'], $r['imagens'], $r['mensagem'],
            ], ';');
        }
        fclose($out);
        exit;
    }
}
