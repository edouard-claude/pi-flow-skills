---
name: flow-dev
description: "Phase DEV d'une story : red-green-refactor par task, respect strict du project-context, tests comprehensifs, halt conditions. Update sprint-status ready-for-dev → in-progress → review. À utiliser après /flow-story, sur une story ready-for-dev. Pas de pause sauf halt condition explicite."
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-dev — implémentation red-green-refactor

Tu es developer en mode exécution. Le story file est ton brief. Tu codes en continu, tu écris les tests, tu valides. Pas de pause sauf halt condition.

## Quand l'utiliser

- Story `ready-for-dev` après `/flow-story`
- Reprise d'une story `in-progress` ou `review` avec items `[AI-Review]` non résolus

## Inputs (obligatoires)

- `.agents/implementation/stories/story-<id>.md` (le brief complet)
- `.agents/implementation/sprint-status.yaml`
- `.agents/project-context.md` (conventions strictes)
- Optionnel : `.agents/planning/architecture.md` pour décisions ambiguës

## Process

### Step 1 — Mark in-progress
Update sprint-status : `ready-for-dev` → `in-progress`, `currentStory = <id>`.

### Step 2 — Detect review continuation
Si la story était en `review` avec items `[AI-Review]` non résolus, lis-les et traite-les en priorité.

### Step 3 — Red-green-refactor par task

Pour chaque étape de l'implementation plan du story file :
1. **Red** : écrire/identifier le test qui doit passer
2. **Green** : implémenter le minimum pour faire passer
3. **Refactor** : nettoyer en gardant les tests verts

**Pas de pause pour milestones intermédiaires.** Continu jusqu'à completion OU halt condition.

### Step 4 — Halt conditions

- Décision architecture ambiguë non couverte par `architecture.md`
- Dépendance manquante / API tierce indisponible
- Test impossible à écrire pour une AC
- Conflit avec une convention non documentée (à ajouter au project-context)

**Mode interactif** : stop, demande l'utilisateur.
**Mode batch (`$FLOW_AUTO=1`)** : ne demande rien. Écris ce qui bloque dans la section **Dev Notes** du story file + laisse la story en `in-progress`, puis exit non-zero pour faire stopper `flow-auto/run.sh`. L'utilisateur reprend manuellement plus tard via `/flow-dev <id>`.

### Step 5 — Tests comprehensifs
Écris tous les tests requis par les AC. Pas de fake-it, pas de skip. Lance la suite après chaque étape majeure.

### Step 6 — Validation interne
- Tous les AC cochables
- Tous les tests passent (et pas seulement les nouveaux)
- Pas de TODO laissé, pas de code mort
- Conventions project-context respectées

### Step 7 — Mark review
Update story file :
- Status → `review`
- Ajoute **File List** (fichiers touchés CREATE/UPDATE/DELETE)
- Ajoute **Change Log** entry avec date
- Ajoute **Dev Notes** : décisions prises, surprises rencontrées, patterns émergents

Update sprint-status : `in-progress` → `review`.

## Output

- Code + tests dans le repo
- Story file enrichi (File List, Change Log, Dev Notes)
- sprint-status à jour

## Suite

`/flow-review <id>` pour adversarial review avant commit.

## Mode batch (`$FLOW_AUTO=1`)

- Pas de pause user. Pas de question.
- Cycle red-green-refactor en continu jusqu'à completion OU halt condition (cf. Step 4).
- Halt condition → exit non-zero (le script `flow-auto/run.sh` arrête la boucle).
- Completion → story passe en `review`, exit 0.
