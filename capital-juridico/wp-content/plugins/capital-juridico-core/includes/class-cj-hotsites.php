<?php
/**
 * Hotsites de lançamento.
 *
 * Cada hotsite é um código desenvolvido sob medida para uma obra e colado (ou
 * enviado como arquivo) no painel. Ele é publicado num endereço próprio do site,
 * por exemplo /livro-ia, e pode ser de dois tipos:
 *
 *  - "Elemento personalizado (JS)": um arquivo JavaScript que define uma tag
 *    (customElements.define). É o formato do hotsite livro-ia feito para o Wix,
 *    que funciona aqui sem alteração.
 *  - "Documento HTML completo": uma página HTML inteira, com <html>, <head> e <body>.
 *
 * O código é gravado também como arquivo estático em wp-content/uploads/cj-hotsites,
 * para ser entregue com cache pelo servidor.
 */

if (!defined('ABSPATH')) {
    exit;
}

class CJ_Hotsites
{
    private const RESERVADOS = [
        'wp-admin', 'wp-content', 'wp-includes', 'wp-json', 'wp-login.php', 'post', 'blog', 'livros',
        'revista', 'feed', 'sitemap.xml', 'wp-sitemap.xml', 'numerosanteriores', 'sobre', 'publique', 'contato',
        'artigos', 'expediente', 'publique-seu-livro', '_files',
    ];

    public static function init(): void
    {
        add_action('init', [__CLASS__, 'register']);
        add_action('init', [__CLASS__, 'add_rewrite_rules']);
        add_filter('query_vars', fn($v) => array_merge($v, ['cj_hotsite', 'cj_hotsite_preview']));
        add_action('template_redirect', [__CLASS__, 'render'], 1);
        add_action('add_meta_boxes', [__CLASS__, 'meta_boxes']);
        add_action('post_edit_form_tag', [__CLASS__, 'form_enctype']);
        add_action('save_post_cj_hotsite', [__CLASS__, 'save'], 10, 1);
        add_action('transition_post_status', [__CLASS__, 'on_status'], 10, 3);
        add_action('before_delete_post', [__CLASS__, 'on_delete']);
        add_action('admin_notices', [__CLASS__, 'notices']);
        add_filter('post_type_link', [__CLASS__, 'permalink'], 10, 2);
        add_filter('preview_post_link', [__CLASS__, 'preview_link'], 10, 2);
        add_filter('manage_cj_hotsite_posts_columns', [__CLASS__, 'columns']);
        add_action('manage_cj_hotsite_posts_custom_column', [__CLASS__, 'column'], 10, 2);
        add_action('init', [__CLASS__, 'maybe_flush'], 99);
    }

    public static function register(): void
    {
        register_post_type('cj_hotsite', [
            'labels' => [
                'name'          => 'Hotsites',
                'singular_name' => 'Hotsite',
                'add_new'       => 'Criar hotsite',
                'add_new_item'  => 'Criar hotsite de lançamento',
                'edit_item'     => 'Editar hotsite',
                'all_items'     => 'Todos os hotsites',
                'menu_name'     => 'Hotsites',
            ],
            'public'             => false,
            'publicly_queryable' => false,
            'show_ui'            => true,
            'show_in_menu'       => true,
            'menu_icon'          => 'dashicons-megaphone',
            'menu_position'      => 6,
            'supports'           => ['title', 'thumbnail', 'excerpt'],
            'show_in_rest'       => false,
        ]);
    }

    /* ------------------------------------------------------------------ */
    /* Endereços                                                           */
    /* ------------------------------------------------------------------ */

    /** Normaliza o caminho digitado: "Livro IA" → "livro-ia"; "/lancamentos/obra/" → "lancamentos/obra". */
    public static function sanitize_path(string $path): string
    {
        $parts = array_filter(array_map('sanitize_title', explode('/', strtolower(trim($path)))));
        return implode('/', $parts);
    }

    public static function path(int $id): string
    {
        return (string) get_post_meta($id, '_cj_path', true);
    }

    public static function url(int $id): string
    {
        $path = self::path($id);
        return $path ? home_url('/' . $path) : '';
    }

    /** Mapa caminho => ID dos hotsites publicados. */
    public static function published_paths(): array
    {
        $map = [];
        $ids = get_posts(['post_type' => 'cj_hotsite', 'post_status' => 'publish', 'numberposts' => -1, 'fields' => 'ids']);
        foreach ($ids as $id) {
            $p = self::path($id);
            if ($p !== '') {
                $map[$p] = $id;
            }
        }
        return $map;
    }

