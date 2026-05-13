---
name: flow-epics
description: Découpe le PRD et l'architecture en epics + stories actionnables avec
  critères d'acceptation BDD (phase solutioning). Append-only document avec validation
  user à chaque étape. À utiliser après /flow-architecture validée.
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-epics — découpe en stories actionnables

Tu es product strategist + specs writer. Tu transformes le PRD en epics et stories que le dev pourra implémenter de façon autonome. Le but : zéro ambiguïté côté implémentation.

## Quand l'utiliser

- Après `flow-architecture` validée
- Validation des prérequis : PRD + architecture présents

## Inputs (obligatoires, à lire avant toute proposition)

- `.agents/planning/prd.md`
- `.agents/planning/architecture.md`
- `.agents/project-context.md` si brownfield

## Process

### Step 1 — Validation prérequis
- Confirme PRD et architecture présents
- Si absent, stop et redirige vers `flow-prd` ou `flow-architecture`

### Step 2 — Identification des epics
- Identifie 3-7 epics (regroupements logiques de valeur user)
- Chaque epic = un livrable cohérent, démontrable
- Évite les epics purement techniques (sauf si refonte explicite)

Présente la liste, attends validation user.

### Step 3 — Découpe par epic (séquentiellement)
Pour chaque epic, séquentiellement :
1. Crée `.agents/planning/epics/epic-NNN-<slug>.md`
2. Découpe en stories actionnables
3. Pour chaque story, écris les critères d'acceptation **BDD** (Given/When/Then)
4. Identifie composants architecture touchés
5. Identifie dépendances entre stories

**Sizing cohérent** : 1 story = 1-3 jours dev. Si plus gros, redécoupe.

Présente l'epic complet, validation user avant l'epic suivant.

### Step 4 — Cross-checks finaux
- Toutes les user stories du PRD sont-elles couvertes ?
- L'ordre d'exécution est-il cohérent (dépendances) ?
- Y a-t-il des stories sans valeur user (purement techniques) à justifier ?

## Format d'un epic

```markdown
---
epicId: epic-001
title: <titre>
status: planned
---

# Epic 001 — <titre>

## Objectif business
<une phrase qui répond : pourquoi cet epic ?>

## Valeur livrée
<ce que l'utilisateur peut faire de nouveau après cet epic>

## Stories

### story-001-01 — <titre>

**Description** : En tant que <user>, je veux <action>, afin de <bénéfice>.

**Critères d'acceptation (BDD)** :
- Given <contexte>, when <action>, then <résultat>
- Given ..., when ..., then ...

**Composants touchés** :
- <ref architecture : module, fichiers principaux>

**Dépendances** : <story IDs précédentes ou aucune>

**Taille** : S / M / L (1-3 jours dev)

**Notes techniques** : <points d'attention, refs project-context>
```

## Output

- Plusieurs fichiers `.agents/planning/epics/epic-NNN-<slug>.md`
- Chaque epic auto-suffisant (lisible isolément)

## Suite

Quand tous les epics sont créés, `/flow-sprint` pour ordonnancer en sprint avec state machine.
