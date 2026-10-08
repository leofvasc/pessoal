<?php
/**
 * Configurações → Capital Jurídico: textos institucionais, contatos,
 * redirecionamentos manuais, registro de 404 e verificação de visitantes do chatbot.
 */

if (!defined('ABSPATH')) {
    exit;
}

class CJ_Settings
{
    public static function fields(): array
    {
        return [
            'Identidade' => [
                ['key' => 'cj_chamada', 'label' => 'Chamada principal', 'type' => 'textarea', 'rows' => 2, 'default' => 'A editora especializada em livros jurídicos do Acre.'],
                ['key' => 'cj_apresentacao', 'label' => 'Apresentação da editora', 'type' => 'textarea', 'rows' => 5, 'default' => 'A Capital Jurídico publica obras jurídicas de autores e instituições do Acre e da Amazônia, do original à obra impressa e digital: avaliação editorial, revisão, normalização, diagramação, ISBN e distribuição.'],
                ['key' => 'cj_og_padrao', 'label' => 'Imagem padrão de compartilhamento', 'type' => 'media'],
                ['key' => 'cj_catalogo_desc', 'label' => 'Descrição do catálogo (SEO)', 'type' => 'textarea', 'rows' => 2],
            ],
            'Contato' => [
                ['key' => 'cj_email', 'label' => 'E-mail', 'type' => 'email'],
                ['key' => 'cj_whatsapp', 'label' => 'WhatsApp (com DDD, só números)', 'placeholder' => '5568999999999'],
                ['key' => 'cj_instagram', 'label' => 'Instagram (URL)', 'type' => 'url'],
                ['key' => 'cj_endereco', 'label' => 'Cidade / endereço', 'default' => 'Rio Branco, Acre'],
                ['key' => 'cj_cnpj', 'label' => 'CNPJ'],
            ],
            'Acervo de artigos' => [
                ['key' => 'cj_issn', 'label' => 'ISSN', 'default' => '2763-9959'],
                ['key' => 'cj_titulo_periodico', 'label' => 'Título do periódico (para citação)', 'default' => 'Revista Capital Jurídico', 'help' => 'Usado apenas no bloco "Como citar" dos artigos e nos dados estruturados, porque a referência ABNT exige o título exato do periódico.'],
                ['key' => 'cj_aviso_revista', 'label' => 'Aviso do acervo', 'type' => 'textarea', 'rows' => 3, 'default' => 'Este acervo reúne os números e artigos publicados pela Capital Jurídico entre 2020 e 2023. Os textos permanecem disponíveis para consulta e citação.', 'help' => 'Confira o período: o ano final é uma suposição a corrigir.'],
            ],
            'Chatbot dos hotsites' => [
                ['key' => 'cj_openai_key', 'label' => 'Chave da API da OpenAI', 'type' => 'secret', 'help' => 'Gravada cifrada e nunca exibida de novo. Para trocar, cole a nova; para manter, deixe em branco.'],
                ['key' => 'cj_turnstile_site_key', 'label' => 'Cloudflare Turnstile — chave do site', 'help' => 'Verificação "não sou robô" antes da primeira pergunta (substitui o reCAPTCHA do Wix). Gratuita em dash.cloudflare.com → Turnstile. Sem as duas chaves, o chatbot funciona apenas com os limites diário e por IP.'],
                ['key' => 'cj_turnstile_secret', 'label' => 'Cloudflare Turnstile — chave secreta', 'type' => 'secret'],
            ],
            'Avançado' => [
                ['key' => 'cj_head_code', 'label' => 'Código no &lt;head&gt; de todas as páginas', 'type' => 'code', 'rows' => 4, 'help' => 'Ex.: Google Analytics ou verificação do Search Console. Também é incluído nos hotsites.'],
                ['key' => 'cj_redirects', 'label' => 'Redirecionamentos 301', 'type' => 'code', 'rows' => 8, 'help' => 'Uma regra por linha: endereço antigo, espaço, endereço novo. Ex.: <code>/copy-of-sobre /sobre</code>'],
            ],
        ];
    }