    public static function add_rewrite_rules(): void
    {
        foreach ((array) get_option('cj_hotsite_paths', []) as $path => $id) {
            add_rewrite_rule('^' . preg_quote($path, '#') . '/?$', 'index.php?cj_hotsite=' . (int) $id, 'top');
        }
    }

    /** Atualiza a tabela de endereços e pede a regravação das regras no próximo carregamento. */
    public static function refresh_paths(): void
    {
        update_option('cj_hotsite_paths', self::published_paths(), true);
        update_option('cj_hotsite_flush', 1, true);
    }

    public static function maybe_flush(): void
    {
        if (get_option('cj_hotsite_flush')) {
            delete_option('cj_hotsite_flush');
            flush_rewrite_rules(false);
        }
    }

    public static function on_status(string $new, string $old, WP_Post $post): void
    {
        if ($post->post_type === 'cj_hotsite' && $new !== $old) {
            self::refresh_paths();
        }
    }

    public static function on_delete(int $post_id): void
    {
        if (get_post_type($post_id) === 'cj_hotsite') {
            add_action('deleted_post', [__CLASS__, 'refresh_paths']);
        }
    }

    public static function permalink(string $link, WP_Post $post): string
    {
        return $post->post_type === 'cj_hotsite' ? (self::url($post->ID) ?: $link) : $link;
    }

    public static function preview_link(string $link, WP_Post $post): string
    {
        return $post->post_type === 'cj_hotsite' ? add_query_arg('cj_hotsite_preview', $post->ID, home_url('/')) : $link;
    }

    /* ------------------------------------------------------------------ */
    /* Painel                                                              */
    /* ------------------------------------------------------------------ */

    public static function form_enctype(WP_Post $post): void
    {
        if ($post->post_type === 'cj_hotsite') {
            echo ' enctype="multipart/form-data"';
        }
    }

    public static function fields(): array
    {
        $livros = ['' => '— nenhum —'];
        foreach (get_posts(['post_type' => 'cj_livro', 'numberposts' => -1, 'post_status' => 'any']) as $l) {
            $livros[(string) $l->ID] = $l->post_title;
        }
        return [
            ['key' => '_cj_modo', 'label' => 'Tipo de código', 'type' => 'select', 'options' => [
                'auto'     => 'Detectar automaticamente',
                'elemento' => 'Elemento personalizado (arquivo JavaScript com customElements.define)',
                'html'     => 'Documento HTML completo',
            ]],
            ['key' => '_cj_tag', 'label' => 'Tag do elemento', 'placeholder' => 'capital-juridico-livro-ia', 'help' => 'Só para o tipo "Elemento personalizado". Se ficar em branco, é lida do próprio código.'],
            ['key' => '_cj_layout', 'label' => 'Moldura', 'type' => 'select', 'options' => [
                'limpo' => 'Página inteira do hotsite (sem cabeçalho e rodapé do site)',
                'site'  => 'Dentro do site (com cabeçalho e rodapé da editora)',
            ], 'help' => 'Para "Documento HTML completo", use "Página inteira". Dentro do site, cole apenas um trecho de HTML (sem &lt;html&gt; e &lt;head&gt;).'],
            ['key' => '_cj_fundo', 'label' => 'Cor de fundo da página', 'type' => 'text', 'placeholder' => '#141311', 'help' => 'Cor exibida enquanto o hotsite carrega. Opcional.'],
            ['key' => '_cj_livro', 'label' => 'Livro do catálogo', 'type' => 'select', 'options' => $livros, 'help' => 'Liga o hotsite à ficha do livro no catálogo.'],
            ['key' => '_cj_listar', 'label' => 'Lançamentos', 'type' => 'checkbox', 'checkbox_label' => 'Mostrar este hotsite na página inicial e na lista de lançamentos'],
            ['key' => '_cj_head_extra', 'label' => 'Código extra no &lt;head&gt;', 'type' => 'code', 'rows' => 3, 'help' => 'Opcional: fontes, pixel de campanha ou dados estruturados próprios deste hotsite.'],
        ];
    }

