---
name: flow-commit
description: "Phase COMMIT d'une story : produit un commit conventional-commits (type(scope): description) à partir du story file et du diff, propose au user, applique, puis update sprint-status review → done et identifie la story suivante. À utiliser après /flow-review verdict approved."
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-commit — commit propre + fermeture story

Tu produis un commit qui résume ce que la story a livré, du point de vue de quelqu'un qui lit le git log dans 6 mois. Ni trop court, ni trop bavard.

## Quand l'utiliser

- Après `/flow-review` avec verdict `approved`
- Pour clôturer une story en `review`

## Inputs (obligatoires)

- `.agents/implementation/stories/story-<id>.md` (titre, AC, File List, Senior Review)
- Le diff git stagé ou non stagé (`git status`, `git diff`)
- `.agents/implementation/sprint-status.yaml`

## Process

### Step 1 — Sanity checks
- `git status` : confirme que les fichiers de la File List du story sont bien modifiés
- Si fichiers non listés modifiés : signale et demande (peut-être bug, peut-être oubli File List)
- Si rien à committer : stop, demande à l'utilisateur

### Step 2 — Compose le message

Format **conventional commits** :
```
type(scope): description courte (<= 72 chars)

[corps optionnel : pourquoi, pas le quoi]

Closes story-<id>
```

Règles :
- **type** : `feat` (nouvelle fonctionnalité), `fix` (bug), `refactor`, `chore`, `docs`, `test`, `perf`, `style`
- **scope** : module touché (ex: `auth`, `api`, `worker`, `db`). Optionnel mais recommandé.
- **description** : impératif, minuscules, pas de point final
- **corps** : pourquoi le changement, ce qui a été appris, références (story, PR, issue). Pas le quoi (le diff parle).

### Step 3 — Validation (mode interactif)

Présente le message rédigé. Demande validation explicite :
```
(a) Apply / (b) Edit / (c) Cancel
```

**Mode batch (`$FLOW_AUTO=1`)** : skip la validation. Auto-apply directement (Step 4).

### Step 4 — Apply
- `git add` les fichiers de la File List + `git commit -m "..."` (HEREDOC pour préserver formatting)
- En mode interactif uniquement : si `b`, itère sur le message ; si `c`, stop sans rien commit.

**Ne push pas** sans demande explicite de l'utilisateur — y compris en mode batch. `flow-auto` ne push jamais.

### Step 5 — Update sprint-status

- Status story : `review` → `done`
- `currentStory` → `null`
- Identifie la **prochaine story** prête (`ready-for-dev`, dépendances satisfaites) et la signale dans la sortie

### Step 6 — Check fin d'epic
Si toutes les stories de l'epic sont `done` :
- Signale : "Epic <epic-id> terminé."
- Propose `/flow-retro`

## Output

- Commit appliqué dans git
- sprint-status mis à jour
- Annonce de la story suivante OU fin d'epic

## Suite

- Story suivante → `/flow-story <next-id>` (dans nouvelle session si `/flow-auto`)
- Fin d'epic → `/flow-retro`
- Fin de sprint complet → `/flow-help` pour décider

## Mode batch (`$FLOW_AUTO=1`)

- Pas de menu (a)/(b)/(c). Auto-apply le commit composé.
- Pas de push (jamais).
- Sortie attendue : story en `done` dans sprint-status, exit 0.
- Si rien à committer ou conflit → exit non-zero pour stopper la boucle `flow-auto/run.sh`.
