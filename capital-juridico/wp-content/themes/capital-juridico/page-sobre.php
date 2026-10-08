<?php
/**
 * /sobre — a editora: texto editável da página, editor-chefe e mantenedora
 * (dados em Configurações → Capital Jurídico).
 */
get_header();
$foto = (int) cj_opt('cj_editor_foto');
?>
<main id="conteudo" class="wrap pagina">
    <?php while (have_posts()) : the_post(); ?>
        <p class="sobretitulo">Editora</p>
        <h1 class="pagina-titulo"><?php the_title(); ?></h1>
        <div class="conteudo">
            <?php if (trim(get_the_content()) !== '') : the_content(); else : ?>
                <p><?php echo esc_html(cj_opt('cj_apresentacao')); ?></p>
            <?php endif; ?>
        </div>
    <?php endwhile; ?>

    <?php if ($nome = cj_opt('cj_editor_chefe')) : ?>
    <section class="pessoa" aria-labelledby="editor-chefe">
        <hr class="cj-rule cj-rule--hairline">
        <p class="sobretitulo" id="editor-chefe">Editor-chefe</p>
        <div class="pessoa-corpo">
            <?php if ($foto) : echo wp_get_attachment_image($foto, 'medium', false, ['class' => 'pessoa-foto', 'alt' => $nome]); endif; ?>
            <div>
                <h2 class="pessoa-nome"><?php echo esc_html($nome); ?></h2>
                <p class="pessoa-bio"><?php echo esc_html(cj_opt('cj_editor_bio')); ?></p>
                <?php if ($l = cj_opt('cj_editor_lattes')) : ?><p><a href="<?php echo esc_url($l); ?>" rel="noopener">Currículo</a></p><?php endif; ?>
            </div>
        </div>
    </section>
    <?php endif; ?>

    <?php if (cj_opt('cj_mantenedora')) : ?>
    <section class="pessoa" aria-labelledby="mantenedora">
        <hr class="cj-rule cj-rule--hairline">
        <p class="sobretitulo" id="mantenedora">Mantenedora</p>
        <p class="pessoa-bio"><?php echo cj_mantenedora_html(); // phpcs:ignore -- escapado na função. ?></p>
    </section>
    <?php endif; ?>
</main>
<?php get_footer();
