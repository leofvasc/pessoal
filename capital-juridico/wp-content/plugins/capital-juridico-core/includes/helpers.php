<?php
/**
 * Funções auxiliares compartilhadas: campos de formulário dos painéis
 * e gravação padronizada de metadados.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Desenha um campo de formulário em uma tabela de painel.
 *
 * @param array $f type, key, label, help, options, placeholder, rows
 */
function cj_field(array $f, $value): void
{
    $key   = esc_attr($f['key']);
    $type  = $f['type'] ?? 'text';
    $label = esc_html($f['label']);
    echo '<tr><th scope="row"><label for="' . $key . '">' . $label . '</label></th><td>';
    switch ($type) {
        case 'textarea':
        case 'code':
            $rows  = (int) ($f['rows'] ?? 4);
            $class = $type === 'code' ? 'large-text code cj-code' : 'large-text';
            echo '<textarea id="' . $key . '" name="' . $key . '" rows="' . $rows . '" class="' . $class . '"'
                . ($type === 'code' ? ' spellcheck="false" autocomplete="off"' : '')
                . ' placeholder="' . esc_attr($f['placeholder'] ?? '') . '">' . esc_textarea((string) $value) . '</textarea>';
            break;
        case 'select':
            echo '<select id="' . $key . '" name="' . $key . '">';
            foreach ($f['options'] as $optValue => $optLabel) {
                echo '<option value="' . esc_attr($optValue) . '"' . selected((string) $value, (string) $optValue, false) . '>' . esc_html($optLabel) . '</option>';
            }
            echo '</select>';
            break;
        case 'checkbox':
            echo '<label><input type="checkbox" id="' . $key . '" name="' . $key . '" value="1"' . checked((bool) $value, true, false) . '> ' . esc_html($f['checkbox_label'] ?? 'Sim') . '</label>';
            break;
        case 'media':
            $url = $value ? wp_get_attachment_url((int) $value) : '';
            echo '<div class="cj-media" data-key="' . $key . '">'
                . '<input type="hidden" id="' . $key . '" name="' . $key . '" value="' . esc_attr((string) $value) . '">'
                . '<input type="text" class="regular-text cj-media-url" readonly value="' . esc_attr((string) $url) . '"> '
                . '<button type="button" class="button cj-media-pick">Escolher arquivo</button> '
                . '<button type="button" class="button-link cj-media-clear">Remover</button></div>';
            break;
        case 'secret':
            $has = (string) $value !== '';
            echo '<input type="password" id="' . $key . '" name="' . $key . '" value="" class="regular-text" autocomplete="new-password" placeholder="'
                . ($has ? 'configurada — deixe em branco para manter' : 'não configurada') . '">'
                . ($has ? ' <span class="description">Para remover, digite <code>apagar</code> e salve.</span>' : '');
            break;
        case 'number':
            echo '<input type="number" id="' . $key . '" name="' . $key . '" value="' . esc_attr((string) $value) . '" class="small-text"'
                . (isset($f['min']) ? ' min="' . (int) $f['min'] . '"' : '') . (isset($f['max']) ? ' max="' . (int) $f['max'] . '"' : '') . '>';
            break;
        default:
            echo '<input type="' . esc_attr($type) . '" id="' . $key . '" name="' . $key . '" value="' . esc_attr((string) $value) . '" class="regular-text" placeholder="' . esc_attr($f['placeholder'] ?? '') . '">';
    }
    if (!empty($f['help'])) {
        echo '<p class="description">' . wp_kses_post($f['help']) . '</p>';
    }
    echo '</td></tr>';
}

/**
 * Grava os campos enviados de um painel como metadados do post.
 * Campos do tipo "code" e "raw" são gravados sem filtragem e só por quem tem
 * a permissão unfiltered_html (administradores), pois contêm scripts.
 */
