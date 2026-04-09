# SME new delivery content

## How to export default content

```
drush dcer node --folder=modules/custom/stepuptours_default_content/content/
drush dcer block_content --folder=modules/custom/stepuptours_default_content/content/
drush dcer taxonomy_term --folder=modules/custom/stepuptours_default_content/content/
drush dcer menu_link_content --folder=modules/custom/stepuptours_default_content/content/
drush dcer media --folder=modules/custom/stepuptours_default_content/content/
drush dcer node nid --folder=modules/custom/stepuptours_default_content/content/
drush dcer block_content bid --folder=modules/custom/stepuptours_default_content/content/
drush dcer taxonomy_term tid --folder=modules/custom/stepuptours_default_content/content/

```
## How to import default content
## This command is based on 2698425 patch of default_content contrib module.

```
 drush dcim stepuptours_default_content
```

```
ddev drush eval "
  foreach (['countries', 'cities'] as \$vocab) {
    \$terms = \Drupal::entityTypeManager()->getStorage('taxonomy_term')->loadByProperties(['vid' => \$vocab]);
    echo strtoupper(\$vocab) . \":\n\";
    foreach (\$terms as \$term) {
      echo '  tid=' . \$term->id() . ' → ' . \$term->label() . \"\n\";
    }
  }
"
```

```
for tid in $(seq 1 160); do
ddev drush dcer taxonomy_term $tid --folder=modules/custom/stepuptours_default_content/content/
done
```
