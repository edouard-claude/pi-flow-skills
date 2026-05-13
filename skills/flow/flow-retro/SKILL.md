---
name: flow-retro
description: Retrospective de fin d'epic en party mode (dialogues multi-rôles), avec
  critical readiness exploration et préparation de l'epic suivant. Capture les leçons,
  met à jour project-context.md, génère action items. À utiliser quand toutes les
  stories d'un epic sont done.
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-retro — retrospective + préparation epic suivant

Tu animes en **party mode** : tous les échanges au format `Name (Role): dialogue`. L'utilisateur est participant actif, pas spectateur. Psychological safety est sacrée — focus sur les systèmes, pas les blâmes.

## Quand l'utiliser

- Toutes stories d'un epic sont `done` dans sprint-status
- L'utilisateur dit 'retro', 'bilan epic'
- À la transition entre deux epics

## Inputs (deep dive requis)

- `.agents/implementation/sprint-status.yaml`
- `.agents/planning/epics/<epic-completed>.md`
- `.agents/implementation/stories/story-<epic>-*.md` (toutes les stories de l'epic, **lire les Dev Notes**)
- `.agents/implementation/retro-epic-<previous>.md` si présent (continuité)
- `.agents/planning/prd.md` + `.agents/planning/architecture.md`
- `git log` depuis le début de l'epic

## Process — 12 steps avec party mode

### Step 1 — Epic discovery
- Identifie l'epic terminé via sprint-status
- Confirme avec l'utilisateur : "On retro epic-NNN <titre> ?"

### Step 2 — Deep story analysis
Pour chaque story de l'epic :
- Dev notes (challenges, décisions)
- Review feedback (`[AI-Review]` items résolus)
- Patterns récurrents
- Dette technique identifiée
- Tests : coverage, gaps

### Step 3 — Previous retro follow-through
Si une retro précédente existe :
- Quels action items ont été suivis ?
- Lesquels sont restés ouverts ?
- Pourquoi ?

### Step 4 — Next epic preview
Si un epic suivant est défini :
- Dépendances avec l'epic qui se termine
- Gaps identifiés (manque archi, refs manquantes)
- Prérequis à mettre en place

### Step 5 — Initialize retro
Init `.agents/implementation/retro-epic-<NNN>-<date>.md` avec contexte chargé.

### Step 6 — Discussion epic review (party mode)

Anime trois sections, **dialogues format `Name (Role): dialogue`** :

#### What Went Well
```
Alex (Tech Lead): On a livré les 8 stories sans déraper sur le scope. Le pattern auth de l'epic précédent a payé.
You (PO): Effectivement, et la décision de checkpoint mid-epic a évité de re-faire X.
```

#### Challenges
```
Sam (Developer): La story-003 a sous-estimé la complexité du multi-tenancy. On a pris 3 jours au lieu d'1.
Alex (Tech Lead): Vrai. Notre archi avait sous-spécifié les RLS policies.
```

#### Patterns
```
Sam (Developer): J'ai vu 3 fois le même bout de logique répliqué entre stories. Candidat refacto.
You (PO): On le tag pour l'epic suivant ?
```

L'utilisateur intervient librement, peut prendre n'importe quel rôle ou parler en son nom.

### Step 7 — Next epic preparation (interactive)
Discussion ouverte, debate autorisé :
- L'epic suivant est-il bien cadré ?
- Risques anticipés ?
- Ce qu'on emporte de l'epic actuel (patterns, dette à payer) ?

### Step 8 — Synthesize action items
Catégorise :
- **Process** (changement de méthode pour epic suivant)
- **Tech debt** (à payer dans epic suivant ou tagger)
- **Documentation** (project-context à enrichir)
- **Skills** (apprentissages à formaliser)

### Step 9 — Critical readiness exploration
Avant de passer à l'epic suivant, check 5 dimensions :
- **Testing** : coverage suffisante ? Tests E2E en place ?
- **Deployment** : prod-ready ? Rollback plan ?
- **Stakeholder acceptance** : valid utilisateur final / client ?
- **Tech health** : monitoring, alertes, perf metrics OK ?
- **Blockers** : dépendances externes résolues ?

Si un point n'est pas vert, propose une story de stabilisation avant l'epic suivant.

### Step 10 — Closure
Célébration courte mais sincère. Reconnaissance des wins.

### Step 11 — Save + update artifacts
- `.agents/implementation/retro-epic-<NNN>-<date>.md` finalisé
- **Update `.agents/project-context.md`** si patterns émergents (conventions à graver pour les agents suivants)
- Update sprint-status : tag epic comme `retrospected`

### Step 12 — Final summary + handoff
Résumé en 5 lignes :
- 2-3 wins
- 2-3 challenges + actions
- Reco pour la suite

## Output

- `.agents/implementation/retro-epic-<NNN>-<date>.md`
- `.agents/project-context.md` mis à jour si patterns identifiés
- `sprint-status.yaml` taggé

## Suite

- Epic suivant prêt → `/flow-sprint` puis `/flow-story <next-id>`
- Critical readiness rouge sur une dimension → `/flow-story` de stabilisation d'abord
- Tous epics terminés → projet livré, ou `/flow-brief` pour la v2
- Changement majeur révélé pendant la retro → `/flow-course-correct`
