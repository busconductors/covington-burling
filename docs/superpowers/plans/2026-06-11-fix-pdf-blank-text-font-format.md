# Fix PDF Blank Text — Font Format (.woff → .ttf)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix document builder PDFs that render with all text invisible — only ruled lines show — by switching the font loader from `.woff` to `.ttf`.

**Architecture:** `carlington-template.js` (client-side pdf-lib generator) fetches four font files from `/fonts/` and embeds them via `doc.embedFont()`. pdf-lib + fontkit cannot parse WOFF compressed font format — it silently produces broken font objects, so every `page.drawText()` call renders zero-width invisible glyphs. The `.ttf` equivalents of all four fonts already exist at `public/fonts/`. Changing the four URL strings in `FONT_PATHS` is the complete fix. No other code changes are needed — the template layout, Variant E design, and all drawing logic are correct.

**Tech Stack:** pdf-lib 1.17.1, @pdf-lib/fontkit 1.1.1, vanilla JS, Vercel static hosting

---

## File Map

| File | What changes |
|---|---|
| `public/js/carlington-template.js` | Lines 31–34: change `.woff` → `.ttf` in `FONT_PATHS`; bump internal comment |
| `public/admin/index.html` | Line 22: bump `carlington-template.js?v=19` → `?v=20` |

---

## Task 1: Fix font format in carlington-template.js

**Files:**
- Modify: `public/js/carlington-template.js:31-34`

- [ ] **Step 1: Open the file and locate FONT_PATHS**

```bash
grep -n "woff\|FONT_PATHS" /Users/sk_hga/lawfirmprojet/covington-burling/public/js/carlington-template.js
```

Expected output:
```
30:  var FONT_PATHS = [
31:    { key: 'serif',     url: '/fonts/cormorant-garamond-latin-400-normal.woff' },
32:    { key: 'serifBold', url: '/fonts/cormorant-garamond-latin-600-normal.woff' },
33:    { key: 'sans',      url: '/fonts/montserrat-latin-400-normal.woff' },
34:    { key: 'sansMed',   url: '/fonts/montserrat-latin-500-normal.woff' },
```

- [ ] **Step 2: Replace the four .woff paths with .ttf**

Change lines 31–34 from:
```js
  var FONT_PATHS = [
    { key: 'serif',     url: '/fonts/cormorant-garamond-latin-400-normal.woff' },
    { key: 'serifBold', url: '/fonts/cormorant-garamond-latin-600-normal.woff' },
    { key: 'sans',      url: '/fonts/montserrat-latin-400-normal.woff' },
    { key: 'sansMed',   url: '/fonts/montserrat-latin-500-normal.woff' },
  ];
```

To:
```js
  var FONT_PATHS = [
    { key: 'serif',     url: '/fonts/cormorant-garamond-latin-400-normal.ttf' },
    { key: 'serifBold', url: '/fonts/cormorant-garamond-latin-600-normal.ttf' },
    { key: 'sans',      url: '/fonts/montserrat-latin-400-normal.ttf' },
    { key: 'sansMed',   url: '/fonts/montserrat-latin-500-normal.ttf' },
  ];
```

- [ ] **Step 3: Verify no remaining .woff references**

```bash
grep -n "woff" /Users/sk_hga/lawfirmprojet/covington-burling/public/js/carlington-template.js
```

Expected: no output.

- [ ] **Step 4: Verify .ttf files exist and are non-empty**

```bash
ls -lh /Users/sk_hga/lawfirmprojet/covington-burling/public/fonts/*.ttf
```

Expected: four files, each >100KB:
```
cormorant-garamond-latin-400-normal.ttf
cormorant-garamond-latin-600-normal.ttf
montserrat-latin-400-normal.ttf
montserrat-latin-500-normal.ttf
```

- [ ] **Step 5: Verify TTF files are served by production**

```bash
curl -s -o /dev/null -w "%{http_code}" https://carlingtonburling.com/fonts/cormorant-garamond-latin-400-normal.ttf
```

Expected: `200`

- [ ] **Step 6: Commit**

```bash
git -C /Users/sk_hga/lawfirmprojet/covington-burling add public/js/carlington-template.js
git -C /Users/sk_hga/lawfirmprojet/covington-burling commit -m "fix: switch pdf font loader from .woff to .ttf — pdf-lib cannot embed WOFF format"
```

---

## Task 2: Bump version cache-bust in admin HTML

**Files:**
- Modify: `public/admin/index.html:22`

- [ ] **Step 1: Bump carlington-template.js version from v=19 to v=20**

Change:
```html
  <script src="/js/carlington-template.js?v=19" defer></script>
```

To:
```html
  <script src="/js/carlington-template.js?v=20" defer></script>
```

- [ ] **Step 2: Verify the change**

```bash
grep "carlington-template.js" /Users/sk_hga/lawfirmprojet/covington-burling/public/admin/index.html
```

Expected: `<script src="/js/carlington-template.js?v=20" defer></script>`

- [ ] **Step 3: Commit**

```bash
git -C /Users/sk_hga/lawfirmprojet/covington-burling add public/admin/index.html
git -C /Users/sk_hga/lawfirmprojet/covington-burling commit -m "chore: bump carlington-template.js to v=20 (cache-bust after font fix)"
```

---

## Task 3: Deploy and verify

- [ ] **Step 1: Deploy to Vercel production**

```bash
vercel --prod 2>&1
```

Expected: `▲ Aliased  https://carlingtonburling.com` and `"readyState": "READY"`.

- [ ] **Step 2: Push to GitHub**

```bash
git -C /Users/sk_hga/lawfirmprojet/covington-burling push origin main
```

- [ ] **Step 3: Generate a test PDF from the admin builder and open it**

Log in at `https://carlingtonburling.com/admin` with `covbur1927`, go to Document Builder, generate either a Waiver or NDA, download it, and open it.

Expected: firm name, tagline, contact line, document title, body text, clauses, signature blocks, and footer text all render correctly in Cormorant Garamond and Montserrat. No blank text.

- [ ] **Step 4: Spot-check both font faces**

Confirm in the PDF:
- Firm name "Carlington & Burling" renders in Cormorant Garamond Bold (serif)
- Tagline "LLP · ATTORNEYS AT LAW · SINCE 1927" renders in Montserrat (sans)
- Body clauses render in Cormorant Garamond Regular
- Footer text renders in Montserrat

---

## Root Cause Summary

pdf-lib's `embedFont()` requires OpenType (`.otf`) or TrueType (`.ttf`) bytes. WOFF is a compressed web wrapper around the same data but with a different binary header that pdf-lib/fontkit cannot parse — it throws internally or produces a corrupt font object, causing all text drawn with that font to be invisible (zero-width, zero-height glyphs). The fix is `.woff` → `.ttf` in the four URL strings. No other changes needed.
