<!--
SYNC IMPACT REPORT — temporary review artifact for this amendment.
Remove this comment before committing the constitution file.

Version change: (none, initial ratification) → 1.0.0

Modified principles: none (no prior ratified constitution existed).
The following principles were added at initial ratification:
  - I. Mobile-First Web Application
  - II. Local-First Data Ownership
  - III. Self-Contained Runtime
  - IV. One Network Egress: The OpenAI-Compatible API
  - V. Tests Where It Makes Sense
  - VI. Documentation Is Part of the Change

Added sections:
  - Core Principles (I–VI)
  - Technical Constraints, Security & Privacy
  - Development Workflow & Quality Gates
  - Governance

Removed sections: none.

Follow-up TODOs / deferred items:
  - RATIFICATION_DATE set to 2026-10-28, inferred from the initial Spec Kit
    setup commit in this repository; adjust only if the owner states otherwise.
  - The concrete web stack (framework, bundler, test runner) is intentionally
    left to the feature plan; the constitution only constrains its behavior.
  - README.md does not exist yet in the repository. Creating and populating it
    is deferred to feature work and is governed by Principle VI.
-->

# Embrollado Constitution

## Core Principles

### I. Mobile-First Web Application

Embrollado is a web application whose primary form factor is the mobile browser; desktop is a
secondary, compatible target.

- The application MUST run entirely in the browser. A server-side runtime or backend service MUST
  NOT be required for any feature other than proxying to the API endpoint configured by the user.
- Every screen MUST be designed for a narrow viewport first (baseline 320 CSS px wide) and MUST
  remain usable and legible at 390 px and 430 px widths.
- Interactive controls MUST be reachable one-handed and MUST offer touch targets of at least
  44 x 44 CSS px.
- No interaction may depend on hover or a physical keyboard. Every hover-only affordance MUST have
  a touch and keyboard equivalent.
- The initial route MUST ship no more than 250 KB of gzipped JavaScript. Exceeding this budget
  requires a written justification in the feature plan.
- Primary content and navigation MUST NOT depend on horizontal scrolling.

Rationale: the app is used on phones, often on constrained networks and with one free hand.
Designing mobile-first keeps the majority of interactions simple, fast to load, and forgiving.

### II. Local-First Data Ownership

All user data is created, stored, and owned by the user inside their own browser. There is no
backend database, no sync service, and no account system.

- Persistent user data MUST be stored in the browser. IndexedDB is the default; localStorage is
  limited to small, non-critical values such as preferences.
- Every feature that does not require AI MUST work with the network fully unavailable.
- The application MUST NOT send user content to any origin other than the user-configured
  OpenAI-compatible API, and only as part of an AI action the user explicitly triggered.
- The application MUST NOT contain telemetry, analytics, tracking pixels, crash reporting, or any
  other collection of user data.
- User data MUST be exportable to a documented, portable file format (JSON) and MUST be importable
  again, so users can move or back up their data.
- Storage quota errors and private-mode restrictions MUST be handled explicitly. The app MUST tell
  the user when data cannot be persisted instead of failing silently or losing writes.

Rationale: privacy and reliability are the product's core value. Local-first storage removes
backend cost and vendor lock-in, and keeps the data alive independently of any provider.

### III. Self-Contained Runtime

The shipped application is fully self-contained: everything it needs in order to run is built
into the bundle it serves.

- The application MUST NOT fetch any runtime resource from a third-party origin. The only permitted
  outbound requests are the OpenAI-compatible API calls covered by Principle IV.
- JavaScript, CSS, fonts, icons, images, workers, and manifests MUST be bundled into the build
  output and served from the application's own origin. No CDN, external font host, or remote image
  URL may be referenced.
- Dependencies MUST NOT perform network requests at import time, and no third-party script, font,
  or analytics snippet may be injected at runtime.
- Every network request the application makes MUST be traceable, by review of the diff, either to a
  first-party static asset or to a Principle IV API call.
- New third-party dependencies MUST be justified in the feature plan and MUST NOT introduce a
  network fetch. A dependency that cannot meet this bar MUST be vendored or the feature MUST be
  redesigned.
- The application MUST remain fully functional with all external network access blocked, apart from
  the AI features that explicitly report their offline state.

Rationale: self-containment is what makes the app installable, offline-capable, private, and immune
to third-party outages, tracking, and supply-chain compromise of a CDN.

### IV. One Network Egress: The OpenAI-Compatible API

The OpenAI-compatible API is the only sanctioned boundary between Embrollado and the outside
world, and the user holds the keys to it.

- The API base URL, credentials, and model MUST be configurable by the user at runtime and MUST be
  stored locally. They MUST NOT be compiled into the bundle, committed to the repository, or baked
  into any default configuration.
- All AI traffic MUST be issued through a single adapter module that owns request construction,
  response parsing, and error mapping, so that changing endpoint or model does not require edits
  to feature code.
- AI requests MUST be explicitly user-triggered. The application MUST NOT run background or
  automatic AI calls and MUST NOT send prompts the user did not ask to send.
- API keys MUST NEVER appear in logs, error messages, analytics, exported files, or crash reports.
  Secrets MUST be redacted before anything is written to a log or shown to the user.
- Failure modes (offline, network error, unauthorized, rate limit, malformed response) MUST be
  surfaced in the UI with a recoverable path, and MUST NOT corrupt, truncate, or silently discard
  locally stored data.
