# Contributing to Azeroth Management Portal

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/wow-frontend.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Install dependencies: `pnpm install`
5. Copy environment: `cp .env.example .env.local`
6. Start development: `pnpm dev`

## Development Guidelines

### Code Style

- Use TypeScript for all new code
- Follow existing code patterns and conventions
- Use Vue 3 Composition API with `<script setup>`
- Use Pinia stores in Composition API style

### Frontend (app/)

- Keep pages minimal - extract logic into components
- Use scoped styles in components
- Check SCSS `_variables.scss` and `_mixins.scss` before adding new styles
- Import utilities from `utils/` folder

### Backend (server/)

- Follow existing API patterns
- Optimize database queries
- Use proper error handling with `createError()`
- Document new API endpoints in `docs/API.md`

### Commits

- Use clear, descriptive commit messages
- Keep commits focused on a single change
- Reference issues when applicable: `Fixes #123`

## Pull Request Process

1. Ensure your code follows the style guidelines
2. Update documentation if needed
3. Test your changes thoroughly
4. Create a pull request with a clear description
5. Wait for review and address any feedback

## Reporting Issues

- Check existing issues before creating a new one
- Use issue templates when available
- Provide clear reproduction steps for bugs
- Include relevant environment information

## Project Structure

See [AGENT.md](AGENT.md) for detailed project structure and conventions.

## Questions?

Feel free to open a discussion or issue if you have questions about contributing.
