<?php
/**
 * /contato — exibe automaticamente os contatos cadastrados em
 * Configurações → Capital Jurídico, seguidos do texto opcional da página.
 */
get_header();
$email = cj_opt('cj_email');
$whats = cj_whatsapp_url('Olá! Gostaria de falar com a Editora Capital Jurídico.');
$insta = cj_opt('cj_instagram');
$ender = cj_opt('cj_endereco');
?>
<main id="conteudo" class="wrap pagina">
    <?php while (have_posts()) : the_post(); ?>
        <p class="sobretitulo">Editora</p>
        <h1 class="pagina-titulo"><?php the_title(); ?></h1>
        <dl class="dados dados--contato">
            <?php if ($email) : ?><dt>E-mail</dt><dd><a href="mailto:<?php echo esc_attr($email); ?>"><?php echo esc_html($email); ?></a></dd><?php endif; ?>
            <?php if ($whats) : ?><dt>WhatsApp</dt><dd><a href="<?php echo esc_url($whats); ?>" rel="noopener"><?php echo esc_html(cj_opt('cj_whatsapp')); ?></a></dd><?php endif; ?>
            <?php if ($insta) : ?><dt>Instagram</dt><dd><a href="<?php echo esc_url($insta); ?>" rel="noopener"><?php echo esc_html(preg_replace('#^https?://(www\.)?instagram\.com/#', '@', rtrim($insta, '/'))); ?></a></dd><?php endif; ?>
            <?php if ($ender) : ?><dt>Endereço</dt><dd><?php echo esc_html($ender); ?></dd><?php endif; ?>
        </dl>
        <?php if (!$email && !$whats && !$insta) : ?>
            <p class="aviso">Cadastre os contatos em Configurações → Capital Jurídico.</p>
        <?php endif; ?>
        <?php if (trim(get_the_content()) !== '') : ?><div class="conteudo"><?php the_content(); ?></div><?php endif; ?>
        <?php if ($m = cj_mantenedora_html()) : ?><p class="miudo"><?php echo $m; // phpcs:ignore -- escapado na função. ?></p><?php endif; ?>
    <?php endwhile; ?>
</main>
<?php get_footer();
