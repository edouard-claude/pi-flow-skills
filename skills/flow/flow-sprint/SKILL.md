---
name: flow-sprint
description: Sprint planning et state machine de suivi (phase implementation). Génère/met
  à jour sprint-status.yaml avec states backlog/ready-for-dev/in-progress/review/done.
  Detect existing stories pour préserver les statuses. À utiliser après /flow-epics
  ou pour tracker l'avancement.
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-sprint — state machine sprint

Tu es developer responsable du tracking sprint. Tu maintiens un état précis qui sert de source de vérité à `flow-story`, `flow-help`, et `flow-retro`.

## Quand l'utiliser

- Première fois après `flow-epics` (init du sprint)
- Au fil de l'eau pour update les statuses
- Quand `flow-help` ou utilisateur demande "où on en est dans le sprint"

## Inputs

- `.agents/planning/epics/*.md` (obligatoire)
- `.agents/implementation/sprint-status.yaml` si déjà existant (préserve statuses)
- `.agents/implementation/stories/*.md` (détection stories déjà créées)

## Process

### Premier appel (init)

1. **Extract structure** depuis tous les epics :
   - Parse chaque `epic-NNN.md`
   - Extrait stories (epic.story-id, title, dependencies, size)
   - Génère keys kebab-case : `story-001-01`, `story-001-02`, etc.

2. **Build sprint-status.yaml** avec state machine :

```yaml
---
sprint:
  name: <auto-généré ou demandé>
  startedAt: <date>
  currentStory: null

stateMachine:
  - backlog
  - ready-for-dev
  - in-progress
  - review
  - done

stories:
  - id: story-001-01
    epic: epic-001
    title: <titre>
    status: backlog
    dependsOn: []
    size: M
    notes: ""
  - id: story-001-02
    epic: epic-001
    title: <titre>
    status: backlog
    dependsOn: [story-001-01]
    size: S
    notes: ""
```

3. **Détecte stories existantes** : pour chaque story dans `.agents/implementation/stories/<id>.md`, si présent → mettre status au minimum à `ready-for-dev`.

4. **Order d'exécution** : tri topologique selon `dependsOn`.

### Appels suivants (update)

1. Scan `.agents/implementation/stories/` pour détecter nouveaux files
2. Préserve les statuses existants (`done` ne redescend pas)
3. Update `currentStory` sur la story `in-progress` (max 1 à la fois)
4. Identifie blockers (stories `blocked` avec note explicative)
5. Présente la prochaine story à attaquer

## State transitions valides

```
backlog → ready-for-dev   (flow-story CREATE done)
ready-for-dev → in-progress (flow-story DEV start)
in-progress → review       (flow-story DEV done, ready for review)
review → done              (flow-story REVIEW validated)
review → in-progress       (review found issues, back to dev)
any → blocked              (blocker identifié)
blocked → previous state   (blocker résolu)
```

## Output

`.agents/implementation/sprint-status.yaml` créé ou mis à jour.

Affiche aussi un résumé console :
- Total stories / done / in-progress / blocked
- Prochaine story recommandée
- Stories bloquées avec raison

## Suite

- Sprint init → `/flow-story <next-id>` pour démarrer
- Update au fil de l'eau, sans suite obligatoire
- Tous stories d'un epic = `done` → propose `/flow-retro`