function cj_save_fields(int $post_id, array $fields): void
{
    foreach ($fields as $f) {
        $key  = $f['key'];
        $type = $f['type'] ?? 'text';
        if ($type === 'checkbox') {
            update_post_meta($post_id, $key, isset($_POST[$key]) ? '1' : '');
            continue;
        }
        if (!array_key_exists($key, $_POST)) {
            continue;
        }
        $raw = wp_unslash($_POST[$key]);
        if (in_array($type, ['code', 'raw'], true)) {
            if (!current_user_can('unfiltered_html')) {
                continue;
            }
            $value = (string) $raw;
        } elseif ($type === 'url') {
            $value = esc_url_raw(trim((string) $raw));
        } elseif ($type === 'textarea') {
            $value = sanitize_textarea_field((string) $raw);
        } elseif (in_array($type, ['number', 'media'], true)) {
            $value = $raw === '' ? '' : (string) (int) $raw;
        } elseif ($type === 'select') {
            $value = array_key_exists((string) $raw, $f['options']) ? (string) $raw : '';
        } else {
            $value = sanitize_text_field((string) $raw);
        }
        if ($value === '') {
            delete_post_meta($post_id, $key);
        } else {
            // wp_slash: update_post_meta remove barras invertidas; o código colado precisa mantê-las.
            update_post_meta($post_id, $key, wp_slash($value));
        }
    }
}

/** Verificações comuns antes de gravar um painel. */
function cj_can_save(int $post_id, string $nonce_action): bool
{
    if (!isset($_POST[$nonce_action . '_nonce']) || !wp_verify_nonce(sanitize_key($_POST[$nonce_action . '_nonce']), $nonce_action)) {
        return false;
    }
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
        return false;
    }
    return current_user_can('edit_post', $post_id);
}

/** Carrega os scripts de seleção de mídia nos painéis do plugin. */
add_action('admin_enqueue_scripts', function () {
    $screen = get_current_screen();
    if (!$screen || !in_array($screen->post_type, ['cj_livro', 'cj_hotsite', 'post', 'page'], true) && $screen->taxonomy !== 'cj_edicao') {
        return;
    }
    wp_enqueue_media();
    wp_enqueue_script('cj-admin', CJ_CORE_URL . 'assets/admin.js', ['jquery'], CJ_CORE_VERSION, true);
    wp_enqueue_style('cj-admin', CJ_CORE_URL . 'assets/admin.css', [], CJ_CORE_VERSION);
});

/**
 * Segredos (chaves de API) gravados pelo painel: cifrados no banco com uma chave
 * derivada das constantes de segurança do wp-config.php, e nunca exibidos de volta.
 */
function cj_secret_key(): string
{
    return hash('sha256', (defined('AUTH_KEY') ? AUTH_KEY : '') . (defined('SECURE_AUTH_SALT') ? SECURE_AUTH_SALT : '') . 'cj-secret', true);
}

function cj_encrypt(string $plain): string
{
    if ($plain === '' || !function_exists('openssl_encrypt')) {
        return $plain;
    }
    $iv = random_bytes(12);
    $tag = '';
    $c = openssl_encrypt($plain, 'aes-256-gcm', cj_secret_key(), OPENSSL_RAW_DATA, $iv, $tag);
    return $c === false ? '' : 'cj1:' . base64_encode($iv . $tag . $c);
}

function cj_decrypt(string $stored): string
{
    if (!str_starts_with($stored, 'cj1:')) {
        return $stored;
    }
    $raw = base64_decode(substr($stored, 4), true);
    if ($raw === false || strlen($raw) < 29) {
        return '';
    }
    $p = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', cj_secret_key(), OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
    return $p === false ? '' : $p;
}

/** Lê um segredo: a constante do wp-config.php, se existir, tem prioridade sobre o painel. */
function cj_secret(string $option, string $constant): string
{
    if (defined($constant) && constant($constant)) {
        return (string) constant($constant);
    }
    return cj_decrypt((string) get_option($option, ''));
}