    public static function chat_fields(): array
    {
        return [
            ['key' => '_cj_chat_ativo', 'label' => 'Chatbot', 'type' => 'checkbox', 'checkbox_label' => 'Responder às perguntas enviadas pelo chat do hotsite'],
            ['key' => '_cj_chat_instrucoes', 'label' => 'Instruções do assistente', 'type' => 'code', 'rows' => 10, 'help' => 'Regras de comportamento (equivalem à constante INSTRUCOES do backend do Wix). A base de conhecimento abaixo é acrescentada automaticamente ao final.'],
            ['key' => '_cj_chat_base', 'label' => 'Base de conhecimento da obra', 'type' => 'code', 'rows' => 12, 'help' => 'Texto em Markdown com as informações aprovadas (equivale ao BASE_LIVRO do Wix).'],
            ['key' => '_cj_chat_modelo', 'label' => 'Modelo', 'placeholder' => 'gpt-5-mini', 'help' => 'Identificador do modelo na API da OpenAI.'],
            ['key' => '_cj_chat_esforco', 'label' => 'Esforço de raciocínio', 'type' => 'select', 'options' => ['minimal' => 'minimal', 'low' => 'low', 'medium' => 'medium', 'nenhum' => 'não enviar este parâmetro']],
            ['key' => '_cj_chat_tokens', 'label' => 'Máximo de tokens gerados', 'type' => 'number', 'min' => 100, 'max' => 32000, 'placeholder' => '1800'],
            ['key' => '_cj_chat_limite', 'label' => 'Limite diário de perguntas', 'type' => 'number', 'min' => 0, 'help' => 'Compartilhado por todos os visitantes deste hotsite, por dia UTC (reinicia às 19h no horário do Acre). Padrão: 200.'],
        ];
    }

    public static function meta_boxes(): void
    {
        add_meta_box('cj_hotsite_codigo', 'Endereço e código do hotsite', [__CLASS__, 'box_code'], 'cj_hotsite', 'normal', 'high');
        add_meta_box('cj_hotsite_chat', 'Chatbot de IA', [__CLASS__, 'box_chat'], 'cj_hotsite', 'normal', 'default');
    }

    public static function box_code(WP_Post $post): void
    {
        wp_nonce_field('cj_hotsite', 'cj_hotsite_nonce');
        $path = self::path($post->ID);
        $file = get_post_meta($post->ID, '_cj_arquivo', true);
        $size = strlen((string) get_post_meta($post->ID, '_cj_codigo', true));

        echo '<table class="form-table" role="presentation">';
        echo '<tr><th scope="row"><label for="_cj_path">Endereço</label></th><td><code>' . esc_html(home_url('/')) . '</code>'
            . '<input type="text" id="_cj_path" name="_cj_path" value="' . esc_attr($path) . '" class="regular-text" placeholder="livro-ia" required>'
            . '<p class="description">Use letras minúsculas e hífens. Para manter um endereço do site antigo, repita-o exatamente (ex.: <code>livro-ia</code>).</p>';
        if ($path && $post->post_status === 'publish') {
            echo '<p><a href="' . esc_url(self::url($post->ID)) . '" target="_blank" rel="noopener">Abrir hotsite publicado ↗</a></p>';
        }
        echo '</td></tr>';

        echo '<tr><th scope="row">Código atual</th><td>';
        if ($size) {
            echo '<p><strong>' . esc_html(number_format_i18n($size / 1024, 1)) . ' KB</strong> · tipo: ' . esc_html(self::mode($post->ID) === 'html' ? 'documento HTML' : 'elemento personalizado')
                . ($file ? ' · <a href="' . esc_url(self::file_url($file)) . '" target="_blank" rel="noopener">ver arquivo</a>' : '')
                . ' · <a href="' . esc_url(add_query_arg('cj_hotsite_preview', $post->ID, home_url('/'))) . '" target="_blank" rel="noopener">prévia</a></p>';
            if (get_post_meta($post->ID, '_cj_codigo_anterior', true)) {
                echo '<label><input type="checkbox" name="_cj_restaurar" value="1"> Desfazer a última troca de código (restaurar a versão anterior)</label>';
            }
        } else {
            echo '<p>Nenhum código enviado ainda.</p>';
        }
        echo '</td></tr>';

        echo '<tr><th scope="row"><label for="_cj_codigo_novo">Novo código</label></th><td>'
            . '<p><input type="file" name="_cj_codigo_arquivo" accept=".js,.html,.htm,.txt,text/javascript,text/html,text/plain"> envie o arquivo <em>ou</em> cole o código abaixo.</p>'
            . '<textarea id="_cj_codigo_novo" name="_cj_codigo_novo" rows="8" class="large-text code cj-code" spellcheck="false" autocomplete="off" placeholder="Cole aqui todo o código do hotsite (Ctrl+A, Ctrl+C no arquivo; Ctrl+V aqui). Deixe em branco para manter o código atual."></textarea>'
            . '<p class="description">O código antigo é guardado para que a troca possa ser desfeita.</p></td></tr>';

        foreach (self::fields() as $f) {
            cj_field($f, get_post_meta($post->ID, $f['key'], true));
        }
        echo '</table>';
        echo '<p class="description">Título, descrição, imagem de compartilhamento e indexação ficam no painel "SEO e compartilhamento". O resumo (campo "Resumo") aparece na lista de lançamentos.</p>';
    }

