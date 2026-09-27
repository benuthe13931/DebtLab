# DebtLab refactor plan

The application entry point is now intentionally small. The remaining work is to split `LoanSimulatorPage` by responsibility while preserving the current in-memory navigation, local storage keys, Supabase payloads, calculations, and rendered behavior.

## Target structure

```text
src/
  app/                  application composition and providers
  pages/                complete screens and route-level orchestration
  components/
    layout/             app header, profile menu, sidebar, page shell
    loans/              loan and credit-card controls
    debt/               portfolio and payoff views
    profile/            profile/account controls
    paycheck/           paycheck screen components
    ui/                 generic controls and presentational primitives
  calculations/         pure financial calculations grouped by domain
  hooks/                reusable stateful React behavior
  services/             persistence and external operations
  repositories/         local/cloud data access abstractions
  types/                cross-feature contracts
  constants/            shared static tables and configuration
  utils/                small domain-neutral helpers
  styles/               global styles and shared tokens
```

## Ordered extraction slices

1. Shared date controls and formatting helpers. **Complete.**
2. Shared summary/form primitives. **Complete.**
3. Move theme, persisted loan, profile, and serialized schedule contracts into `src/types`; move theme definitions and storage keys into `src/constants`.
4. Extract the application shell: header, profile menu, page navigation, and page-level container.
5. Extract the loan sidebar and loan-selection state into layout/components and a navigation hook.
6. Extract the overview and bills/budget pages into their own page files; move portfolio mapping and budget persistence behind services.
7. Split the simulator into loan-details, credit-card-details, transactions, payoff-schedule, and what-if components.
8. Extract simulator state transitions and serialization into domain hooks and repositories.
9. Move remaining loan/card presentation helpers into domain components and keep calculation modules pure.
10. Split global CSS into global tokens, layout styles, and component styles; keep each stylesheet bounded and colocated.
11. Add focused component and persistence regression tests, then remove temporary compatibility exports and dead duplication.

Each slice must pass the full test suite, typecheck, lint, and production build before it is committed.
