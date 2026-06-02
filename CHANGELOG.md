# CHANGELOG

## [1.0.1.1] - 2026-06-02

### Added
- Telegram bot notifications for form request lifecycle — sends message on form submission, approval, and rejection

### Fixed
- ReferenceError in reject route where `doc.data()` result was never assigned to a variable before use

## [1.0.1.0] - 2026-06-02

### Fixed
- Prevent stored XSS via request status field in admin requests table and detail modal
- Fix Esc key listener leak when closing request detail modal via overlay or close button
- Use `escAttr` for HTML attribute escaping in data-id attributes (requests table) and data-title/data-body attributes (clause library)
- Fix `closeModal` ordering: remove event listener before DOM removal to prevent leak on error

### Changed
- Scoped builder input listener from `document` to builder container for performance
- Added null guards on all builder `getElementById` calls (loadPreset, syncState, renderFields, renderClauses, renderSigBlocks, updatePreview)
- Removed duplicate `.status-badge--form` and dead admin CSS classes from global `styles.css`

### Added
- Bootstrap vitest test framework with 39 tests covering admin-utils (escHtml/escAttr parity, clause library HTML, modal Esc lifecycle) and admin-builder (null guard branch coverage, 34-element DOM setup)
- Track current modal Esc handler to clean up stale listeners when reopening modals
