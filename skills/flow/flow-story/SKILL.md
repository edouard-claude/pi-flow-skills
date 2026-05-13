---
name: flow-story
description: "Phase CREATE d'une story : story context engine exhaustif (epic, architecture, project-context, git log, stories voisines). Produit un story file si riche qu'un autre LLM dev peut implémenter sans poser de questions. Update sprint-status.yaml backlog → ready-for-dev. À utiliser pour préparer une story avant /flow-dev."
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-story — context engine (CREATE only)

Tu es developer peer en mode préparation. Tu ne codes pas. Tu rassembles tout le contexte nécessaire pour qu'un autre LLM (ou toi en mode `/flow-dev`) puisse implémenter sans ambiguïté.

## Quand l'utiliser

- Story `backlog` à préparer avant implémentation
- Re-préparation d'une story dont le contexte a évolué
- Première phase du cycle `flow-story → flow-dev → flow-review → flow-commit`

## Inputs (obligatoires)

- `.agents/implementation/sprint-status.yaml` (trouve la story par id)
- L'epic parent dans `.agents/planning/epics/`
- `.agents/planning/architecture.md`
- `.agents/project-context.md`
- `git log -20` (patterns récents, conventions implicites)
- Stories voisines dans `.agents/implementation/stories/` (apprentissages)

## Process

### Step 1 — Discover target story
- Trouve la story `<id>` dans sprint-status
- Si pas trouvée, stop avec liste des stories disponibles
- Si déjà `ready-for-dev` : en mode interactif, demande si refaire ou skip ; **en mode batch (`$FLOW_AUTO=1`), skip silencieusement et exit 0**

### Step 2 — Exhaustive context gathering
**Ne saute aucune source** :
- L'epic parent (full lecture)
- Architecture (sections pertinentes)
- Project-context (conventions, patterns)
- Stories voisines (mêmes composants, leçons)
- Git log : commits récents touchant les fichiers prévus
- Tests existants des composants touchés

### Step 3 — Architecture compliance
Pour chaque composant touché :
- Quel pattern le repo utilise déjà ?
- Quels fichiers UPDATE / CREATE / DELETE ?
- Quels tests existants ne pas casser ?

### Step 4 — Web research (si pertinent)
Si la story touche à une lib externe ou une API tierce, vérifie la doc actuelle (versions, breaking changes récents).

### Step 5 — Produit le story file

`.agents/implementation/stories/story-<id>.md` :

```markdown
---
storyId: story-001-01
epic: epic-001
status: ready-for-dev
size: M
created: <date>
---

# story-001-01 — <titre>

## Description user story
En tant que ..., je veux ..., afin de ...

## Critères d'acceptation
- [ ] Given ..., when ..., then ...

## Contexte
<résumé exhaustif extrait de l'epic, architecture, project-context>

## Files to touch
- CREATE: <path> — <raison>
- UPDATE: <path> — <raison>
- DELETE: <path> — <raison>

## Implementation plan (5-10 étapes)
1. ...

## Tests à écrire / faire passer
- Unit : ...
- Integration : ...
- E2E : ...

## Dev notes (garde-fous)
- Conventions à respecter : <refs project-context>
- Pièges connus : <patterns du repo qui pourraient surprendre>
- Pas dans le scope : <ce qu'on ne touche PAS>

## Change log
- <date> : story created
```

### Step 6 — Update sprint-status
- `backlog` → `ready-for-dev`
- Pas de modification du `currentStory` (réservé à `/flow-dev`)

## Output

- `.agents/implementation/stories/story-<id>.md` créé
- `sprint-status.yaml` mis à jour

## Suite

- `/flow-dev <id>` pour implémenter (lit le story file produit ici)
- Si le contexte est encore flou, refaire `/flow-story <id>` après recueil d'infos

## Mode batch (`$FLOW_AUTO=1`)

Quand cette env var est positionnée (orchestration par `flow-auto/run.sh`) :
- Aucune question utilisateur. Aucun menu.
- Si la story est déjà `ready-for-dev`, exit 0 sans rien faire.
- Sinon, génère le story file et update sprint-status puis exit 0.
- Toute halt condition (story introuvable, dépendance non satisfaite) → message d'erreur clair + exit non-zero pour faire échouer la phase côté run.sh.
