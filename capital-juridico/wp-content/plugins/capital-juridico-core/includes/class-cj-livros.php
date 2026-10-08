<?php
/**
 * Catálogo de livros da editora: endereço /livros (mesmo do site antigo)
 * e /livros/nome-do-livro para cada obra.
 */

if (!defined('ABSPATH')) {
    exit;
}

class CJ_Livros
{
    public const IMPRESSO = [
        ''            => 'Não há versão impressa',
        'disponivel'  => 'Disponível para compra',
        'esgotado'    => 'Esgotado',
        'pre_venda'   => 'Pré-venda',
    ];

    public const DIGITAL = [
        ''             => 'Não há versão digital',
        'gratuito'     => 'Gratuito (download)',
        'venda'        => 'À venda',
        'indisponivel' => 'Indisponível',
    ];

    public static function init(): void
    {
        add_action('init', [__CLASS__, 'register']);
        add_action('add_meta_boxes', [__CLASS__, 'meta_boxes']);
        add_action('save_post_cj_livro', [__CLASS__, 'save'], 10, 1);
        add_filter('manage_cj_livro_posts_columns', [__CLASS__, 'columns']);
        add_action('manage_cj_livro_posts_custom_column', [__CLASS__, 'column'], 10, 2);
        add_action('pre_get_posts', [__CLASS__, 'archive_order']);
    }

    public static function register(): void
    {
        register_post_type('cj_livro', [
            'labels' => [
                'name'          => 'Livros',
                'singular_name' => 'Livro',
                'add_new'       => 'Adicionar livro',
                'add_new_item'  => 'Adicionar novo livro',
                'edit_item'     => 'Editar livro',
                'all_items'     => 'Catálogo',
                'menu_name'     => 'Livros',
            ],
            'public'       => true,
            'has_archive'  => 'livros',
            'rewrite'      => ['slug' => 'livros', 'with_front' => false],
            'menu_icon'    => 'dashicons-book',
            'menu_position' => 5,
            'supports'     => ['title', 'editor', 'excerpt', 'thumbnail', 'page-attributes'],
            'show_in_rest' => true,
        ]);
        register_taxonomy('cj_area', 'cj_livro', [
            'labels'       => ['name' => 'Áreas do Direito', 'singular_name' => 'Área do Direito'],
            'hierarchical' => true,
            'public'       => true,
            'rewrite'      => ['slug' => 'livros/area', 'with_front' => false],
            'show_in_rest' => true,
            'show_admin_column' => true,
        ]);
    }

    public static function fields(): array
    {
        $hotsites = ['' => '— nenhum —'];
        foreach (get_posts(['post_type' => 'cj_hotsite', 'numberposts' => -1, 'post_status' => ['publish', 'draft']]) as $h) {
            $hotsites[(string) $h->ID] = $h->post_title;
        }
        return [
            ['key' => '_cj_subtitulo', 'label' => 'Subtítulo'],
            ['key' => '_cj_autores', 'label' => 'Autoria', 'help' => 'Ex.: "Fulano de Tal" ou "Fulano de Tal; Beltrana Silva".'],
            ['key' => '_cj_organizadores', 'label' => 'Organização / coordenação'],
            ['key' => '_cj_ano', 'label' => 'Ano de publicação', 'type' => 'number'],
            ['key' => '_cj_edicao_livro', 'label' => 'Edição', 'placeholder' => '1. ed.'],
            ['key' => '_cj_isbn_impresso', 'label' => 'ISBN (impresso)'],
            ['key' => '_cj_isbn_digital', 'label' => 'ISBN (digital)'],
            ['key' => '_cj_doi', 'label' => 'DOI'],
            ['key' => '_cj_paginas', 'label' => 'Número de páginas', 'type' => 'number'],
            ['key' => '_cj_impresso_status', 'label' => 'Versão impressa', 'type' => 'select', 'options' => self::IMPRESSO],
            ['key' => '_cj_impresso_link', 'label' => 'Link de compra (impresso)', 'type' => 'url'],
            ['key' => '_cj_impresso_preco', 'label' => 'Preço (impresso)', 'placeholder' => 'R$ 89,90'],
            ['key' => '_cj_digital_status', 'label' => 'Versão digital', 'type' => 'select', 'options' => self::DIGITAL],
            ['key' => '_cj_digital_arquivo', 'label' => 'Arquivo para download (PDF/EPUB)', 'type' => 'media', 'help' => 'Usado quando a versão digital é gratuita. Também é possível informar um link externo abaixo.'],
            ['key' => '_cj_digital_link', 'label' => 'Link externo (download ou compra do digital)', 'type' => 'url'],
            ['key' => '_cj_digital_preco', 'label' => 'Preço (digital)'],
            ['key' => '_cj_hotsite', 'label' => 'Hotsite de lançamento', 'type' => 'select', 'options' => $hotsites],
            ['key' => '_cj_destaque', 'label' => 'Destaque', 'type' => 'checkbox', 'checkbox_label' => 'Exibir na página inicial'],
        ];
    }

