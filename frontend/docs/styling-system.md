Styling System Overview

Design tokens
- Location: `src/styles/tokens.css`
- Provides CSS variables for colors, typography, spacing, radii, shadows, transitions.
- Theme overrides supported via `:root[data-theme="light"]` and `:root[data-theme="dark"]`.
- Global focus ring uses `:focus-visible` with `--color-focus`.

Theme toggling
- App sets `document.documentElement` attribute `data-theme` to `light` or `dark`.
- Preference is persisted in `localStorage['theme']` and restored on startup.
- OS preference (`prefers-color-scheme`) is used when no stored preference exists.
- Animated transitions for background and text are enabled (respects `prefers-reduced-motion`).

Buttons
- Shared classes: `.icon-button` and `.btn` in `tokens.css`.
- Interaction states: `:hover`, `:active`, `:disabled` with animated feedback.
- Variants: `.primary` and `.danger`.
- Accessibility: provide `aria-label`, `title` and rely on global focus ring.

Toggle switch
- Class: `.toggle-switch` with `.thumb` child for a sliding indicator.
- Uses `role="switch"` and `aria-checked` for semantics.

Usage guidelines
- Prefer design tokens (`var(--color-*)`, `var(--space-*)`) over hardcoded values.
- Keep button labels concise; use `aria-label` where text isn’t descriptive.
- Maintain sufficient color contrast (WCAG AA) by using token colors.
- Avoid fixed sizes on buttons; use padding for touch targets ≥ 44×44px where feasible.

Error handling
- Theme switching wraps storage operations in `try/catch` and logs failures.

Files touched
- `src/styles/tokens.css` — theme overrides and global button styles.
- `src/App.jsx` — theme state, persistence, and toggle handler.
- `src/components/ChatInterface.jsx` — toggle UI and ARIA.
- `src/components/Sidebar.css` — relies on global `.icon-button` styles.