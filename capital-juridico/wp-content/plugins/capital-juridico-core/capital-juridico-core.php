<?php
/**
 * Plugin Name: Capital Jurídico — Núcleo
 * Description: Catálogo de livros, acervo da Revista Capital Jurídico, hotsites de lançamento com chatbot, SEO, redirecionamentos e importador do site antigo (Wix).
 * Version: 1.0.0
 * Requires at least: 6.3
 * Requires PHP: 8.0
 * Author: Editora Capital Jurídico
 * Text Domain: capital-juridico
 *
 * Os dados (livros, edições, hotsites, artigos) ficam neste plugin, e não no tema,
 * para que uma futura troca de tema não apague nada do conteúdo.
 */

if (!defined('ABSPATH')) {
    exit;
}

define('CJ_CORE_VERSION', '1.0.0');
define('CJ_CORE_FILE', __FILE__);
define('CJ_CORE_DIR', plugin_dir_path(__FILE__));
define('CJ_CORE_URL', plugin_dir_url(__FILE__));

require_once CJ_CORE_DIR . 'includes/helpers.php';
require_once CJ_CORE_DIR . 'includes/class-cj-livros.php';
require_once CJ_CORE_DIR . 'includes/class-cj-revista.php';
require_once CJ_CORE_DIR . 'includes/class-cj-hotsites.php';
require_once CJ_CORE_DIR . 'includes/class-cj-chatbot.php';
require_once CJ_CORE_DIR . 'includes/class-cj-seo.php';
require_once CJ_CORE_DIR . 'includes/class-cj-redirects.php';
require_once CJ_CORE_DIR . 'includes/class-cj-importador-wix.php';
require_once CJ_CORE_DIR . 'includes/class-cj-settings.php';

CJ_Livros::init();
CJ_Revista::init();
CJ_Hotsites::init();
CJ_Chatbot::init();
CJ_SEO::init();
CJ_Redirects::init();
CJ_Importador_Wix::init();
CJ_Settings::init();

register_activation_hook(__FILE__, 'cj_core_activate');
register_deactivation_hook(__FILE__, 'flush_rewrite_rules');

/**
 * Na ativação: cria as tabelas, fixa a estrutura de links idêntica à do Wix
 * (/post/slug, /blog/categories/slug, /blog/hashtags/slug) e cria as páginas
 * que existiam no site antigo, para que seus endereços continuem válidos.
 */
function cj_core_activate(): void
{
    CJ_Chatbot::install_tables();
    CJ_Importador_Wix::install_tables();

    update_option('permalink_structure', '/post/%postname%');
    // Mesmas bases do Wix: /artigos/categories/… e /artigos/tags/….
    update_option('category_base', 'artigos/categories');
    update_option('tag_base', 'artigos/tags');

    // Endereços herdados do Wix: /publique e /sobre eram páginas da revista.
    // /publique continua sendo as normas da revista (dentro do acervo); a editora
    // recebe originais em /publique-seu-livro.
    $pages = [
        'sobre'              => 'Sobre a editora',
        'publique-seu-livro' => 'Publique seu livro',
        'numerosanteriores'  => 'Revista Capital Jurídico — acervo histórico',
        'publique'           => 'Normas para publicação da Revista Capital Jurídico',
        'artigos'            => 'Artigos da Revista Capital Jurídico',
        'expediente'         => 'Expediente da Revista Capital Jurídico',
        'lancamentos'        => 'Lançamentos',
        'contato'            => 'Contato',
        'politica-de-privacidade' => 'Política de privacidade',
    ];
    foreach ($pages as $slug => $title) {
        if (!get_page_by_path($slug)) {
            wp_insert_post([
                'post_type'   => 'page',
                'post_status' => 'publish',
                'post_name'   => $slug,
                'post_title'  => $title,
                'post_content' => '',
            ]);
        }
    }
    $blog = get_page_by_path('artigos');
    if ($blog && !get_option('page_for_posts')) {
        update_option('page_for_posts', $blog->ID);
    }
    if (!get_option('page_on_front')) {
        // A página inicial é desenhada pelo tema (front-page.php); basta existir.
        $home = get_page_by_path('inicio') ?: get_post(wp_insert_post([
            'post_type' => 'page', 'post_status' => 'publish', 'post_name' => 'inicio', 'post_title' => 'Início',
        ]));
        update_option('show_on_front', 'page');
        update_option('page_on_front', $home->ID);
    }
    $privacy = get_page_by_path('politica-de-privacidade');
    if ($privacy) {
        update_option('wp_page_for_privacy_policy', $privacy->ID);
    }

    CJ_Livros::register();
    CJ_Revista::register();
    CJ_Hotsites::register();
    CJ_Hotsites::add_rewrite_rules();
    flush_rewrite_rules();
}
