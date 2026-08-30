# Contributing

Thanks for your interest in the WhatsApp bot project. Contributions of all kinds are welcome — code, bug reports, docs, and ideas.

## Before you start

- This repo is **local-first**. There are no hosted services and no bundled API keys. Everything must run on your own machine.
- **Never commit secrets.** Do not commit `.env` files, API keys, WhatsApp auth sessions (`auth_info*`), or personal contact data. `.gitignore` already excludes these — keep it that way.
- If you are adding a new command that talks to a remote service, it must go through the configurable API layer (`API_BASE_URL`) — no hardcoded remote URLs.

## Getting started

1. Fork the repo and clone your fork.
2. Install dependencies:

   ```bash
   # V-1 (stable, JavaScript)
   cd V-1
   npm install
   cp .env.example .env       # add your own keys

   # V-2 (TypeScript, in development)
   cd V-2
   npm install
   cp .env.example .env       # needs MariaDB (XAMPP) on 127.0.0.1:3306
   ```

3. Create a branch for your work: `git checkout -b my-feature`.

## Making changes

- Keep changes focused and small; one feature or fix per PR is best.
- Match the existing style of the file you are editing.
- For V-2, make sure it still builds: `npm run build` and `npm run lint`.
- For V-1, verify your files parse: `node --check <file>`.

## Testing

V-2 ships unit tests:

```bash
cd V-2
npm test
```

Please add or update tests for any behavior you change.

## Opening a pull request

1. Push your branch to your fork.
2. Open a PR against `main` and describe what you changed and why.
3. Make sure CI/build checks pass and no secrets are included in the diff.

## Reporting issues

Include the bot version, the command that failed, and any relevant log output (trim anything sensitive before pasting).

## Code of conduct

Be respectful and constructive. Harassment and spam will not be tolerated.