- The provider contract MUST be limited to the documented OpenAI-compatible surface, so that any
  OpenAI-compatible server can satisfy it.

Rationale: users own their data and their spend. A single, user-controlled egress keeps prompts
private and makes provider switching possible without rewriting the application.

### V. Tests Where It Makes Sense

Automation covers the logic that protects user data and behavior, and stops where testing adds
cost without insight.

- Non-trivial logic MUST be covered by automated tests: data transformation, storage and migration,
  import and export, prompt construction, response parsing, validation, and state transitions.
- Tests MUST be deterministic and MUST NOT require network access. The AI adapter MUST be exercised
  against a mock or fake transport.
- A single documented command (for example `npm test`) MUST run the entire suite, and it MUST pass
  before a change is considered complete.
- Bug fixes MUST include a regression test that fails before the fix.
- Presentation-only code MAY be verified by end-to-end tests at a mobile viewport instead of unit
  tests. Coverage targets behavior, not line counts.
- Tests MUST be added in the same change as the behavior they protect, and MUST NOT assert
  incidental implementation details.

Rationale: in a local-first app, data loss and corruption originate in this logic. Deterministic
tests are cheap there, while brittle UI unit tests are not.

### VI. Documentation Is Part of the Change

Documentation is delivered in the same change as the behavior it describes; stale docs are treated
as a defect.

- README.md MUST be updated in the same change whenever setup, development, build, test,
  configuration, storage, or user-facing behavior changes.
- README.md MUST document, at minimum: prerequisites, install, dev, and build commands, the test
  command, how to configure the OpenAI-compatible endpoint (base URL, key, model), where data is
  stored in the browser, and how to export and import data.
- Any user-visible behavior change MUST be reflected in README.md or in the relevant document
  under `docs/` before it is merged.
- Documented commands, configuration keys, and examples MUST be verified against the code and MUST
  be copy-pasteable.
- Documentation MUST NOT describe unimplemented behavior; planned features are marked as planned.

Rationale: users install and run the app themselves. Accurate documentation is the primary user
interface of a self-hosted, local-first tool.

## Technical Constraints, Security & Privacy

- Browser support MUST cover the current and previous major version of Chrome, Safari, Firefox, and
  Edge, on mobile and desktop.
- The implementation MUST be written in TypeScript with strict type checking and MUST type-check
  cleanly.
- User content MUST be treated as confidential. No real user data may appear in source code,
  fixtures, screenshots, or example payloads.
- The application MUST ship a Content Security Policy that allows only its own origin plus the
  user-configured API origin. `unsafe-inline` and `unsafe-eval` are NOT permitted in production
  builds.
- Dependencies MUST be locked with a committed lockfile, MUST be kept to a minimum, and MUST be
  reviewed for supply-chain risk before being added.
- Accessibility MUST meet WCAG 2.1 AA for the core flows: semantic markup, keyboard operability,
  visible focus, accessible names, and sufficient contrast.
- Browser storage MUST be treated as a scarce resource. Large assets are embedded in the bundle
  rather than written to storage, and quota errors are handled as described in Principle II.
- The performance budget in Principle I MUST be verified in CI or recorded as a manual
  verification step in the feature plan.

## Development Workflow & Quality Gates

- Work follows the Spec Kit cycle: specify, plan, tasks, implement. The plan MUST record any
  deviation from this constitution and justify it.
- A change is complete only when all of the following hold:
  - The full test suite passes and type checking and linting pass.
  - The feature has been verified in a real browser at a mobile viewport of 390 px wide or less,
    including touch and keyboard interaction.
  - The application has been exercised with external network access blocked, apart from the AI
    flow.
  - README.md and the relevant documentation are updated, per Principle VI.
  - The diff contains no new request to a third-party origin, per Principle III.
- Every feature plan MUST state its test approach: what is unit tested, what is covered
  end-to-end, and what is deliberately left to manual verification.
- Keep changes small and scoped. Unrelated refactors, reformatting, and speculative abstractions
  MUST be split into separate changes.
- Dependencies and architectural changes MUST be justified in writing in the plan before they are
  introduced.

## Governance

- This constitution supersedes conflicting project practices, templates, and conventions. When a
  spec, plan, or task conflicts with it, the constitution wins and the conflict MUST be resolved by
  an amendment before implementation continues.
- Amendments MUST be proposed through the constitution command, MUST state the rationale for the
  change, and MUST be approved by the project owner before they take effect.
- Amendments that change existing behavior MUST include a migration path for existing user data
  and installed bundles.
- Versioning is semantic:
  - MAJOR: a principle is removed, or an existing principle is redefined in a
    backward-incompatible way.
  - MINOR: a new principle or section is added, or existing guidance is materially expanded.
  - PATCH: clarifications, wording, typo fixes, and other non-semantic refinements.
- Every change request and code review MUST verify compliance with the principles above and MUST
  cite the principles that apply. Any deviation MUST be justified in writing; unexplained
  violations block the change.
- Complexity MUST be justified before it is introduced. Every new abstraction, dependency, or
  integration requires a stated benefit that outweighs its cost.
- Compliance is reviewed at plan time and at review time. The review checklist MUST include the
  quality gates listed in "Development Workflow & Quality Gates".

**Version**: 1.0.0 | **Ratified**: 2026-10-28 | **Last Amended**: 2026-10-28