    public static function init(): void
    {
        add_action('admin_menu', function () {
            add_options_page('Capital Jurídico', 'Capital Jurídico', 'manage_options', 'cj-config', [__CLASS__, 'page']);
        });
        add_action('admin_init', [__CLASS__, 'register']);
        add_action('wp_head', function () {
            echo (string) get_option('cj_head_code', ''); // phpcs:ignore -- gravado apenas por administradores.
        }, 99);
        add_action('admin_enqueue_scripts', function ($hook) {
            if ($hook === 'settings_page_cj-config') {
                wp_enqueue_media();
                wp_enqueue_script('cj-admin', CJ_CORE_URL . 'assets/admin.js', ['jquery'], CJ_CORE_VERSION, true);
            }
        });
    }

    public static function register(): void
    {
        foreach (self::fields() as $group) {
            foreach ($group as $f) {
                $type = $f['type'] ?? 'text';
                register_setting('cj_config', $f['key'], [
                    'sanitize_callback' => match ($type) {
                        'code'     => fn($v) => current_user_can('unfiltered_html') ? (string) $v : get_option($f['key'], ''),
                        'textarea' => 'sanitize_textarea_field',
                        'url'      => 'esc_url_raw',
                        'email'    => 'sanitize_email',
                        'media'    => 'absint',
                        'secret'   => fn($v) => self::sanitize_secret($f['key'], (string) $v),
                        default    => 'sanitize_text_field',
                    },
                ]);
            }
        }
    }

    /** Campo vazio mantém a chave atual; "apagar" remove; qualquer outro valor é cifrado. */
    private static function sanitize_secret(string $key, string $value): string
    {
        $value = trim($value);
        if (str_starts_with($value, 'cj1:')) {
            return $value; // já cifrado (o WordPress pode sanitizar duas vezes na primeira gravação)
        }
        if ($value === '') {
            return (string) get_option($key, '');
        }
        return strtolower($value) === 'apagar' ? '' : cj_encrypt($value);
    }

    /** Valor de uma opção com o padrão definido acima. */
    public static function get(string $key): string
    {
        foreach (self::fields() as $group) {
            foreach ($group as $f) {
                if ($f['key'] === $key) {
                    return (string) get_option($key, $f['default'] ?? '');
                }
            }
        }
        return (string) get_option($key, '');
    }

    public static function page(): void
    {
        if (isset($_POST['cj_limpar_404']) && check_admin_referer('cj_limpar_404')) {
            delete_option('cj_404_log');
        }
        echo '<div class="wrap"><h1>Capital Jurídico</h1><form method="post" action="options.php">';
        settings_fields('cj_config');
        foreach (self::fields() as $title => $group) {
            echo '<h2>' . esc_html($title) . '</h2><table class="form-table" role="presentation">';
            foreach ($group as $f) {
                cj_field($f, self::get($f['key']));
            }
            echo '</table>';
        }
        submit_button();
        echo '</form>';

        $log = (array) get_option('cj_404_log', []);
        uasort($log, fn($a, $b) => $b['n'] <=> $a['n']);
        echo '<h2>Endereços não encontrados (404)</h2><p>Endereços que receberam visitas e não existem no site. Os mais acessados merecem um redirecionamento acima.</p>';
        if ($log) {
            echo '<table class="widefat striped" style="max-width:900px"><thead><tr><th>Endereço</th><th>Acessos</th><th>Último acesso</th></tr></thead><tbody>';
            foreach (array_slice($log, 0, 100, true) as $path => $d) {
                echo '<tr><td><code>' . esc_html($path) . '</code></td><td>' . (int) $d['n'] . '</td><td>' . esc_html(wp_date('d/m/Y H:i', (int) $d['t'])) . '</td></tr>';
            }
            echo '</tbody></table><form method="post">';
            wp_nonce_field('cj_limpar_404');
            echo '<p><button class="button" name="cj_limpar_404" value="1">Limpar registro</button></p></form>';
        } else {
            echo '<p>Nenhum registro.</p>';
        }
        echo '</div>';
    }
}