    public static function box_chat(WP_Post $post): void
    {
        $status = CJ_Chatbot::status();
        echo '<p>' . wp_kses_post($status) . '</p><table class="form-table" role="presentation">';
        foreach (self::chat_fields() as $f) {
            cj_field($f, get_post_meta($post->ID, $f['key'], true));
        }
        echo '</table>';
        if ($post->post_status !== 'auto-draft') {
            echo '<p><button type="button" class="button" id="cj-chat-teste" data-id="' . (int) $post->ID . '" data-nonce="' . esc_attr(wp_create_nonce('wp_rest')) . '" data-url="' . esc_url(rest_url('capital/v1/chat-teste')) . '">Testar conexão (fora da cota)</button> <span id="cj-chat-teste-resultado"></span></p>';
        }
        echo '<p class="description">O hotsite conversa com o site enviando o evento <code>chat-question</code> e recebe os atributos <code>chat-verification</code> e <code>chat-response</code> — o mesmo protocolo usado no Wix. A chave da OpenAI fica em Configurações → Capital Jurídico, nunca no código do hotsite.</p>';
    }

    public static function save(int $post_id): void
    {
        if (!cj_can_save($post_id, 'cj_hotsite')) {
            return;
        }

        $path = self::sanitize_path((string) wp_unslash($_POST['_cj_path'] ?? ''));
        if ($path !== '') {
            $first = explode('/', $path)[0];
            $dup   = array_search($path, (array) get_option('cj_hotsite_paths', []), true);
            if (in_array($first, self::RESERVADOS, true)) {
                self::flash($post_id, 'O endereço "' . $path . '" é reservado pelo site. Escolha outro.');
            } elseif ($dup && (int) $dup !== $post_id) {
                self::flash($post_id, 'Já existe outro hotsite publicado em /' . $path . '.');
            } else {
                update_post_meta($post_id, '_cj_path', $path);
                if (get_page_by_path($path) || get_page_by_path($path, OBJECT, 'post')) {
                    self::flash($post_id, 'Atenção: existe uma página ou artigo com o endereço /' . $path . '. O hotsite terá prioridade sobre ele.');
                }
            }
        }

        cj_save_fields($post_id, array_merge(self::fields(), self::chat_fields()));
        self::refresh_paths();

        if (!current_user_can('unfiltered_html')) {
            return;
        }

        $novo = '';
        if (!empty($_FILES['_cj_codigo_arquivo']['tmp_name']) && is_uploaded_file($_FILES['_cj_codigo_arquivo']['tmp_name'])) {
            $novo = (string) file_get_contents($_FILES['_cj_codigo_arquivo']['tmp_name']);
        } elseif (!empty($_POST['_cj_codigo_novo'])) {
            $novo = (string) wp_unslash($_POST['_cj_codigo_novo']);
        }
        // Remove a marca de ordem de bytes (BOM) que o Bloco de Notas pode inserir.
        $novo = preg_replace('/^\xEF\xBB\xBF/', '', $novo);

        if (trim($novo) !== '') {
            $atual = (string) get_post_meta($post_id, '_cj_codigo', true);
            if ($atual !== '' && $atual !== $novo) {
                update_post_meta($post_id, '_cj_codigo_anterior', wp_slash($atual));
            }
            self::store_code($post_id, $novo);
        } elseif (!empty($_POST['_cj_restaurar'])) {
            $anterior = (string) get_post_meta($post_id, '_cj_codigo_anterior', true);
            if ($anterior !== '') {
                update_post_meta($post_id, '_cj_codigo_anterior', wp_slash((string) get_post_meta($post_id, '_cj_codigo', true)));
                self::store_code($post_id, $anterior);
            }
        }
    }

