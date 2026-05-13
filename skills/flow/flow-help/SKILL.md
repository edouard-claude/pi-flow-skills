---
name: flow-help
description: Point d'entrée du workflow flow. Affiche un dashboard sprint complet (tous epics, toutes stories, statuses) puis recommande la prochaine étape parmi flow-brainstorm, flow-brief, flow-introspect, flow-prd, flow-architecture, flow-epics, flow-sprint, flow-story, flow-dev, flow-review, flow-commit, flow-quick, flow-course-correct, flow-retro, flow-auto. À utiliser pour faire le point, savoir où on en est, ou en début de session.
version: 0.1.2
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-help — dashboard + orientation

Tu es facilitateur peer, pas un menu. Affiche d'abord la vue d'ensemble du sprint, puis raisonne sur les dépendances et propose UNE seule prochaine étape.

## Quand l'utiliser

- Début de session sur un projet flow-driven
- Utilisateur perdu : 'où on en est ?', 'qu'est-ce que je fais maintenant ?'
- Après chaque skill flow, pour décider de la suite
- À tout moment pour avoir l'état du sprint

## Inputs

- `.agents/implementation/sprint-status.yaml` (si présent)
- `.agents/planning/epics/*.md` (titres, structure)
- `.agents/` (toute l'arborescence pour détecter la phase)
- `git log -10` (activité récente)

## Process

### Step 1 — Sprint dashboard (TOUJOURS en premier, si sprint-status.yaml existe)

Lis `.agents/implementation/sprint-status.yaml`. Affiche TOUTES les stories groupées par epic dans l'ordre numérique, avec leur status. **Format strict** :

```
Epic N (<status-epic>)
  <symbole> <id-slug>                 <status>
  <symbole> <id-slug>                 <status>
  ...
```

**Symboles status** :
- `✓` done
- `▶` in-progress / review (en cours)
- `◆` ready-for-dev (prête à attaquer)
- `○` backlog (pas commencée)
- `✗` blocked / cancelled

**Status agrégé de l'epic** (à mettre entre parenthèses après "Epic N") :
- `done` — toutes les stories de l'epic sont done
- `in-progress` — au moins une story est in-progress, review, ou ready-for-dev
- `backlog` — aucune story n'est encore en cours, mais certaines sont done
- `not-started` — toutes les stories sont en backlog

**Alignement** : padding constant sur les ids de story pour que les colonnes status soient alignées. Calcule la largeur max de id-slug + 2 espaces.

**Si pas de sprint-status.yaml** : saute ce step, indique simplement la phase courante.

### Step 2 — Détection de la phase

Détermine la phase via les artefacts présents :
- Aucun `.agents/` + code existant → brownfield, recommande `/flow-introspect`
- Aucun `.agents/` + repo vide → greenfield, recommande `/flow-brainstorm` ou `/flow-brief`
- `product-brief.md` présent, pas de `prd.md` → `/flow-prd`
- `prd.md` présent, pas de `architecture.md` → `/flow-architecture`
- `architecture.md` présent, pas de `epics/` → `/flow-epics`
- `epics/` présent, pas de `sprint-status.yaml` → `/flow-sprint`
- `sprint-status.yaml` avec stories `ready-for-dev`/`backlog` → `/flow-story <id>` ou `/flow-auto`
- Story `in-progress` → `/flow-dev <id>`
- Story `review` → `/flow-review <id>`
- Toutes stories d'un epic `done` mais pas retro → `/flow-retro`
- Signal changement majeur → `/flow-course-correct`

### Step 3 — Gates et priorisation

- Ne recommande jamais une phase sans son prérequis (pas de `flow-architecture` sans PRD, pas de `flow-story` sans sprint-status).
- Privilégie l'option `/flow-auto` quand plusieurs stories sont prêtes en backlog/ready-for-dev (batch mode).
- Si une story est en cours, recommande de finir son cycle avant d'en attaquer une autre.

## Output

Format de sortie en deux blocs :

### Bloc 1 — Dashboard (si sprint en cours)

```
Sprint: <nom> | Stories: <total> | Done: <n> | En cours: <n> | Backlog: <n>

Epic 1 (done)
  ✓ 1-1-init-driver-profile   done
  ✓ 1-2-driver-vehicle        done

Epic 2 (in-progress)
  ✓ 2-1-signup-phone          done
  ▶ 2-2-signup-phone-verify   in-progress
  ◆ 2-3-complete-signup       ready-for-dev
  ○ 2-4-login-email           backlog

Epic 3 (not-started)
  ○ 3-1-...                   backlog
```

### Bloc 2 — Reco (toujours, 4 lignes max)

```
État    : <phase courante + résumé>
Reco    : /flow-<nom> [args]
Pourquoi: <1 phrase>
Sortie  : <artefact attendu>
```

**Ne lance pas le skill suivant.** Propose, l'utilisateur invoque.

## Notes d'implémentation

- Lis `sprint-status.yaml` via Read directement (un seul fichier YAML).
- Pour grouper par epic, parse `story.epic` et trie numériquement (epic-001, epic-002…).
- Pour le slug, utilise l'id complet (`1-1-init-driver-profile` plutôt que `story-001-01`) — cohérent avec ce que voit l'utilisateur dans les noms de fichier.
- Si la liste est très longue (> 50 stories), n'affiche pas les epics 100% done en détail — montre juste "Epic N (done — 8 stories)" en compact.

## Arborescence `.agents/` de référence

```
.agents/
├── planning/
│   ├── brainstorm-<theme>.md
│   ├── product-brief.md
│   ├── current-state.md
│   ├── prd.md
│   ├── architecture.md
│   └── epics/
│       └── epic-XXX.md
├── implementation/
│   ├── sprint-status.yaml
│   ├── stories/
│   │   └── story-XXX.md
│   └── retro-epic-XXX.md
└── project-context.md
```
