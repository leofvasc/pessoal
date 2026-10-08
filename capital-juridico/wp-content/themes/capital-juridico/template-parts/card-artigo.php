<?php /** Cartão de artigo da revista. */ ?>
<article class="artigo-card">
    <?php $ed = get_the_terms(get_the_ID(), 'cj_edicao'); ?>
    <p class="artigo-meta"><?php echo esc_html(get_the_date('d/m/Y')); ?><?php if ($ed && !is_wp_error($ed)) : ?> · <?php echo esc_html($ed[0]->name); ?><?php endif; ?></p>
    <h3><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h3>
    <p class="artigo-autor"><?php echo esc_html(cj_autoria()); ?></p>
    <p><?php echo esc_html(wp_trim_words(get_the_excerpt(), 30, '…')); ?></p>
</article>
