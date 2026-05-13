---
name: flow-quick
description: 'Bypass du pipeline complet flow : intent utilisateur → code livré →
  review, en une boucle. Pour fixes, petites features, ajustements (single user-facing
  goal). À utiliser pour toute tâche < 1 jour de dev, ou quand l''utilisateur dit
  ''fix rapide'', ''petit changement''.'
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-quick — intent vers code en boucle courte

Sweet spot : tâche cadrable en 900-1600 tokens d'intent, single user-facing goal. Pas de PRD, pas d'architecture, pas de story file — juste code propre + commit.

## Quand l'utiliser

- Bug fix circonscrit (1 cause racine identifiable)
- Petite feature (< 1 jour de dev)
- Refacto local (1-2 fichiers)
- Ajustement config / env
- Wiring d'un endpoint existant

**PAS pour** : nouvelle feature majeure, refonte, intégration externe nouvelle, change scope structurel → utiliser le pipeline (`flow-prd` ou `flow-story`).

## Process — step-by-step

### Step 1 — Clarify & route (scope gate)

1. **Lis** `.agents/project-context.md` si présent (conventions à respecter)
2. **Évalue** l'intent : single goal ? sinon, redirige
3. **Pose 2-3 questions max** si ambigu :
   - Comportement attendu précis ?
   - Edge cases qui comptent ?
   - Composants à toucher ou laisser intacts ?
4. **Scope check** : si la conversation révèle un scope > 1 jour ou multi-features, **STOP** et propose `/flow-prd` ou `/flow-story`.

### Step 2 — Plan (5 lignes max)

Plan rapide en 5 lignes :
- Cause racine (si fix)
- Fichiers à toucher
- Approche (1 phrase)
- Tests à ajouter/modifier
- Risques (1 phrase)

Présente, attends OK rapide ou ajustement.

### Step 3 — Implement

- Respecte strictement les conventions du repo (project-context)
- Pas de refacto opportuniste hors scope
- Garde le diff minimal
- Lance les tests existants après modif

### Step 4 — Self-review

- Bugs / edge cases couverts ?
- Conventions respectées ?
- Pas de TODO / code commenté laissé ?
- Tests passent ?

### Step 5 — Commit draft

Propose un message **conventional commits** :
```
type(scope): description courte

[corps optionnel : raison du changement, pas le quoi]
```

## Output

Pas de fichier dans `.agents/`. Juste :
- Le code modifié
- Les tests
- Un draft de commit message

## Halt conditions

Si en cours de route :
- Tu découvres que c'est un bug plus profond → stop, propose `/flow-story` ou `/flow-introspect`
- L'intent change → stop, demande clarification
- Tests existants cassent et c'est non-trivial → stop, escalade

## Suite

Aucune. Si la tâche s'avère plus grosse en cours, stop et propose `/flow-prd` (si nouvelle feature) ou `/flow-story` (si dans un sprint).
