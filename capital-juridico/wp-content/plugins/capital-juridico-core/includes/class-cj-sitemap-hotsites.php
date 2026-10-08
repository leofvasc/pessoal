<?php
/** Inclui os hotsites publicados (e indexáveis) no sitemap do WordPress. */

if (!defined('ABSPATH')) {
    exit;
}

class CJ_Sitemap_Hotsites extends WP_Sitemaps_Provider
{
    public function __construct()
    {
        $this->name        = 'hotsites';
        $this->object_type = 'hotsites';
    }

    public function get_url_list($page_num, $object_subtype = '')
    {
        $list = [];
        foreach (CJ_Hotsites::published_paths() as $path => $id) {
            if (get_post_meta($id, '_cj_seo_noindex', true)) {
                continue;
            }
            $list[] = ['loc' => home_url('/' . $path), 'lastmod' => get_post_modified_time('c', true, $id)];
        }
        return $list;
    }

    public function get_max_num_pages($object_subtype = '')
    {
        return 1;
    }
}
