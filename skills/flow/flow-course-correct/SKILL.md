---
name: flow-course-correct
description: 'Navigation de changement majeur en milieu de sprint : pivot, nouvelle
  contrainte, blocage. Analyse l''impact systématique sur PRD/architecture/epics/sprint,
  classe par scope (Minor/Moderate/Major), génère un Sprint Change Proposal avec edit
  proposals concrets. À utiliser dès qu''un changement risque d''invalider le plan.'
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-course-correct — change management

Tu es developer responsable de la navigation du changement. Approche méthodique : trigger → impact analysis → proposal → handoff. Tu ne modifies aucun artefact tant que l'utilisateur n'a pas tranché.

## Quand l'utiliser

- Pivot scope mid-sprint
- Nouvelle contrainte (techno, business, conformité, deadline)
- Blocage qui invalide une story en cours ou à venir
- Demande externe (client, équipe) qui change la donne

## Inputs

- `.agents/planning/prd.md`
- `.agents/planning/architecture.md`
- `.agents/planning/epics/*.md`
- `.agents/implementation/sprint-status.yaml`
- `.agents/project-context.md` (si brownfield)
- **Le changement signalé par l'utilisateur** (le trigger)

## Process — change management checklist

### Step 1 — Capture trigger
Demande à l'utilisateur :
- Nature du changement (1 phrase)
- Origine (technique, business, externe)
- Urgence (bloquant immédiat, prochaine itération, futur lointain)
- Découvert quand / comment

### Step 2 — Mode de travail
"Tu veux : (a) **Incremental** — on examine chaque artefact un par un, (b) **Batch** — j'analyse tout, je présente un seul proposal global ?"

### Step 3 — Impact analysis systématique

Pour chaque artefact, évalue **impact = none / minor / moderate / major** :

| Artefact | Impact | Sections touchées | Justification |
|----------|--------|-------------------|---------------|
| PRD | ? | ? | ? |
| Architecture | ? | ? | ? |
| Epics | ? | ? (lesquels) | ? |
| Stories (sprint-status) | ? | ? (lesquelles) | ? |
| Project-context | ? | ? | ? |

### Step 4 — Scope classification

| Scope | Critère | Handoff |
|-------|---------|---------|
| **Minor** | 1-2 stories ajustées, pas de change PRD/architecture | Direct `/flow-story` ou `/flow-quick` |
| **Moderate** | Plusieurs stories impactées, sections PRD/archi à reviser | `/flow-prd` ou `/flow-epics` puis `/flow-sprint` |
| **Major** | PRD invalidé, refonte archi, scope change majeur | `/flow-brief` ou `/flow-prd` from scratch |

### Step 5 — Edit proposals (format old → new)

Pour chaque artefact impacté, propose des modifications **concrètes** :

```
**Artefact** : .agents/planning/prd.md
**Section** : Scope > IN
**Old**:
> - Feature X livrée en v1
**New**:
> - Feature X reportée en v2 (décision course-correct <date>)
**Raison** : <changement signalé>
```

### Step 6 — Sprint Change Proposal

Génère `.agents/implementation/sprint-change-proposal-<date>.md` :

```markdown
---
date: <date>
trigger: <résumé>
scope: minor | moderate | major
---

# Sprint Change Proposal — <date>

## Issue Summary
<1-2 paragraphes>

## Impact Analysis
<tableau des artefacts impactés>

## Recommended Approach
<reco argumentée en 5-10 lignes>

## Detailed Changes
<liste des edit proposals old → new>

## Implementation Handoff
- Skill suivant : `/flow-<nom>`
- Stories impactées dans sprint-status : <ids>
- Validations utilisateur nécessaires : <liste>
```

### Step 7 — Validation utilisateur
Présente le proposal. Demande validation explicite avant toute modification.

## Output

- `.agents/implementation/sprint-change-proposal-<date>.md` (créé)
- **Aucune autre modification** tant que l'utilisateur ne valide pas

## Suite

Selon scope :
- Minor → `/flow-story` ou `/flow-quick`
- Moderate → `/flow-epics` puis `/flow-sprint`
- Major → `/flow-prd` (et probablement `/flow-architecture`)

Puis update `sprint-status.yaml` avec les nouveaux statuses (stories obsolètes → `cancelled` ou retirées).
