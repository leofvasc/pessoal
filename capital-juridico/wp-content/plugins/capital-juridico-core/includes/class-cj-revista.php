<?php
/**
 * Acervo da Revista Capital Jurídico.
 *
 * Os artigos são posts comuns do WordPress, publicados em /post/slug — o mesmo
 * endereço que tinham no Wix. Cada número da revista é um termo da taxonomia
 * "Edições" (/revista/edicao/numero-01), com capa, data e PDF.
 */

if (!defined('ABSPATH')) {
    exit;
}

class CJ_Revista
{
    public static function init(): void
    {
        add_action('init', [__CLASS__, 'register']);
        add_action('cj_edicao_add_form_fields', [__CLASS__, 'term_fields_new']);
        add_action('cj_edicao_edit_form_fields', [__CLASS__, 'term_fields_edit']);
        add_action('created_cj_edicao', [__CLASS__, 'term_save']);
        add_action('edited_cj_edicao', [__CLASS__, 'term_save']);
        add_action('add_meta_boxes', [__CLASS__, 'meta_boxes']);
        add_action('save_post_post', [__CLASS__, 'save_post'], 10, 1);
    }

    public static function register(): void
    {
        register_taxonomy('cj_edicao', 'post', [
            'labels' => [
                'name'          => 'Edições da Revista',
                'singular_name' => 'Edição',
                'add_new_item'  => 'Adicionar edição',
                'edit_item'     => 'Editar edição',
                'menu_name'     => 'Edições da Revista',
            ],
            'hierarchical'      => true,
            'public'            => true,
            'show_admin_column' => true,
            'show_in_rest'      => true,
            'rewrite'           => ['slug' => 'revista/edicao', 'with_front' => false],
        ]);
    }

    public static function term_field_defs(): array
    {
        return [
            ['key' => 'cj_numero', 'label' => 'Número', 'type' => 'number', 'help' => 'Usado para ordenar as edições.'],
            ['key' => 'cj_periodo', 'label' => 'Período / data', 'placeholder' => 'dezembro de 2020'],
            ['key' => 'cj_capa', 'label' => 'Capa', 'type' => 'media'],
            ['key' => 'cj_pdf', 'label' => 'PDF da edição (arquivo)', 'type' => 'media'],
            ['key' => 'cj_pdf_link', 'label' => 'PDF da edição (link externo)', 'type' => 'url'],
        ];
    }

    public static function term_fields_new(): void
    {
        foreach (self::term_field_defs() as $f) {
            echo '<div class="form-field"><table>';
            cj_field($f, '');
            echo '</table></div>';
        }
    }

    public static function term_fields_edit(WP_Term $term): void
    {
        foreach (self::term_field_defs() as $f) {
            cj_field($f, get_term_meta($term->term_id, $f['key'], true));
        }
    }

    public static function term_save(int $term_id): void
    {
        if (!current_user_can('manage_categories')) {
            return;
        }
        foreach (self::term_field_defs() as $f) {
            if (!isset($_POST[$f['key']])) {
                continue;
            }
            $raw   = wp_unslash($_POST[$f['key']]);
            $value = ($f['type'] ?? '') === 'url' ? esc_url_raw($raw) : sanitize_text_field($raw);
            update_term_meta($term_id, $f['key'], $value);
        }
    }

    /** Lista de edições com os dados que o tema usa, da mais recente à mais antiga. */
    public static function edicoes(): array
    {
        $terms = get_terms(['taxonomy' => 'cj_edicao', 'hide_empty' => false]);
        if (is_wp_error($terms)) {
            return [];
        }
        $out = [];
        foreach ($terms as $t) {
            $capa = (int) get_term_meta($t->term_id, 'cj_capa', true);
            $pdf  = (int) get_term_meta($t->term_id, 'cj_pdf', true);
            $out[] = [
                'term'    => $t,
                'numero'  => (int) get_term_meta($t->term_id, 'cj_numero', true),
                'periodo' => get_term_meta($t->term_id, 'cj_periodo', true),
                'capa'    => $capa ? wp_get_attachment_image_url($capa, 'large') : '',
                'pdf'     => $pdf ? wp_get_attachment_url($pdf) : get_term_meta($t->term_id, 'cj_pdf_link', true),
                'url'     => get_term_link($t),
            ];
        }
        usort($out, fn($a, $b) => $b['numero'] <=> $a['numero']);
        return $out;
    }

    /** Campos de autoria do artigo, preservados do site antigo. */
    public static function meta_boxes(): void
    {
        add_meta_box('cj_artigo', 'Dados do artigo', function (WP_Post $post) {
            wp_nonce_field('cj_artigo', 'cj_artigo_nonce');
            echo '<table class="form-table" role="presentation">';
            cj_field(['key' => '_cj_autor_artigo', 'label' => 'Autoria exibida', 'help' => 'Nome(s) dos autores como devem aparecer no artigo. Se vazio, usa o usuário do WordPress.'], get_post_meta($post->ID, '_cj_autor_artigo', true));
            cj_field(['key' => '_cj_referencia', 'label' => 'Referência (ABNT)', 'type' => 'textarea', 'rows' => 3, 'help' => 'Opcional. Se vazio, a referência do bloco "Como citar" é montada automaticamente; confira sobrenomes compostos.'], get_post_meta($post->ID, '_cj_referencia', true));
            cj_field(['key' => '_cj_url_wix', 'label' => 'Endereço no site antigo', 'type' => 'url', 'help' => 'Preenchido pelo importador. Serve de registro da migração.'], get_post_meta($post->ID, '_cj_url_wix', true));
            echo '</table>';
        }, 'post', 'side');
    }

    public static function save_post(int $post_id): void
    {
        if (!cj_can_save($post_id, 'cj_artigo')) {
            return;
        }
        cj_save_fields($post_id, [
            ['key' => '_cj_autor_artigo'],
            ['key' => '_cj_referencia', 'type' => 'textarea'],
            ['key' => '_cj_url_wix', 'type' => 'url'],
        ]);
    }
}