    /** Grava o código no banco (cópia de segurança) e como arquivo estático. */
    public static function store_code(int $post_id, string $code): void
    {
        update_post_meta($post_id, '_cj_codigo', wp_slash($code));
        $mode = self::detect_mode($code);
        update_post_meta($post_id, '_cj_modo_detectado', $mode);
        if ($mode === 'elemento' && preg_match('/customElements\.define\(\s*[\'"]([a-z][a-z0-9]*-[a-z0-9-]*)[\'"]/', $code, $m)) {
            update_post_meta($post_id, '_cj_tag_detectada', $m[1]);
        }

        $dir = self::dir();
        if (!wp_mkdir_p($dir)) {
            return;
        }
        $old = get_post_meta($post_id, '_cj_arquivo', true);
        $name = $post_id . '-' . substr(md5($code), 0, 10) . ($mode === 'html' ? '.html' : '.js');
        if (file_put_contents($dir . '/' . $name, $code) !== false) {
            update_post_meta($post_id, '_cj_arquivo', $name);
            if ($old && $old !== $name && file_exists($dir . '/' . $old)) {
                @unlink($dir . '/' . $old);
            }
        }
    }

    public static function detect_mode(string $code): string
    {
        $head = strtolower(ltrim(substr($code, 0, 2000)));
        return (str_starts_with($head, '<!doctype') || str_starts_with($head, '<html') || preg_match('/^<(head|body|meta|div|section|main|style|link|script)\b/', $head)) ? 'html' : 'elemento';
    }

    public static function mode(int $id): string
    {
        $m = get_post_meta($id, '_cj_modo', true);
        return in_array($m, ['elemento', 'html'], true) ? $m : (get_post_meta($id, '_cj_modo_detectado', true) ?: 'elemento');
    }

    public static function dir(): string
    {
        return wp_upload_dir(null, false)['basedir'] . '/cj-hotsites';
    }

    public static function file_url(string $name): string
    {
        return wp_upload_dir(null, false)['baseurl'] . '/cj-hotsites/' . rawurlencode($name);
    }

    private static function flash(int $post_id, string $msg): void
    {
        set_transient('cj_hotsite_msg_' . get_current_user_id(), $msg, 60);
    }

    public static function notices(): void
    {
        $msg = get_transient('cj_hotsite_msg_' . get_current_user_id());
        if ($msg) {
            delete_transient('cj_hotsite_msg_' . get_current_user_id());
            echo '<div class="notice notice-warning is-dismissible"><p>' . esc_html($msg) . '</p></div>';
        }
    }

    public static function columns(array $cols): array
    {
        return ['cb' => $cols['cb'], 'title' => $cols['title'], 'cj_url' => 'Endereço', 'cj_chat' => 'Chatbot', 'date' => $cols['date']];
    }

    public static function column(string $col, int $post_id): void
    {
        if ($col === 'cj_url') {
            $p = self::path($post_id);
            echo $p ? '<code>/' . esc_html($p) . '</code>' : '—';
        } elseif ($col === 'cj_chat') {
            echo get_post_meta($post_id, '_cj_chat_ativo', true) ? 'ativo' : '—';
        }
    }

    /** Hotsites marcados para aparecer em "Lançamentos". */
    public static function lancamentos(int $limit = -1): array
    {
        return get_posts([
            'post_type'   => 'cj_hotsite',
            'post_status' => 'publish',
            'numberposts' => $limit,
            'meta_key'    => '_cj_listar',
            'meta_value'  => '1',
        ]);
    }

    /* ------------------------------------------------------------------ */
    /* Exibição                                                            */
    /* ------------------------------------------------------------------ */

    public static function render(): void
    {
        $id = (int) get_query_var('cj_hotsite');
        $preview = (int) get_query_var('cj_hotsite_preview');
        if ($preview) {
            if (!current_user_can('edit_post', $preview)) {
                auth_redirect();
            }
            $id = $preview;
        } elseif ($id && get_post_status($id) !== 'publish') {
            $id = 0;
        }
        if (!$id || get_post_type($id) !== 'cj_hotsite') {
            return;
        }
        $code = (string) get_post_meta($id, '_cj_codigo', true);
        if ($code === '') {
            return;
        }

        global $wp_query;
        $wp_query->is_404 = false;
        status_header(200);
        if ($preview) {
            header('X-Robots-Tag: noindex, nofollow');
        }
        $GLOBALS['cj_current_hotsite'] = $id;

        $mode   = self::mode($id);
        $layout = get_post_meta($id, '_cj_layout', true) ?: 'limpo';

        if ($layout === 'site') {
            self::render_in_theme($id, $mode, $code);
        } elseif ($mode === 'html') {
            self::render_html_document($id, $code, (bool) $preview);
        } else {
            self::render_element_page($id, (bool) $preview);
        }
        exit;
    }

