# CONTRIBUTING TO WHATSAPP BOT MONOREPO

Thank you for your interest in contributing to this project. We welcome contributions of all types including feature additions, bug fixes, performance optimizations, documentation improvements, and architectural suggestions.

---

## TABLE OF CONTENTS

- [Core Principles](#core-principles)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Submitting Pull Requests](#submitting-pull-requests)
- [Coding Standards & Conventions](#coding-standards--conventions)
- [Testing Standards](#testing-standards)
- [Reporting Issues](#reporting-issues)
- [Code of Conduct](#code-of-conduct)

---

## CORE PRINCIPLES

1. **Local-First Infrastructure**: All features must function locally without mandatory cloud server dependencies or external SaaS subscriptions.
2. **Zero Hardcoded Secrets**: Secrets, keys, and session data must reside in `.env` or local files. Never commit `.env`, `auth_info/`, `auth_info_baileys/`, or sensitive credentials.
3. **Configurable Adapter Layer**: Remote command integration must route through the configurable `API_BASE_URL` adapter layer rather than hardcoded URLs.
4. **Zero Emoji Directive**: Maintain professional, clean documentation and code comments without emojis across all project files.

---

## GETTING STARTED

### 1. Fork & Clone

Fork the repository on GitHub and clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/whatsapp-bot.git
cd whatsapp-bot
```

### 2. Environment Setup

#### Setting up Version 1 (JavaScript)

```bash
cd V-1
npm install
cp .env.example .env
# Edit .env with your local parameters
```

#### Setting up Version 2 (TypeScript)

```bash
cd V-2
npm install
cp .env.example .env
# Ensure MariaDB server is active on localhost:3306 and import schema:
# mysql -u root -p < sql/schema.sql
```

---

## DEVELOPMENT WORKFLOW

### Branching Strategy

Create a descriptive feature or bugfix branch off the primary branch:

```bash
git checkout -b feature/your-feature-name
# OR
git checkout -b fix/your-bugfix-name
```

### Building & Verification

For Version 1:
Verify syntax check on modified JavaScript files:

```bash
node --check index.js
node --check src/router.js
```

For Version 2:
Build TypeScript and run linter:

```bash
cd V-2
npm run build
npm run lint
```

---

## SUBMITTING PULL REQUESTS

1. Push your branch to your GitHub fork:

   ```bash
   git push origin feature/your-feature-name
   ```

2. Open a Pull Request against the main branch.
3. Provide a clear summary of changes in the PR description:
   - What problem does this PR solve?
   - What changes were made?
   - How was this change tested locally?
4. Ensure CI/CD build checks and unit tests pass without errors.

---

## CODING STANDARDS & CONVENTIONS

### JavaScript (V-1)
- Standard ES Modules (`import`/`export`) syntax.
- Async/await over raw Promises for readability.
- Pino logging for operational events instead of `console.log`.

### TypeScript (V-2)
- Strict mode compilation (`tsconfig.json`).
- Explicit type declarations for function signatures and API parameters.
- Modular adapter pattern in `src/api.ts` for all external REST requests.

---

## TESTING STANDARDS

Version 2 ships with deterministic unit tests located in `V-2/test/`:

```bash
cd V-2
npm test
```

When implementing new features or fixing bugs in V-2, write corresponding unit tests in `V-2/test/` to prevent regressions.

---

## REPORTING ISSUES

When filing an issue, please include:
- Bot version affected (V-1 or V-2).
- Operating system and Node.js version (`node -v`).
- Minimal reproduction steps.
- Sanitized log output (remove phone numbers, auth tokens, and API keys before posting).

---

## CODE OF CONDUCT

Respectful and constructive collaboration is required. Discrimination, harassment, or spam will not be tolerated.
