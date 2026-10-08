<!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<a class="pular" href="#conteudo">Ir para o conteúdo</a>
<header class="topo">
    <div class="wrap topo-inner">
        <a class="marca" href="<?php echo esc_url(home_url('/')); ?>" rel="home">
            <?php if (has_custom_logo()) :
                echo wp_get_attachment_image(get_theme_mod('custom_logo'), 'medium', false, ['alt' => get_bloginfo('name') . ', página inicial']);
            else : ?>
                <img src="<?php echo esc_url(get_template_directory_uri() . '/assets/img/logo-horizontal-preto.png'); ?>" width="944" height="200" alt="<?php echo esc_attr(get_bloginfo('name')); ?>, página inicial">
            <?php endif; ?>
        </a>
        <button class="menu-toggle" aria-expanded="false" aria-controls="menu-principal">Menu</button>
        <nav id="menu-principal" class="nav" aria-label="Menu principal">
            <?php wp_nav_menu(['theme_location' => 'principal', 'container' => false, 'fallback_cb' => 'cj_menu_padrao', 'depth' => 2]); ?>
        </nav>
    </div>
</header>
