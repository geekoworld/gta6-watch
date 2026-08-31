# GTA6 Watch — Politique éditoriale

## Statuts canoniques

- **CONFIRMED** — information directement publiée par une source primaire, ou corroborée selon une procédure éditoriale documentée.
- **RUMOR** — information crédible mais non confirmée. L’article doit attribuer explicitement l’affirmation.
- **LEAK** — contenu privé, non publié ou présumé obtenu sans autorisation. Il est placé en attente et ne sera jamais publié automatiquement.
- **THEORY** — analyse, prédiction ou interprétation. Elle ne doit jamais être formulée comme un fait.
- **GUIDE** — information pratique et durable, distincte d’une actualité.

## Règles de preuve

1. Chaque objet canonique possède au moins une preuve source.
2. Chaque preuve conserve son URL brute (`sourceUrlRaw`) et son URL de déduplication (`sourceUrlCanonical`) séparément.
3. Une preuve existante est ajoutée, jamais remplacée ou supprimée par une nouvelle collecte.
4. Les nouveaux objets ont `publication.articlePublishedAt: null` jusqu’à une approbation éditoriale explicite.
5. Le flux public ne contient que les objets dont `articlePublishedAt` est renseigné.

## Règles de publication

- Les sources A peuvent confirmer uniquement ce qu’elles déclarent directement.
- Les sources B exigent le lien d’origine ou une corroboration indépendante.
- Les sources C servent à détecter un sujet, jamais à le confirmer seules.
- Les URLs, noms de sources, dates et identifiants externes doivent apparaître dans l’objet canonique avant publication.
- Aucun post X, aucune automatisation OpenClaw, aucun upload Shorts n’est couvert par cette version.

## Scores

Les scores `article`, `x` et `shorts` sont des entiers de 0 à 100. Ils sont réservés à une phase ultérieure : une note ne vaut pas approbation.

## Héritage

Les articles qui étaient déjà publics avant ce modèle sont importés une seule fois avec une date de publication existante. Leur URL historique est la meilleure URL disponible dans l’ancien flux; les nouvelles collectes devront conserver l’URL brute à l’origine.
