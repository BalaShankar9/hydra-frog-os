# Contributing to HYDRA FROG OS

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Branch Naming](#branch-naming)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)

---

## Code of Conduct

Be respectful, inclusive, and professional. We're all here to build something great together.

---

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/hydra-frog-os.git
   cd hydra-frog-os
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/BalaShankar9/hydra-frog-os.git
   ```
4. **Install dependencies**:
   ```bash
   pnpm install
   ```
5. **Set up local environment** (see README.md)

---

## Development Workflow

1. **Sync with upstream** before starting work:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a feature branch** (see naming conventions below)

3. **Make your changes** with appropriate tests

4. **Run checks before committing**:
   ```bash
   # Lint all packages
   pnpm lint
   
   # Run tests
   pnpm test
   
   # Type check
   pnpm --filter api tsc --noEmit
   pnpm --filter dashboard tsc --noEmit
   ```

5. **Commit and push** your changes

6. **Open a Pull Request**

---

## Branch Naming

Use descriptive branch names with the following prefixes:

| Prefix | Use Case | Example |
|--------|----------|---------|
| `feat/` | New features | `feat/websocket-progress` |
| `fix/` | Bug fixes | `fix/login-redirect-loop` |
| `docs/` | Documentation | `docs/api-endpoints` |
| `refactor/` | Code refactoring | `refactor/crawler-queue` |
| `test/` | Adding tests | `test/auth-service` |
| `chore/` | Maintenance tasks | `chore/update-deps` |

**Examples:**
```bash
git checkout -b feat/pdf-export
git checkout -b fix/broken-link-detection
git checkout -b docs/setup-guide
```

---

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style (formatting, semicolons, etc.) |
| `refactor` | Code refactoring |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks |
| `perf` | Performance improvements |
| `ci` | CI/CD changes |

### Scopes

| Scope | Description |
|-------|-------------|
| `api` | API app changes |
| `dashboard` | Dashboard app changes |
| `crawler` | Crawler worker changes |
| `shared` | Shared package changes |
| `infra` | Infrastructure changes |
| `deps` | Dependency updates |

### Examples

```bash
# Feature
git commit -m "feat(crawler): add JavaScript rendering support"

# Bug fix
git commit -m "fix(api): handle null canonical URLs in issue detection"

# Documentation
git commit -m "docs(readme): add deployment instructions"

# Refactor
git commit -m "refactor(dashboard): extract DataTable into reusable component"

# With body
git commit -m "feat(api): add CSV export endpoint

Adds GET /crawls/:id/export/csv endpoint that streams
crawl data as CSV. Supports filtering by status code.

Closes #123"
```

---

## Pull Request Process

1. **Update documentation** if your change affects it

2. **Add tests** for new functionality

3. **Ensure all checks pass**:
   - Linting
   - Tests
   - Type checking
   - Build succeeds

4. **Fill out the PR template** with:
   - Clear description of changes
   - Related issue numbers
   - Screenshots (for UI changes)
   - Testing instructions

5. **Request review** from maintainers

6. **Address feedback** promptly

7. **Squash commits** if requested before merge

---

## Code Style

### General

- Use **TypeScript** for all code
- Use **ES6+** syntax (async/await, destructuring, etc.)
- Prefer **functional** patterns where appropriate
- Keep functions **small and focused**
- Add **JSDoc comments** for public APIs

### Formatting

We use **Prettier** for code formatting:

```bash
# Format all files
pnpm format

# Check formatting
pnpm format:check
```

### Linting

We use **ESLint** for linting:

```bash
# Lint all files
pnpm lint

# Auto-fix issues
pnpm lint:fix
```

### TypeScript

- Enable **strict mode**
- Avoid `any` type — use `unknown` if needed
- Define **interfaces** for data shapes
- Export types from `index.ts` barrel files

### Testing

- Write **unit tests** for utilities and services
- Write **integration tests** for API endpoints
- Use **descriptive test names**
- Follow **AAA pattern** (Arrange, Act, Assert)

---

## Questions?

If you have questions, feel free to:

1. Open a [GitHub Issue](https://github.com/BalaShankar9/hydra-frog-os/issues)
2. Start a [Discussion](https://github.com/BalaShankar9/hydra-frog-os/discussions)

---

Thank you for contributing! 🐸
