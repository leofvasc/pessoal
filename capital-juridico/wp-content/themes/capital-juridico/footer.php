<footer class="rodape">
    <div class="wrap rodape-grid">
        <div>
            <p class="rodape-logo"><img src="<?php echo esc_url(get_template_directory_uri() . '/assets/img/logo-horizontal-negativo.png'); ?>" width="944" height="200" alt="<?php echo esc_attr(get_bloginfo('name')); ?>"></p>
            <p><?php echo esc_html(cj_opt('cj_chamada')); ?></p>
            <?php if ($cnpj = cj_opt('cj_cnpj')) : ?><p class="miudo">CNPJ <?php echo esc_html($cnpj); ?></p><?php endif; ?>
        </div>
        <div>
            <p class="rodape-titulo">Contato</p>
            <?php if ($e = cj_opt('cj_email')) : ?><p><a href="mailto:<?php echo esc_attr($e); ?>"><?php echo esc_html($e); ?></a></p><?php endif; ?>
            <?php if ($w = cj_whatsapp_url()) : ?><p><a href="<?php echo esc_url($w); ?>" rel="noopener">WhatsApp</a></p><?php endif; ?>
            <?php if ($i = cj_opt('cj_instagram')) : ?><p><a href="<?php echo esc_url($i); ?>" rel="noopener">Instagram</a></p><?php endif; ?>
            <p><?php echo esc_html(cj_opt('cj_endereco')); ?></p>
        </div>
        <div>
            <p class="rodape-titulo">Navegação</p>
            <?php wp_nav_menu(['theme_location' => 'rodape', 'container' => false, 'fallback_cb' => 'cj_menu_padrao', 'depth' => 1]); ?>
        </div>
    </div>
    <div class="wrap miudo rodape-base">
        © <?php echo esc_html(wp_date('Y')); ?> <?php bloginfo('name'); ?>. Todos os direitos reservados.
        <?php if (function_exists('get_privacy_policy_url') && get_privacy_policy_url()) : ?> · <a href="<?php echo esc_url(get_privacy_policy_url()); ?>">Política de privacidade</a><?php endif; ?>
    </div>
</footer>
<?php wp_footer(); ?>
</body>
</html>
