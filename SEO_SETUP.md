# GTA6 Watch — Configuration SEO externe

Les fichiers techniques sont déjà publiés par le site :

- `https://gta6-watch.xyz/robots.txt`
- `https://gta6-watch.xyz/sitemap.xml`

## Google Search Console

1. Ouvrir [Google Search Console](https://search.google.com/search-console/).
2. Ajouter `gta6-watch.xyz` comme propriété de domaine (recommandé).
3. Valider la propriété via l’enregistrement DNS fourni par Google chez le registrar du domaine.
4. Dans **Sitemaps**, soumettre `https://gta6-watch.xyz/sitemap.xml`.
5. Une fois l’outil validé, demander l’indexation de la page d’accueil.

Ne jamais committer de code de vérification avant que Google fournisse sa valeur exacte. La vérification DNS est préférable : elle ne dépend pas du déploiement du site.

## Bing Webmaster Tools

1. Ouvrir [Bing Webmaster Tools](https://www.bing.com/webmasters/).
2. Importer la propriété depuis Search Console, ou la valider via DNS.
3. Soumettre le même sitemap.

## Contrôle mensuel

- Pages indexées et erreurs de crawl ;
- Core Web Vitals ;
- requêtes qui génèrent des impressions ;
- pages avec faible CTR ou titres à améliorer ;
- éventuelles URLs exclues de l’indexation.

La prochaine phase ajoutera une URL statique et indexable par article. À ce stade, le sitemap référence seulement la page publique existante pour ne pas déclarer d’URL qui n’existent pas encore.
