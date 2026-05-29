# Security Policy

## Scope and intended use

This project is a **demonstration / educational tool**. As shipped it has **no
authentication**, permissive CORS, and accepts file uploads. It is intended to
run locally or in a trusted environment — **do not expose it directly to the
public internet** without adding auth, rate limiting, and upload validation in
front of it.

Never commit real secrets. API keys belong in `backend/.env` (git-ignored);
use `backend/.env.example` as the template.

## Reporting a vulnerability

If you find a security issue, please **do not open a public issue**. Instead,
report it privately via [GitHub Security Advisories](https://github.com/Nokimalos/rag-vizualisation/security/advisories/new)
or by contacting the maintainer.

Please include:

- a description of the issue and its impact,
- steps to reproduce (or a proof of concept),
- any suggested remediation.

You can expect an acknowledgement within a few days.
