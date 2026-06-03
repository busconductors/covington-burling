# Admin Request Review Enhancement — Design Spec

**Date:** 2026-06-02
**Status:** Approved
**Branch:** TBD

## Overview

Replace the bare `confirm()` dialogs on the admin Form Requests page with rich modals that allow document preview, field editing, and custom messaging before approving or rejecting a request.

### Current Flow (what exists today)

```
Approve: click "Approve" → confirm() → POST /api/admin/requests/:id/approve → Brevo email + Telegram
Reject:  click "Reject"  → confirm() → POST /api/admin/requests/:id/reject  → Telegram only
```

### Proposed Flow

```
Approve: click "Approve" → modal (preview + edit fields + custom message) → POST with edited data → Brevo email with note + Telegram
Reject:  click "Reject"  → modal (reason textarea)                        → POST with reason      → Brevo rejection email + Telegram
```

## Design Decisions (all confirmed)

| Decision | Choice |
|----------|--------|
| Scope | Both NDA and Waiver requests |
| Custom message on approval | Personal note prepended to the auto-generated email |
| Rejection reason | Stored in Firestore AND emailed to client |
| Document editing power | Key fields with live preview + "Open in Document Builder" escape hatch |
| UI approach | Modal overlay (reuses existing `.modal-overlay` / `.modal` pattern from `admin-requests.js`) |

## Approve Modal

### Layout

Two-column layout inside the existing modal pattern:

- **Left (flex: 1):** PDF preview rendered in `<canvas>` via pdf.js (already loaded on the admin page). Page navigation controls below.
- **Right (260px):** Editable document fields (varies by form type), custom message textarea, "Open in Document Builder" button.
- **Bottom bar:** Cancel + "Approve & Send" button.

### Document Fields by Type

