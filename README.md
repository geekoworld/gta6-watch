# GTA6 Watch

Tableau de veille GTA 6 conçu pour centraliser les actualités, qualifier leur provenance et ouvrir rapidement les sources d’origine.

## Ce que contient cette version

- tableau de bord, recherche, catégories et favoris ;
- ajout manuel d’une information ;
- registre de 17 sources GTA classées A, B ou C ;
- justification visible du niveau de chaque source ;
- 7 flux publics automatiques : Rockstar Games, GTA BOOM et cinq chaînes YouTube ;
- collecte horaire par GitHub Actions ;
- déduplication par URL ;
- filtrage GTA 6 ;
- déploiement statique avec GitHub Pages ;
- aucun secret ni clé API dans le navigateur.

La fonction de génération de scripts et toute l’intégration Anthropic ont été supprimées.

## Politique de qualification

| Niveau | Usage éditorial |
|---|---|
| A | Source officielle. Peut confirmer uniquement ce qu’elle publie directement. |
| B | Source spécialisée ou témoin direct. Vérifier l’original et rechercher une corroboration. |
| C | Détection communautaire. Ne confirme jamais une information à elle seule. |

Le niveau qualifie la provenance générale, pas automatiquement chaque affirmation. Une vidéo YouTube officielle de Rockstar peut confirmer ce qu’elle montre ; un commentaire externe sur cette vidéo reste à vérifier.

## Publication sur GitHub Pages

1. Créer un dépôt GitHub, idéalement nommé `gta6-watch`.
2. Envoyer tous les fichiers de ce dossier à la racine de la branche `main`.
3. Dans **Settings → Pages**, choisir **GitHub Actions** comme source de publication.
4. Ouvrir **Actions → Update GTA 6 news → Run workflow** pour lancer une première collecte.
5. Le workflow **Deploy GTA6 Watch to Pages** publiera ensuite le site.

L’adresse finale aura généralement cette forme :

```text
https://VOTRE-PSEUDO.github.io/gta6-watch/
```

## Mise à jour automatique

Le fichier `scripts/fetch-news.mjs` lit les flux configurés dans `data/sources.json`. GitHub exécute ce collecteur chaque heure et ne crée un commit que si les données ont réellement changé.

Pour lancer la collecte localement :

```bash
npm run fetch
```

Le collecteur n’utilise aucune dépendance externe et nécessite Node.js 22 ou plus récent.

## Limites connues

- X ne fournit pas de flux public stable : les comptes X sont intégrés au registre mais pas aspirés automatiquement.
- Les sites sans RSS public restent accessibles comme sources prioritaires mais ne sont pas collectés automatiquement.
- Une source B ou C produit par défaut le statut **À vérifier** ; l’outil ne transforme jamais automatiquement son contenu en information confirmée.
- La collecte GitHub peut être légèrement retardée selon la charge de GitHub Actions.

## Fichiers importants

```text
index.html                         Application autonome
data/sources.json                  Registre et qualification des sources
data/news.json                     Actualités collectées
scripts/fetch-news.mjs             Collecteur RSS/Atom
.github/workflows/update-news.yml  Collecte horaire
.github/workflows/deploy-pages.yml Publication GitHub Pages
```

## Sécurité éditoriale

Avant toute publication :

1. ouvrir le lien d’origine ;
2. vérifier la date et le contexte ;
3. rechercher une source A ou une corroboration indépendante ;
4. distinguer clairement fait, rumeur, leak et analyse ;
5. ne jamais republier un média leaké sans vérifier les risques légaux et les règles de la plateforme.
