# UI Style Guide

## Design Tokens
- Colors: defined in `src/styles/tokens.css` with WCAG AA contrast for text and focus.
- Typography: semantic sizes `--font-size-xs..2xl` and `--line-height-*`.
- Spacing: `--space-1..6` for layout rhythm.
- Radius: `--radius-sm/md/lg` for surface rounding.
- Shadow: `--shadow-sm/md` for elevation.
- Motion: `--transition-*`, `--easing-standard`; honor `prefers-reduced-motion`.

## Components
- Sidebar
  - List uses `role=listbox` with items as `role=option`.
  - Actions: edit ✎, delete 🗑 with `aria-label` and focus styles.
  - Keyboard: Enter select, E edit, Delete remove.
  - Optimistic deletion: item fades (`.removing`) then state updates; errors revert and show toast.
- ConversationTitleEdit
  - Validation: 1–50 chars; allowed `[\w\s\-_.]`.
  - `aria-invalid`, error `role=alert`, Save/Cancel buttons.
- ConfirmDialog
  - `role=dialog`, `aria-modal`, labelled by title/description.
  - Esc cancels; Enter confirms; focus trap via initial focus.
- Toast
  - `role=status`, dismiss button, auto-hide after 3s.
- ChatInterface
  - Message spacing, markdown readability, skeleton loaders.

## Patterns
- Optimistic UI: update local state first, then sync with backend; revert on failure with toast.
- Accessibility: visible focus ring, semantic roles, live regions for status.
- Responsiveness: sidebar fixed width, content flexes; small screens collapse sidebar.
- Performance: prefer CSS transitions; memoize heavy renders; avoid reflows.

## Usage
- Import `src/styles/tokens.css` globally in `src/main.jsx`.
- Use `.btn`, `.input`, `.icon-button` classes for consistent controls.
- Keep tab order logical; ensure all interactive elements are keyboard reachable.