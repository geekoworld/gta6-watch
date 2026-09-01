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
6. Lorsqu’un candidat approuvé décrit le même fait qu’un objet canonique récent, il enrichit cet objet au lieu de créer un second article. Toutes les preuves sont conservées ; la source au score éditorial le plus élevé devient la référence publique.
7. Le rapprochement automatique est volontairement prudent : même catégorie, même période de 21 jours, et titre identique ou forte similarité. En cas de doute, l’éditeur garde deux sujets séparés.

## Cycle de vie des candidats

```text
PENDING → APPROVED → (optionnellement) PUBLISHED
PENDING → REJECTED
PENDING → DUPLICATE
```

- **PENDING** — découverte collectée depuis une source surveillée ; elle n’est jamais publique.
- **APPROVED** — un éditeur a créé ou enrichi un objet canonique. Sans `--publish`, elle reste privée.
- **PUBLISHED** — état dérivé : l’objet canonique possède `publication.articlePublishedAt` après l’approbation explicite `--publish`.
- **REJECTED** — découverte conservée avec une raison éditoriale ; elle n’est pas supprimée.
- **DUPLICATE** — découverte conservée avec une raison et n’ouvre pas un second article.

Chaque transition est ajoutée à `reviewHistory`. Les candidats conservent l’URL brute, l’URL canonique, l’identifiant externe et le hash de contenu de la détection.

## Règles de publication

- Les sources A peuvent confirmer uniquement ce qu’elles déclarent directement.
- Les sources B exigent le lien d’origine ou une corroboration indépendante.
- Les sources C servent à détecter un sujet, jamais à le confirmer seules.
- Les URLs, noms de sources, dates et identifiants externes doivent apparaître dans l’objet canonique avant publication.
- Aucun post X, aucune automatisation OpenClaw, aucun upload Shorts n’est couvert par cette version.
- La collecte horaire ne peut créer que des candidats `PENDING`. Elle ne peut ni approuver ni publier.

## Scores

Les scores `article`, `x` et `shorts` sont des entiers de 0 à 100. Ils sont réservés à une phase ultérieure : une note ne vaut pas approbation.

## Héritage

Les articles qui étaient déjà publics avant ce modèle sont importés une seule fois avec une date de publication existante. Leur URL historique est la meilleure URL disponible dans l’ancien flux; les nouvelles collectes devront conserver l’URL brute à l’origine.