    /** Configuração e ponte do chatbot, injetadas em toda página de hotsite. */
    public static function bridge_tags(int $id): string
    {
        $config = [
            'id'        => $id,
            'endpoint'  => rest_url('capital/v1/chat'),
            'chat'      => (bool) get_post_meta($id, '_cj_chat_ativo', true),
            'turnstile' => CJ_Chatbot::turnstile_site_key(),
        ];
        return '<script>window.CJ_HOTSITE=' . wp_json_encode($config) . ';</script>' . "\n"
            . '<script src="' . esc_url(CJ_CORE_URL . 'assets/hotsite-bridge.js?ver=' . CJ_CORE_VERSION) . '" defer></script>' . "\n";
    }

    private static function code_src(int $id): string
    {
        $file = get_post_meta($id, '_cj_arquivo', true);
        if ($file && file_exists(self::dir() . '/' . $file)) {
            return self::file_url($file);
        }
        return '';
    }

    private static function tag(int $id): string
    {
        $tag = get_post_meta($id, '_cj_tag', true) ?: get_post_meta($id, '_cj_tag_detectada', true);
        return preg_match('/^[a-z][a-z0-9]*-[a-z0-9-]*$/', (string) $tag) ? $tag : '';
    }

    private static function head_common(int $id, bool $preview): string
    {
        $out = CJ_SEO::head_tags($id, $preview);
        if ($icon = get_site_icon_url(512)) {
            $out .= '<link rel="icon" href="' . esc_url($icon) . '">' . "\n";
        }
        $out .= (string) get_option('cj_head_code', '') . "\n";
        $out .= (string) get_post_meta($id, '_cj_head_extra', true) . "\n";
        return $out . self::bridge_tags($id);
    }

    private static function render_element_page(int $id, bool $preview): void
    {
        $tag  = self::tag($id);
        $src  = self::code_src($id);
        $bg   = sanitize_hex_color((string) get_post_meta($id, '_cj_fundo', true));
        header('Content-Type: text/html; charset=utf-8');
        echo "<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n";
        echo self::head_common($id, $preview); // phpcs:ignore -- marcação gerada e escapada em head_common/head_tags.
        echo '<style>html,body{margin:0;padding:0' . ($bg ? ';background:' . $bg : '') . '}</style>' . "\n</head>\n<body>\n";
        echo $tag ? '<' . $tag . '></' . $tag . '>' : '<!-- Tag do elemento não identificada: preencha "Tag do elemento" no painel. -->';
        echo "\n";
        if ($src) {
            echo '<script src="' . esc_url($src) . '"></script>' . "\n";
        } else {
            echo '<script>' . self::inline_js((string) get_post_meta($id, '_cj_codigo', true)) . '</script>' . "\n";
        }
        echo "</body>\n</html>";
    }

    private static function render_html_document(int $id, string $code, bool $preview): void
    {
        header('Content-Type: text/html; charset=utf-8');
        $inject = self::head_common($id, $preview);
        if (stripos($code, '</head>') !== false) {
            $code = preg_replace_callback('#</head>#i', fn() => $inject . '</head>', $code, 1);
        } else {
            $code = $inject . $code;
        }
        echo $code; // phpcs:ignore -- código do hotsite, gravado apenas por administradores.
    }

    private static function render_in_theme(int $id, string $mode, string $code): void
    {
        add_action('wp_head', function () use ($id) {
            echo self::bridge_tags($id) . (string) get_post_meta($id, '_cj_head_extra', true); // phpcs:ignore
        });
        add_filter('cj_seo_post_id', fn() => $id);
        get_header();
        echo '<main id="conteudo" class="cj-hotsite-embed">';
        if ($mode === 'html') {
            echo $code; // phpcs:ignore
        } else {
            $tag = self::tag($id);
            $src = self::code_src($id);
            echo $tag ? '<' . $tag . '></' . $tag . '>' : '';
            echo $src ? '<script src="' . esc_url($src) . '"></script>' : '<script>' . self::inline_js($code) . '</script>';
        }
        echo '</main>';
        get_footer();
    }

    /** Evita que um "</script>" dentro do código feche a tag antes da hora. */
    private static function inline_js(string $js): string
    {
        return str_ireplace('</script', '<\/script', $js);
    }
}
