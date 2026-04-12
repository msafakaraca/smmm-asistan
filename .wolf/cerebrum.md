# Cerebrum

> OpenWolf's learning memory. Updated automatically as the AI learns from interactions.
> Do not edit manually unless correcting an error.
> Last updated: 2026-04-12

## User Preferences

<!-- How the user likes things done. Code style, tools, patterns, communication. -->

## Key Learnings

<!-- Project-specific conventions, framework patterns, API behaviors, module connections. -->

## Do-Not-Repeat

<!-- Mistakes made and corrected. Each entry prevents the same mistake recurring. -->
<!-- Format: [YYYY-MM-DD] Description of what went wrong and what to do instead. -->

## Decision Log

<!-- Significant technical decisions with rationale. Why X was chosen over Y. -->
### Sidebar Animation Performance
- [2026-04-12] Sidebar `transition-[width]` triggers ResizeObserver in `useVirtualizer`, which fires React state updates on every animation frame. The cascade: CSS width change → flex container resize → ResizeObserver fires → virtualizer recalculates → table re-renders → all unmemoized cells re-render. Fix: memoize leaf components (BeyannameCell), use stable empty objects instead of `|| {}`, stabilize callback references with `useCallback`, and keep overscan low (5).
- [2026-04-12] `|| {}` in JSX props creates a NEW object reference every render, breaking React.memo comparators. Always use a module-level `const EMPTY_X = {}` instead.
- [2026-04-12] Inline arrow functions like `onClick={() => {}}` or `onFoo={() => setState(null)}` create new closures every render, defeating memo. Extract to `useCallback` or module-level constants.
