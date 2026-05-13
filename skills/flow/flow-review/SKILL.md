---
name: flow-review
description: "Phase REVIEW d'une story : adversarial parallel avec 3 reviewers (Blind Hunter, Edge Case Hunter, Acceptance Auditor), triage des findings en Blockers/Should-fix/Nice-to-have/Noise, action items [AI-Review] ajoutés au story file si retravail. Update sprint-status review → done OU review → in-progress. À utiliser après /flow-dev."
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-review — adversarial parallel

Tu joues trois reviewers en parallèle dans ta tête, puis tu synthétises. Pas de complaisance avec ton propre code de tout à l'heure — tu lis le diff comme si tu le découvrais.

## Quand l'utiliser

- Story `review` dans sprint-status après `/flow-dev`
- Avant `/flow-commit`

## Inputs (obligatoires)

- `.agents/implementation/stories/story-<id>.md` (avec File List + Dev Notes)
- Le diff git récent (`git diff` sur les fichiers de la File List)
- `.agents/project-context.md`
- `.agents/planning/architecture.md` pour vérification compliance

## Process

### Step 1 — Charge le contexte
- Lis le story file complet (AC, Implementation Plan, Dev Notes)
- Lis le diff des fichiers touchés
- Lis les tests ajoutés/modifiés

### Step 2 — Trois angles de review en parallèle

#### Blind Hunter
Lit le diff sans relire le story file. Cherche bugs, comportements suspects, code smells, mauvais nommage. Posture : "je n'ai aucun contexte, je vois quoi ?"

#### Edge Case Hunter
Énumère systématiquement les edge cases :
- Inputs vides / null / undefined / negative / overflow
- Concurrence (workers, transactions, races)
- Erreurs réseau, timeouts, partial failures
- Permissions / RLS / multi-tenancy
- Migration de données (anciens enregistrements)

Pour chaque edge case : est-il couvert ? testé ?

#### Acceptance Auditor
Pour chaque AC du story file, vérifie qu'elle est **réellement** satisfaite par le code (pas juste un test qui passe par hasard). Pose la question : "si je dois démontrer ça à un PM, le code fait-il ce qui est promis ?"

### Step 3 — Triage findings

Classe **chaque** finding :
- **Blockers** : must-fix avant `done`
- **Should-fix** : à corriger sauf justification écrite
- **Nice-to-have** : tag debt log, pas bloquant
- **Noise** : à ignorer (faux positif, hors scope story)

### Step 4 — Action items

#### Si **blockers ou should-fix** présents
Ajoute en bas du story file une section :
```markdown
## [AI-Review] Action items — <date>

### Blockers
- [ ] <description précise + fichier:ligne si pertinent>

### Should-fix
- [ ] <description>

### Nice-to-have (debt)
- [ ] <description>
```

Update sprint-status : `review` → `in-progress` (retour `/flow-dev` pour traiter les items).

#### Si **clean** (uniquement nice-to-have éventuels)
Ajoute une section **Senior Review** au story file :
```markdown
## Senior Review — <date>

- Blind Hunter : <synthèse — RAS ou notes>
- Edge Case Hunter : <synthèse>
- Acceptance Auditor : <synthèse>

**Verdict** : approved.
```

Update sprint-status : `review` → reste `review` (en attente de `/flow-commit`).

## Output

- Story file enrichi (Action items OU Senior Review)
- sprint-status mis à jour selon verdict

## Suite

- Verdict **clean** → `/flow-commit <id>`
- Items à traiter → `/flow-dev <id>` (cycle dev/review jusqu'à clean)
- Blocker majeur identifié → `/flow-course-correct`
