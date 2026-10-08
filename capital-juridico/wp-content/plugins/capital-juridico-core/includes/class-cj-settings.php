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
                ['key' => 'cj_cnpj', 'label' => 'CNPJ da editora (se houver)'],
            ],
            'Editora e mantenedora' => [
                ['key' => 'cj_editor_chefe', 'label' => 'Editor-chefe', 'default' => 'Leonardo Fontes Vasconcelos'],
                ['key' => 'cj_editor_bio', 'label' => 'Minibiografia do editor-chefe', 'type' => 'textarea', 'rows' => 3, 'default' => 'Jurista, especialista em direito digital e em inteligência artificial aplicada ao Direito, e professor universitário.'],
                ['key' => 'cj_editor_foto', 'label' => 'Foto do editor-chefe', 'type' => 'media'],
                ['key' => 'cj_editor_lattes', 'label' => 'Currículo Lattes ou página do editor-chefe', 'type' => 'url'],
                ['key' => 'cj_mantenedora', 'label' => 'Mantenedora', 'default' => 'Instituto Lovelace de Inteligência Artificial Aplicada'],
                ['key' => 'cj_mantenedora_cnpj', 'label' => 'CNPJ da mantenedora', 'default' => '68.069.042/0001-12'],
                ['key' => 'cj_mantenedora_url', 'label' => 'Site da mantenedora', 'type' => 'url', 'default' => 'https://institutolovelace.org/'],
            ],
            'Revista Capital Jurídico (acervo histórico)' => [
                ['key' => 'cj_titulo_periodico', 'label' => 'Título do periódico', 'default' => 'Revista Capital Jurídico'],
                ['key' => 'cj_issn', 'label' => 'ISSN', 'default' => '2763-9959', 'help' => 'Exibido em todas as páginas do acervo (números, artigos, expediente e normas), como exige o registro do ISSN.'],
                ['key' => 'cj_rev_periodicidade', 'label' => 'Periodicidade', 'default' => 'Bimestral'],
                ['key' => 'cj_rev_periodo', 'label' => 'Período de publicação', 'default' => 'dezembro de 2020 a abril de 2024'],
                ['key' => 'cj_rev_numeros', 'label' => 'Números publicados', 'default' => '13'],
                ['key' => 'cj_rev_local', 'label' => 'Local de publicação', 'default' => 'Rio Branco, Acre'],
                ['key' => 'cj_rev_idiomas', 'label' => 'Idiomas aceitos', 'default' => 'Português e inglês'],
                ['key' => 'cj_rev_editor', 'label' => 'Editor-chefe da revista', 'default' => 'Leonardo Fontes Vasconcelos'],
                ['key' => 'cj_rev_editores', 'label' => 'Editores científicos', 'type' => 'textarea', 'rows' => 3, 'default' => "Danilo Scramin Alves\nLúcio de Almeida Braga Júnior", 'help' => 'Um nome por linha.'],
                ['key' => 'cj_rev_autor_corporativo', 'label' => 'Autor corporativo', 'default' => 'Leonardo Fontes Vasconcelos'],
                ['key' => 'cj_rev_endereco', 'label' => 'Endereço da revista', 'type' => 'textarea', 'rows' => 2, 'default' => 'Travessa das Flores, n. 5, Isaura Parente, Rio Branco - Acre', 'help' => 'Exigido no expediente pelo registro do ISSN. É o mesmo endereço do Instituto Lovelace.'],
                ['key' => 'cj_rev_email', 'label' => 'E-mail da revista', 'type' => 'email', 'default' => 'revistacapitaljuridico@gmail.com'],
                ['key' => 'cj_aviso_revista', 'label' => 'Apresentação do acervo e aviso de descontinuação', 'type' => 'textarea', 'rows' => 6, 'default' => "A Revista Capital Jurídico foi o primeiro periódico de opinião jurídica do Acre. Entre dezembro de 2020 e abril de 2024, publicou 13 números bimestrais e abriu espaço para que autores do Acre e de todo o país compartilhassem reflexões sobre o Direito, em diálogo com profissionais, estudantes e a sociedade. Seus artigos alcançaram leitores de 22 países. Em 2025 a revista passou a se estruturar como periódico científico semestral, com novas diretrizes de publicação, mas nenhum número foi publicado nesse formato. A revista foi descontinuada e não recebe submissões. Todos os seus números e artigos permanecem disponíveis neste acervo, em seus endereços originais, para consulta e citação."],
            ],
            'Domínios' => [
                ['key' => 'cj_dominios_antigos', 'label' => 'Domínios antigos (redirecionam para o principal)', 'type' => 'textarea', 'rows' => 3, 'default' => "revistacapitaljuridico.com.br\nwww.revistacapitaljuridico.com.br", 'help' => 'Um domínio por linha. Todo acesso a eles é redirecionado (301) para o mesmo endereço no domínio principal, definido em Configurações → Geral. O domínio antigo precisa apontar para esta hospedagem.'],
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