    public static function meta_boxes(): void
    {
        add_meta_box('cj_livro_dados', 'Dados da obra e disponibilidade', function (WP_Post $post) {
            wp_nonce_field('cj_livro', 'cj_livro_nonce');
            echo '<p>A sinopse vai no editor acima; a capa, em "Imagem destacada". A ordem no catálogo segue o campo "Ordem" (Atributos) e, depois, o ano.</p>';
            echo '<table class="form-table" role="presentation">';
            foreach (self::fields() as $f) {
                cj_field($f, get_post_meta($post->ID, $f['key'], true));
            }
            echo '</table>';
        }, 'cj_livro', 'normal', 'high');
    }

    public static function save(int $post_id): void
    {
        if (!cj_can_save($post_id, 'cj_livro')) {
            return;
        }
        cj_save_fields($post_id, self::fields());
    }

    public static function columns(array $cols): array
    {
        $new = [];
        foreach ($cols as $k => $v) {
            $new[$k] = $v;
            if ($k === 'title') {
                $new['cj_impresso'] = 'Impresso';
                $new['cj_digital']  = 'Digital';
            }
        }
        return $new;
    }

    public static function column(string $col, int $post_id): void
    {
        if ($col === 'cj_impresso') {
            echo esc_html(self::IMPRESSO[get_post_meta($post_id, '_cj_impresso_status', true)] ?? '');
        } elseif ($col === 'cj_digital') {
            echo esc_html(self::DIGITAL[get_post_meta($post_id, '_cj_digital_status', true)] ?? '');
        }
    }

    public static function archive_order(WP_Query $q): void
    {
        if (!is_admin() && $q->is_main_query() && ($q->is_post_type_archive('cj_livro') || $q->is_tax('cj_area'))) {
            $q->set('orderby', ['menu_order' => 'ASC', 'date' => 'DESC']);
            $q->set('posts_per_page', 24);
        }
    }

    /**
     * Ações de acesso de um livro, prontas para o tema exibir.
     * Cada item: label, url (ou vazio), tipo (download|compra|aviso), formato.
     */
    public static function acoes(int $post_id): array
    {
        $acoes = [];
        $digital = get_post_meta($post_id, '_cj_digital_status', true);
        $arquivo = (int) get_post_meta($post_id, '_cj_digital_arquivo', true);
        $dlink   = get_post_meta($post_id, '_cj_digital_link', true);
        if ($digital === 'gratuito') {
            $url = $arquivo ? wp_get_attachment_url($arquivo) : $dlink;
            $acoes[] = ['label' => 'Baixar gratuitamente', 'url' => $url, 'tipo' => 'download', 'formato' => 'Digital'];
        } elseif ($digital === 'venda') {
            $preco = get_post_meta($post_id, '_cj_digital_preco', true);
            $acoes[] = ['label' => 'Comprar e-book' . ($preco ? ' · ' . $preco : ''), 'url' => $dlink, 'tipo' => 'compra', 'formato' => 'Digital'];
        } elseif ($digital === 'indisponivel') {
            $acoes[] = ['label' => 'Digital indisponível', 'url' => '', 'tipo' => 'aviso', 'formato' => 'Digital'];
        }

        $impresso = get_post_meta($post_id, '_cj_impresso_status', true);
        $ilink    = get_post_meta($post_id, '_cj_impresso_link', true);
        $ipreco   = get_post_meta($post_id, '_cj_impresso_preco', true);
        if ($impresso === 'disponivel' || $impresso === 'pre_venda') {
            $prefix  = $impresso === 'pre_venda' ? 'Pré-venda do impresso' : 'Comprar impresso';
            $acoes[] = ['label' => $prefix . ($ipreco ? ' · ' . $ipreco : ''), 'url' => $ilink, 'tipo' => 'compra', 'formato' => 'Impresso'];
        } elseif ($impresso === 'esgotado') {
            $acoes[] = ['label' => 'Impresso esgotado', 'url' => '', 'tipo' => 'aviso', 'formato' => 'Impresso'];
        }
        return $acoes;
    }

    /** URL pública do hotsite vinculado, se publicado. */
    public static function hotsite_url(int $post_id): string
    {
        $hid = (int) get_post_meta($post_id, '_cj_hotsite', true);
        if ($hid && get_post_status($hid) === 'publish') {
            return CJ_Hotsites::url($hid);
        }
        return '';
    }
}
