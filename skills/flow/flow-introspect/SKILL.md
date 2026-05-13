---
name: flow-introspect
description: 'Introspection d''un projet existant (brownfield) : documente l''état
  réel + produit project-context.md LLM-optimisé pour nourrir les agents flow suivants.
  À utiliser sur tout projet déjà implémenté avant /flow-prd ou /flow-architecture,
  ou quand l''utilisateur dit ''documente le projet'', ''fais un état des lieux'',
  ''introspect''.'
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-introspect — état des lieux + project-context

Combine deux objectifs BMAD : **document-project** (état lisible humain) + **generate-project-context** (rules LLM-optimized).

## Quand l'utiliser

- Brownfield AVANT toute autre phase flow
- Refonte d'un projet existant
- Reprise d'un projet par un nouvel agent / nouveau dev

## Inputs

- Le repo entier
- Optionnel : briefing utilisateur sur les zones à creuser

## Process

### Phase 1 — Discovery (scan technique)

Inspecte le repo :
- **Stack** : package.json / go.mod / requirements.txt / Cargo.toml
- **Structure** : dossiers racine, organisation modules
- **Points d'entrée** : main, index, hooks, app.ts
- **Conventions** : nommage, organisation, patterns récurrents
- **Auth** : middleware, sessions, tokens, gestion permissions
- **DB** : ORM, migrations, schémas, RLS
- **Tests** : framework, organisation, coverage approximative
- **Scripts** : npm scripts, Makefile, CI/CD
- **Dépendances clés** : top 10 par criticité
- **Migrations / data** : schéma, soft-deletes, multi-tenancy

### Phase 2 — Analysis (interprétation)

Repère :
- **Dette technique** : TODOs, FIXMEs, code commenté, duplications visibles
- **Décisions implicites** : conventions non documentées qu'il faut expliciter
- **Risques** : workers concurrents, secrets en clair, RLS manquante, dépendances obsolètes
- **Patterns à respecter** : structure de routes, gestion d'erreurs, format responses, etc.

### Phase 3 — Synthesis (2 livrables)

#### `.agents/project-context.md` — LLM-optimized (~500-1500 tokens)

Lean, focused sur le **non-obvious**. Sections courtes :
- Stack 1-liner
- Structure (arborescence racine + commentaires)
- Conventions cruciales (RLS, naming, error handling)
- Patterns à respecter (format API responses, auth, etc.)
- Commandes courantes (dev, test, db, etc.)
- Pointeurs vers fichiers réels — **PAS** de copier-coller de code

À charger par tout skill flow ultérieur (story, dev, architecture refonte).

#### `.agents/planning/current-state.md` — Humain (lisible)

- Architecture actuelle (texte ou diagramme ASCII)
- Modules principaux + responsabilités
- Workflows critiques (auth, paiement, etc.)
- Dette technique identifiée (priorisée)
- Décisions implicites à expliciter
- Risques + recommandations

## Suite

Selon le besoin :
- Nouvelle feature → `/flow-prd`
- Refacto majeur → `/flow-architecture`
- Petite tâche → `/flow-quick` (peut lire project-context directement)
- Doute → `/flow-help`
