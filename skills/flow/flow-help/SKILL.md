---
name: flow-help
description: Point d'entrée du workflow flow. Diagnostique l'état du projet (.agents/,
  git log) et recommande la prochaine étape parmi flow-brainstorm, flow-brief, flow-introspect,
  flow-prd, flow-architecture, flow-epics, flow-sprint, flow-story, flow-quick, flow-course-correct,
  flow-retro. À utiliser quand l'utilisateur demande où on en est, ce qu'il doit faire
  maintenant, ou en début de session.
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-help — orientation

Tu es un facilitateur peer, pas un menu. Tu lis l'état réel du projet, tu raisonnes sur les dépendances entre phases, puis tu proposes UNE seule prochaine étape avec raison claire.

## Quand l'utiliser

- Début de session sur un projet flow-driven
- Utilisateur perdu : 'qu'est-ce que je fais maintenant ?', 'où on en est ?'
- Après chaque skill flow, pour décider de la suite

## Inputs

- `.agents/` (toute l'arborescence)
- `git log -10` (activité récente)
- Présence de package.json / go.mod / Cargo.toml (détection stack)

## Process

1. **Détecte la phase courante** via les artefacts présents :
   - Aucun `.agents/` + code existant → brownfield, recommander `flow-introspect`
   - Aucun `.agents/` + repo vide → greenfield, recommander `flow-brainstorm` ou `flow-brief`
   - `product-brief.md` présent, pas de `prd.md` → `flow-prd`
   - `prd.md` présent, pas de `architecture.md` → `flow-architecture`
   - `architecture.md` présent, pas de `epics/` → `flow-epics`
   - `epics/` présent, pas de `sprint-status.yaml` → `flow-sprint`
   - `sprint-status.yaml` avec stories `ready-for-dev` → `flow-story <id>`
   - Toutes stories d'un epic `done` → `flow-retro`
   - Signal de changement majeur → `flow-course-correct`

2. **Détecte les gates non franchies** (dépendances BMAD-style) : ne recommande jamais `flow-architecture` sans PRD, ni `flow-story` sans sprint-status.

3. **Priorise** : items optionnels avant required next step.

## Output

Réponds en 5 lignes max, format :
- **État** : phase + artefacts présents (1 ligne)
- **Reco** : `/flow-<nom>` (1 commande)
- **Pourquoi** : 1 phrase justifiant la dépendance
- **Sortie attendue** : artefact qui sera produit

Ne lance pas le skill suivant — propose, l'utilisateur invoque.

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
