# TrillionAI Marketing

**TrillionAI Marketing** is a private marketing software project developed by **TrillionAI Tech**.

This repository contains the application source code, supporting services, configuration, tests, and deployment assets required to develop and operate the product.

> **Status:** Active development.

## Repository Scope

This repository is dedicated to the TrillionAI Marketing product.

Public-facing documentation should describe only current, necessary operational information. Product strategy, future capabilities, commercial plans, internal automation design, security-sensitive architecture, provider strategy, roadmap information, and other proprietary details should not be documented here.

## Development

### Requirements

- Node.js 20 or later
- npm

Additional services may be required depending on the environment.

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Testing

Run the repository test commands before merging or releasing changes.

```bash
npm test
```

Where individual workspaces provide their own test commands, run those as well.

## Configuration

Runtime configuration is provided through environment variables and deployment configuration.

Do not commit:

- API keys
- access tokens
- passwords
- private keys
- production credentials
- customer data
- private deployment information
- internal security configuration

Use the repository's example environment files and deployment tooling where available.

## Security

Security-sensitive implementation details are intentionally excluded from this README.

Do not document proprietary security controls, internal service topology, defensive logic, privileged interfaces, authentication internals, operational secrets, or other information that could unnecessarily expose the system.

Security-related changes should be reviewed and tested before release.

## Deployment

Deployment configuration is maintained in the repository for authorized environments.

Environment-specific infrastructure details, private endpoints, secrets, production topology, and internal operational procedures should remain outside public documentation unless disclosure is explicitly required.

## Documentation

Technical documentation may exist elsewhere in the repository for authorized development use.

Documentation should remain limited to information necessary to build, test, maintain, and operate the current software. Future plans and proprietary product strategy should not be added to public-facing files.

## Licensing

Trillion-owned source code remains subject to the licensing terms defined for this repository.

Third-party software remains governed by its respective licences.

## Ownership

TrillionAI Marketing is developed by **TrillionAI Tech**.

All proprietary product strategy, internal architecture, future plans, commercial direction, and non-public implementation details are confidential unless explicitly approved for disclosure.
