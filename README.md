# GTA 6 Watch

Tableau de veille GTA 6 conçu pour centraliser les actualités, qualifier leur provenance et ouvrir rapidement les sources d’origine.

## Architecture actuelle

- tableau de bord, recherche, catégories et favoris ;
- ajout manuel d’une information ;
- registre de 17 sources GTA classées A, B ou C ;
- justification visible du niveau de chaque source ;
- 7 flux RSS/Atom automatiques qui alimentent une file éditoriale privée ;
- trois lots de publication éditoriale quotidiens pour les candidats éligibles ;
- modèle canonique versionné dans `data/canonical-news.json` ;
- projection publique statique générée dans `data/news.json` ;
- onglet **Video News** alimenté par le flux public de la chaîne GTA 6 WATCH ;
- validation locale et dans GitHub Actions avant publication ;
- déploiement explicite vers GitHub Pages dans le workflow de publication ;
- aucun secret ni clé API dans le navigateur.

La fonction de génération de scripts et toute l’intégration Anthropic ont été supprimées. Cette version ne publie ni sur X ni via OpenClaw.

## Politique de qualification

| Niveau | Usage éditorial |
|---|---|
| A | Source officielle. Peut confirmer uniquement ce qu’elle publie directement. |
| B | Source spécialisée ou témoin direct. Vérifier l’original et rechercher une corroboration. |
| C | Détection communautaire. Ne confirme jamais une information à elle seule. |

Le niveau qualifie la provenance générale, pas automatiquement chaque affirmation. Une vidéo YouTube officielle de Rockstar peut confirmer ce qu’elle montre ; un commentaire externe sur cette vidéo reste à vérifier.

## Flux de données

```text
Flux surveillés
→ `data/candidates.json` (jamais public automatiquement)
→ revue éditoriale manuelle ou lot planifié soumis aux règles de source
→ objets canoniques
→ validation (`npm run validate`)
→ projection publique (`npm run build:feed`)
→ validation du flux public
→ commit éventuel de data/news.json
→ déploiement GitHub Pages explicite
```

Les nouveaux candidats restent privés tant qu’ils ne sont pas approuvés. Un objet canonique approuvé reste lui-même privé du flux public tant que `publication.articlePublishedAt` vaut `null`. Les articles historiques déjà publics ont été migrés une seule fois pour préserver le site existant.

Lorsqu’un candidat approuvé correspond au même fait récent qu’un objet canonique, il enrichit cet objet au lieu de créer un nouvel article. Le rapprochement est prudent (même catégorie, fenêtre de 21 jours et forte similarité de titre) ; toutes les URLs et preuves sont conservées. La source au meilleur score devient la référence utilisée par le flux public.

L’artefact GitHub Pages exclut `candidates.json`, le registre canonique, le journal de publication et les éléments rejetés/en attente : ils ne sont pas servis par `gta6-watch.xyz`. Le dépôt GitHub étant public, les candidats versionnés restent toutefois visibles aux personnes ayant accès au dépôt ; une confidentialité stricte exigerait un dépôt ou stockage privé, hors du périmètre statique actuel.

## Publication sur GitHub Pages

1. Créer un dépôt GitHub, idéalement nommé `gta6-watch`.
2. Envoyer tous les fichiers de ce dossier à la racine de la branche `main`.
3. Dans **Settings → Pages**, choisir **GitHub Actions** comme source de publication.
4. Ouvrir **Actions → Publish GTA 6 Watch → Run workflow** pour valider, générer et déployer le flux.
5. Le même workflow publie explicitement GitHub Pages : il ne dépend pas d’une seconde exécution déclenchée par un commit de bot.

L’adresse finale aura généralement cette forme :

```text
https://VOTRE-PSEUDO.github.io/gta6-watch/
```

## Commandes locales

```bash
npm run validate
npm run collect
npm run candidates:validate
npm run candidate:approve -- <candidateId>
npm run candidate:approve -- <candidateId> --publish
npm run candidate:reject -- <candidateId> REJECTED "raison"
npm run build:feed
npm run build:videos
node scripts/validate-content.mjs --public
npm run verify
```

`scripts/fetch-news.mjs` collecte les RSS/Atom dans `data/candidates.json`; il ne modifie jamais `data/news.json`. L’approbation est volontairement manuelle.

`scripts/publish-approved-candidates.mjs` propose d’abord un aperçu sans effet (`npm run publish:batch`), puis peut publier le lot éligible avec `npm run publish:batch -- --publish`. Le workflow **Publish verified GTA 6 news** exécute ce lot à 08:00, 14:00 et 20:00 (heure d’été française), avec un maximum de 12 candidats par lot : sources A/B récentes, ou source C corroborée. Les leaks restent explicitement identifiés.

Le projet n’utilise aucune dépendance npm externe et nécessite Node.js 22 ou plus récent.

## Limites connues

- X ne fournit pas de flux public stable : les comptes X sont intégrés au registre mais pas aspirés automatiquement.
- Les sites sans RSS public restent accessibles comme sources prioritaires mais ne sont pas collectés automatiquement.
- Une source B ou C produit par défaut le statut **À vérifier** ; l’outil ne transforme jamais automatiquement son contenu en information confirmée.
- La collecte GitHub peut être légèrement retardée selon la charge de GitHub Actions.

## Fichiers importants

```text
index.html                         Application autonome
data/sources.json                  Registre et qualification des sources
data/canonical-news.json           Registre canonique et preuves source
data/candidates.json               Découvertes en attente de revue
data/news.json                     Projection publique compatible avec le frontend
data/video-news.json               Dernières vidéos publiques de GTA 6 WATCH
data/publication-log.json          Journal d’idempotence de publication
data/rejected-or-held.json         Éléments rejetés ou en attente
news.schema.json                   Contrat JSON du modèle canonique
scripts/validate-content.mjs       Validation de contenu
scripts/approve-candidate.mjs      Approbation manuelle d’un candidat
scripts/topic-matching.mjs          Rapprochement prudent des mêmes sujets
scripts/reject-candidate.mjs       Rejet ou marquage de doublon
scripts/build-public-feed.mjs      Génération du flux public
scripts/build-video-news.mjs       Génération du flux Video News depuis YouTube
.github/workflows/update-news.yml  Collecte horaire des candidats uniquement
.github/workflows/deploy-pages.yml Publication manuelle du flux et de Pages
```

## Récupération

1. En cas d’échec de validation, GitHub Pages n’est pas déployé. Corriger les données canoniques, puis lancer `npm run verify`.
2. En cas de mauvaise publication, restaurer le commit de données connu sain, relancer `npm run verify`, puis lancer **Publish GTA 6 Watch** manuellement.
3. Ne jamais modifier `data/news.json` à la main : il est généré depuis `data/canonical-news.json`.

## Protection recommandée de `main`

À configurer manuellement dans GitHub : exiger une pull request avec revue avant fusion, exiger que la validation soit verte, bloquer les force-pushes et suppressions, et restreindre les modifications des workflows `.github/workflows/`. Ne pas donner de secrets à un workflow non revu.

## Sécurité éditoriale

Avant toute publication :

1. ouvrir le lien d’origine ;
2. vérifier la date et le contexte ;
3. rechercher une source A ou une corroboration indépendante ;
4. distinguer clairement fait, rumeur, leak et analyse ;
5. ne jamais republier un média leaké sans vérifier les risques légaux et les règles de la plateforme.
