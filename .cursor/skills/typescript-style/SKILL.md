---
name: typescript-style
description: Apply TypeScript styling conventions for tier-list-league. Use when writing or editing TypeScript/JavaScript code in this repository, adding variables, types, or casts.
---

# TypeScript Style

When writing code for tier-list-league, follow the following styling conventions:

Only initialie variables with types that cannot be easily infered by its assignee.
Never use the as typescript cast keyword. Always use the well defined types in the repo. (Tests are an exception)
Do not initialize variables that will only be used once.
