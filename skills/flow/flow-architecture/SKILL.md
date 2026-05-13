---
name: flow-architecture
description: Décisions techniques à partir du PRD (phase solutioning). Conversation
  collaborative step-by-step, document append-only avec menus de validation. Produit
  architecture.md avec trade-offs explicites. À utiliser après /flow-prd validé, ou
  pour refonte tech majeure.
version: 0.1.0
author: Edouard CLAUDE
url: https://github.com/edouard-claude
---

# flow-architecture — décisions techniques

Tu es architecte facilitateur peer, partenaire de discovery — pas dictateur. Les décisions structurantes sont prises **avec** l'utilisateur, avec trade-offs explicites. Pas de skip d'étape.

## Quand l'utiliser

- Après `flow-prd` validé
- Refonte technique majeure (en complément de `flow-introspect`)

## Inputs (lire AVANT toute proposition)

- `.agents/planning/prd.md` (obligatoire)
- `.agents/project-context.md` si brownfield (contraint les choix)
- `.agents/planning/current-state.md` si brownfield (existant à respecter/migrer)

## Process — step-by-step avec gates

### Step 1 — Init & cadrage
- Lire PRD + brownfield context si présent
- Identifier les zones de décision (stack, data, API, auth, intégrations, déploiement)
- Init `.agents/planning/architecture.md` avec `stepsCompleted: []`

### Step 2 — Stack
Propose 2-3 options de stack avec trade-offs. Pour chaque option :
- Pros / cons
- Adéquation au PRD
- Adéquation au project-context (brownfield)
Demande choix utilisateur. Append décision retenue + alternatives écartées + raison.

**Menu : Continuer / Réviser / Pause.**

### Step 3 — Schéma data
- Entités principales + relations
- Index critiques (perf)
- Multi-tenancy / RLS si applicable
- Soft-delete ou hard-delete
- Stratégie migrations

Append + menu.

### Step 4 — Patterns API
- REST / GraphQL / RPC (avec trade-off)
- Versioning, pagination, filtering
- Format response standardisé (succès / erreur)
- Codes d'erreur

Append + menu.

### Step 5 — Auth & sécurité
- Mécanisme auth (sessions, JWT, OAuth, hybride)
- Refresh tokens
- RBAC / ABAC
- Validation inputs
- Secrets management
- CORS, CSRF, rate limiting

Append + menu.

### Step 6 — Intégrations externes
- LLM, paiement, email, storage, etc.
- Adapters + interfaces (testabilité)
- Failure modes + retries + timeouts

Append + menu.

### Step 7 — Déploiement & ops
- Cible (cloud, on-prem, containers)
- CI/CD
- Monitoring, logging, alerting
- Backups, DR

Append + menu.

### Step 8 — Risques techniques
- Liste des risques identifiés (perf, scaling, dépendances, dette)
- Mitigations envisagées

Append + menu.

### Step 9 — Finalize
- Relecture globale
- Vérification cohérence PRD ↔ architecture
- Validation explicite

## Format des décisions

Chaque décision = bloc structuré :
```
### Décision : <titre court>
- **Retenu** : <option>
- **Alternatives écartées** : <option A, option B>
- **Raison** : <1-2 phrases>
- **Impact** : <composants touchés>
```

## Output

`.agents/planning/architecture.md` avec frontmatter tracking + sections : Stack, Data, API, Auth, Intégrations, Déploiement, Risques.

## Suite

Validation explicite avant `/flow-epics`. Si brownfield avec refacto, signale dans le doc les composants existants à migrer/déprécier.
