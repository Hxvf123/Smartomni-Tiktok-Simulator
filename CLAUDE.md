# CLAUDE.md

## Workflow (Tiptopshop UI, branch feat/tiptopshop-ui)
- Always give a short plan first and WAIT for the user to type "go" before editing code.
- Work one step at a time following docs/tiptopshop-plan.md; never start work belonging to a later step.
- End every step by running, in frontend/: `npm run typecheck && npm run lint && npm test && npm run build`, and report the results (pass/fail + relevant output).
- Never push and never open a PR unless the user asks.

## Constraints
- All UI text in English.
- Do not modify anything under backend/.
- Data the backend does not provide yet comes from frontend/src/mocks/ (deletable as one folder).
- Keep legacy routes (/buyer, /seller, /console, /seller/authorize) working until Step 13 so existing e2e tests still pass.
- Reuse the existing helpers in frontend/src/lib/ (api(), ApiError, vnd, useAsync, sessionStorage key `sim.demo-session.{ROLE}`) rather than rewriting them.
