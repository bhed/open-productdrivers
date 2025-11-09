# Contributing to ProductDrivers

Thank you for your interest in contributing! 🎉

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/productdrivers.git`
3. Install dependencies: `pnpm install`
4. Follow the [Quick Start guide](README.md#-quick-start) to set up Supabase
5. Create a branch: `git checkout -b feature/your-feature-name`

## Development Workflow

### Running the Dashboard

```bash
cd apps/dashboard
pnpm dev
```

### Building SDKs

```bash
# Build all packages
pnpm build

# Build specific SDK
cd packages/sdk-js
pnpm build
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

### Code Style

We use ESLint and Prettier. Format your code before committing:

```bash
pnpm format
pnpm lint
```

## Project Structure

```
productdrivers/
├── apps/
│   └── dashboard/          # Next.js dashboard app
├── packages/
│   ├── core/              # Shared types and utilities
│   ├── sdk-js/            # JavaScript/TypeScript SDK
│   ├── sdk-flutter/       # Flutter SDK
│   └── sdk-kotlin/        # Kotlin/Android SDK
├── supabase/
│   ├── functions/         # Edge Functions
│   └── migrations/        # Database migrations
└── docs/                  # Documentation
```

## What to Contribute

### Good First Issues

Look for issues tagged with `good first issue` or `help wanted`.

### Ideas

- New SDK languages (Python, Ruby, Go, etc.)
- Dashboard improvements (new charts, better UX)
- Performance optimizations
- Documentation improvements
- Bug fixes

### What We're NOT Looking For

- Breaking changes without discussion
- Features that compromise privacy
- Vendor lock-in features

## Pull Request Process

1. **Create an issue first** for major changes
2. Write clear commit messages
3. Add tests for new features
4. Update documentation
5. Ensure all tests pass: `pnpm test`
6. Submit PR with description of changes

### Commit Message Format

```
type(scope): description

[optional body]
[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding/updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(sdk-js): add blockPII option for PII detection
fix(dashboard): correct insights calculation for small datasets
docs(readme): update self-hosting instructions
```

## Code Review

- All PRs require at least one approval
- Address review comments promptly
- Be respectful and constructive

## Community Guidelines

- Be kind and respectful
- Welcome newcomers
- Help others learn
- Follow our [Code of Conduct](CODE_OF_CONDUCT.md)

## Questions?

- Open a [GitHub Discussion](https://github.com/bhed/open-productdrivers/discussions)
- Report security issues: See [SECURITY.md](SECURITY.md)

Thank you for contributing! 🙏