**NDA (`nda-definition.js` expects `clientName`, `clientAddress`, `effectiveDate`):**
- Client Name (pre-filled from request)
- Effective Date (blank, admin fills in)
- Client Address (pre-filled from request's `company` field)

**Waiver (`waiver-definition.js` expects `clientName`, `date`, `matter`):**
- Client Name (pre-filled from request)
- Date (blank, admin fills in)
- Matter (pre-filled from request's `matterDescription`)

### Live Preview

1. On field change, debounce 500ms
2. Call `POST /api/generate-nda` or `POST /api/generate-waiver` with current field values
3. Receive PDF blob, render into `<canvas>` using pdf.js (`pdfjsLib.getDocument()` + `page.render()`)
4. Page navigation: render only page 1 by default, prev/next buttons flip through pages

### "Open in Document Builder" Button

Navigates to the Document Builder section (`adminBuilderSection`) with the fields pre-populated. Implementation: `window.AdminBuilder.init({ ...fields })` or similar bridge. After editing in the builder, the admin returns to the requests table and re-opens the approve modal (fields are not synced back automatically — this is a deliberate escape hatch, not a round-trip).

### Custom Message

- Optional textarea (3 rows, ~120 chars recommended)
- Stored in Firestore as `adminMessage`
- Prepended to the Brevo email body above the auto-generated download link section

## Reject Modal

### Layout

Two-panel layout:

- **Left (220px):** Request summary card (name, email, form type, submission date) for context. Info banner noting an email will be sent.
- **Right (flex: 1):** Required rejection reason textarea (5 rows).
- **Bottom bar:** Cancel + "Reject Request" button (red).

### Rejection Reason

- Required field (button disabled until text entered)
- Stored in Firestore as `rejectionReason`
- Sent to client via new Brevo rejection email template
- Included in Telegram notification message

## Backend Changes

All changes in `backend/index.js` (the only backend file).

### New Firestore Fields (on `form-requests` collection)

```
adminMessage:    string | null   — personal note from admin (on approve)
rejectionReason: string | null   — reason for rejection (on reject)
documentFields:  object | null   — admin-edited field values for PDF generation
  { clientName, clientAddress?, effectiveDate?, date?, matter? }
```

### Modified: `POST /api/admin/requests/:id/approve`

**New accepted body fields:**
```json
{
  "adminMessage": "string (optional)",
  "documentFields": {
    "clientName": "string",
    "effectiveDate": "string (NDA)",
    "clientAddress": "string (NDA)",
    "date": "string (Waiver)",
    "matter": "string (Waiver)"
  }
}
```

**Changes:**
1. Store `adminMessage` and `documentFields` in the Firestore update
2. When `documentFields` is provided, use those values instead of `data.name`/`data.company` for PDF generation in the download route
3. When `adminMessage` is provided, prepend it to the Brevo email HTML body (before the download link section)

### Modified: `POST /api/admin/requests/:id/reject`

**New accepted body field:**
```json
{
  "rejectionReason": "string (required)"
}
```

**Changes:**
1. Validate `rejectionReason` is present and non-empty (400 if missing)
2. Store `rejectionReason` in Firestore update
3. Send Brevo rejection email to client with the reason
4. Include rejection reason in Telegram notification

### Modified: `GET /api/download/:token`

Use `documentFields` (if present on the Firestore doc) when generating the PDF:
```js
var fields = data.documentFields || {
  clientName: data.name,
  clientAddress: data.company,
  effectiveDate: '',
  date: '',
  matter: data.matterDescription
};
```

This ensures the client downloads the admin-edited version of the document, not the raw form submission.

### New: Rejection Email

Added to `sendBrevoEmail` or a new `sendRejectionEmail` function:

```
Subject: Your form request has been declined
Body: Dear {name},
      Thank you for your interest in Carlington & Burling LLP.
      After careful review, we are unable to provide the requested forms at this time.
      Reason: {rejectionReason}
      If you have questions, please contact us directly.
```

### Modified: Brevo Approval Email

Existing email body gets the `adminMessage` (if present) prepended above the download section:
```
{adminMessage}
--- original email content below ---
```

## Frontend Changes

### Files to Modify

| File | Change |
|------|--------|
| `public/js/admin-requests.js` | Replace `confirm()` with approve/reject modals. New functions: `openApproveModal(id)`, `openRejectModal(id)`. Updated click handler delegation. |
| `public/css/admin.css` | New styles for modal two-column layout, PDF preview canvas, field inputs, message textarea. |

### Files Already Loaded (no new deps)

- pdf.js (`pdfjsLib`) — already loaded via CDN in `admin/index.html` line 17
- pdf-lib — already loaded for the Document Builder

### Approve Modal Implementation Notes

```js
// Key functions to add to admin-requests.js:

function openApproveModal(id) {
  var r = requestsData.find(function(req) { return req.id === id; });
  // Build modal with:
  //   - PDF preview canvas (id="approvePdfCanvas")
  //   - Editable field inputs based on r.formType
  //   - Custom message textarea
  //   - "Open in Builder" button (optional)
  //   - Approve & Send button
  // On field change: debounced renderPreview(r.formType, fields)
  // On approve click: POST with { adminMessage, documentFields }
}

function renderPreview(formType, fields) {
  var endpoint = formType === 'nda' ? '/api/generate-nda' : '/api/generate-waiver';
  fetch(endpoint, { method: 'POST', body: JSON.stringify(fields), headers: {...} })
    .then(r => r.blob())
    .then(blob => renderPdfToCanvas(blob));
}

function renderPdfToCanvas(blob) {
  // Use pdfjsLib.getDocument(blob) → page.render()
  // Existing pattern from admin-builder.js can be referenced
}
```

### Reject Modal Implementation Notes

```js
function openRejectModal(id) {
  var r = requestsData.find(function(req) { return req.id === id; });
  // Build modal with:
  //   - Request summary (name, email, form type, date)
  //   - Rejection reason textarea (required)
  //   - Reject button (disabled until text entered)
  // On reject click: POST with { rejectionReason }
}
```

### Modal Lifecycle

Follow the existing pattern from `openDetailModal()` in `admin-requests.js`:
- Remove any existing modal before creating new one
- Track `currentEscHandler` for Escape key cleanup
- Click on overlay or close button removes modal and listener
- After successful approve/reject, close modal and call `loadRequests()` to refresh table

## Testing

### New Test File: `test/admin-review-modals.test.js`

Coverage targets:
- **Approve modal:** renders with correct fields for NDA vs Waiver, PDF preview fetch called on field change, debounce works, Approve button sends correct body, Cancel closes modal, Esc closes modal
- **Reject modal:** renders with request summary, Reject button disabled when textarea empty, enabled when text entered, sends rejectionReason, Cancel closes modal
- **Error paths:** API failure shows error, button re-enabled
- **Modal lifecycle:** Esc handler cleaned up on close, no duplicate modals

### Existing Tests

All 66 existing tests must continue to pass. No changes to `admin-builder.js`, `admin-auth.js`, or `admin-requests.js` existing functionality beyond replacing `confirm()` with modals.

## Out of Scope

- Real-time collaborative editing of documents
- Version history for edited documents
- Email template editor in admin UI (uses hardcoded Brevo templates)
- Syncing fields back from Document Builder to approve modal
- Waiver/NDA form on the client-facing page (`waiver-nda.html`) — unchanged
