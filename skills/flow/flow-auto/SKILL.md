---
name: flow-auto
description: "Orchestrateur qui boucle sur toutes les stories ready-for-dev du sprint dans l'ordre, en enchaînant /flow-story → /flow-dev → /flow-review → /flow-commit avec une nouvelle session Pi pour chaque story (équivalent /clear). Skill = doc + run.sh compagnon. Lance: bash ~/.pi/agent/skills/flow/flow-auto/run.sh"
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-auto — orchestration multi-stories

Ce skill n'est **pas exécuté par le LLM** au sens classique. C'est un point de documentation pour le **script bash compagnon** qui pilote Pi en mode `--print --no-session` pour boucler sur les stories du sprint.

## Concept

Un skill Pi est du texte d'instructions, pas un programme. Pour orchestrer plusieurs invocations Pi (incluant `/clear` entre chaque), il faut un **script externe** qui lance Pi en mode non-interactif.

## Le script compagnon

`~/.pi/agent/skills/flow/flow-auto/run.sh`

Pour chaque story `ready-for-dev` (ou `backlog` avec dépendances satisfaites) :
1. `pi --print --no-session "/flow-story <id>"`
2. `pi --print --no-session "/flow-dev <id>"`
3. `pi --print --no-session "/flow-review <id>"`
4. `pi --print --no-session "/flow-commit <id>"`

`--no-session` = session ephémère = équivalent `/clear` entre chaque appel.

La boucle s'arrête quand :
- Plus aucune story `ready-for-dev` ni `backlog` avec dépendances satisfaites
- Une étape échoue (sortie pi != 0)
- Une story passe en `blocked`

## Lancement

```bash
bash ~/.pi/agent/skills/flow/flow-auto/run.sh [chemin/sprint-status.yaml]
```

Argument par défaut : `.agents/implementation/sprint-status.yaml`

## Pré-requis

- `sprint-status.yaml` à jour (lance `/flow-sprint` avant si nécessaire)
- Skills `flow-story`, `flow-dev`, `flow-review`, `flow-commit` installés
- Pi installé (`/opt/homebrew/bin/pi` ou équivalent)
- `uvx` pour parser le YAML (auto-installé via PEP 723 du script)

## Garanties / non-garanties

**Garantit** :
- Ordre respecté (tri topologique des dépendances)
- Une story complète = 1 cycle Pi entier (CREATE → DEV → REVIEW → COMMIT)
- Context frais entre stories (--no-session)

**Ne garantit pas** :
- Que `/flow-dev` finisse sans halt condition (humain peut être sollicité)
- Que `/flow-review` valide du premier coup (cycle dev↔review possible)
- Que les commits soient pushés (jamais sans demande explicite)

## Quand préférer manuel

- Première story d'un projet (calibre les attentes)
- Story avec halt conditions probables (décisions ambiguës)
- Demande de validation humaine entre chaque phase

`flow-auto` est fait pour le **batch** de stories straightforward, pas pour des stories nécessitant supervision rapprochée.

## Suite

- Run terminé sans erreur → `/flow-retro` si epic complet
- Halt en cours de route → reprise manuelle avec `/flow-dev` ou `/flow-review`
- Tout fini → `/flow-help` pour décider de la suite
