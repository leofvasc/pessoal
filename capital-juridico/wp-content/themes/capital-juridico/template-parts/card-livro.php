<?php
/** Cartão de livro no catálogo. */
$id = get_the_ID();
$acoes = class_exists('CJ_Livros') ? CJ_Livros::acoes($id) : [];
?>
<article class="livro-card">
    <a class="livro-capa" href="<?php the_permalink(); ?>">
        <?php if (has_post_thumbnail()) :
            the_post_thumbnail('cj-capa', ['loading' => 'lazy']);
        else : ?>
            <span class="capa-vazia"><?php the_title(); ?></span>
        <?php endif; ?>
    </a>
    <div class="livro-info">
        <h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
        <?php if ($a = cj_autoria_curta($id)) : ?>
            <p class="livro-autor"><?php echo esc_html($a); ?></p>
        <?php endif; ?>
        <ul class="selos">
            <?php foreach ($acoes as $ac) : ?>
                <li class="selo selo-<?php echo esc_attr($ac['tipo']); ?>"><?php echo esc_html($ac['tipo'] === 'download' ? 'Gratuito' : $ac['label']); ?></li>
            <?php endforeach; ?>
        </ul>
    </div>
</article>
