# Update PDF Contact Line Domain: covbur.com → carlingtonburling.com

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `covbur.com` with `carlingtonburling.com` in the PDF document header contact line.

**Architecture:** The contact line is rendered in two parts: a slate-colored prefix (`contactPre`) and a gold-colored domain (`contactDomain`). A third constant, `CONTACT_LINE`, holds the full concatenated string and is used only for horizontal centering math (`fonts.sans.widthOfTextAtSize(CONTACT_LINE, size)`). All three values are in `carlington-template.js`. Both `CONTACT_LINE` and `contactDomain` must be updated to the new domain — if only one changes, the gold domain text will render at the wrong x position (mis-centered). The preview HTML is a separate file used only for design reference; it is updated separately so it stays in sync.

**Tech Stack:** pdf-lib, vanilla JS, Vercel static hosting

---

## File Map

| File | What changes |
|---|---|
| `public/js/carlington-template.js` | Line 27: `CONTACT_LINE` constant; Line 158: `contactDomain` local variable |
| `public/admin/index.html` | Bump `carlington-template.js?v=20` → `?v=21` |
| `public/_doc-header-preview.html` | Line 245, 318: `covbur.com` → `carlingtonburling.com` (keeps preview in sync) |

---

## Task 1: Update carlington-template.js

**Files:**
- Modify: `public/js/carlington-template.js:27`
- Modify: `public/js/carlington-template.js:158`

- [ ] **Step 1: Update CONTACT_LINE constant (line 27)**

Change:
```js
  var CONTACT_LINE = '850 Tenth Street NW, Washington, DC 20001  ·  202-662-6000  ·  covbur.com';
```
To:
```js
  var CONTACT_LINE = '850 Tenth Street NW, Washington, DC 20001  ·  202-662-6000  ·  carlingtonburling.com';
```

- [ ] **Step 2: Update contactDomain variable (line 158)**

Change:
```js
    var contactDomain = 'covbur.com';
```
To:
```js
    var contactDomain = 'carlingtonburling.com';
```

- [ ] **Step 3: Verify both changes and no remaining covbur.com in the template**

```bash
grep -n "covbur\|carlingtonburling" /Users/sk_hga/lawfirmprojet/covington-burling/public/js/carlington-template.js
```

Expected:
```
27:  var CONTACT_LINE = '850 Tenth Street NW, Washington, DC 20001  ·  202-662-6000  ·  carlingtonburling.com';
158:    var contactDomain = 'carlingtonburling.com';
```

No line should contain `covbur`.

- [ ] **Step 4: Commit**

```bash
git -C /Users/sk_hga/lawfirmprojet/covington-burling add public/js/carlington-template.js
git -C /Users/sk_hga/lawfirmprojet/covington-burling commit -m "fix: update PDF contact line domain covbur.com → carlingtonburling.com"
```

---

## Task 2: Bump version in admin HTML

**Files:**
- Modify: `public/admin/index.html` — `carlington-template.js?v=20` → `?v=21`

- [ ] **Step 1: Bump the script version**

Change:
```html
  <script src="/js/carlington-template.js?v=20" defer></script>
```
To:
```html
  <script src="/js/carlington-template.js?v=21" defer></script>
```

- [ ] **Step 2: Verify**

```bash
grep "carlington-template.js" /Users/sk_hga/lawfirmprojet/covington-burling/public/admin/index.html
```

Expected: `<script src="/js/carlington-template.js?v=21" defer></script>`

- [ ] **Step 3: Commit**

```bash
git -C /Users/sk_hga/lawfirmprojet/covington-burling add public/admin/index.html
git -C /Users/sk_hga/lawfirmprojet/covington-burling commit -m "chore: bump carlington-template.js to v=21 (domain update cache-bust)"
```

---

## Task 3: Update preview HTML (design reference sync)

**Files:**
- Modify: `public/_doc-header-preview.html:245`
- Modify: `public/_doc-header-preview.html:318`

- [ ] **Step 1: Replace both covbur.com occurrences in the preview**

```bash
sed -i '' 's/covbur\.com/carlingtonburling.com/g' /Users/sk_hga/lawfirmprojet/covington-burling/public/_doc-header-preview.html
```

- [ ] **Step 2: Verify**

```bash
grep -n "covbur\|carlingtonburling" /Users/sk_hga/lawfirmprojet/covington-burling/public/_doc-header-preview.html
```

Expected: two lines, both containing `carlingtonburling.com`, none containing `covbur`.

- [ ] **Step 3: Commit**

```bash
git -C /Users/sk_hga/lawfirmprojet/covington-burling add public/_doc-header-preview.html
git -C /Users/sk_hga/lawfirmprojet/covington-burling commit -m "chore: update preview HTML domain to carlingtonburling.com"
```

---

## Task 4: Deploy and verify

- [ ] **Step 1: Deploy to Vercel production**

```bash
vercel --prod 2>&1
```

Expected: `▲ Aliased  https://carlingtonburling.com` and `"readyState": "READY"`.

- [ ] **Step 2: Push to GitHub**

```bash
git -C /Users/sk_hga/lawfirmprojet/covington-burling push origin main
```

- [ ] **Step 3: Generate a test PDF and verify the contact line**

Log in at `https://carlingtonburling.com/admin`, go to Document Builder, generate a Waiver or NDA, download and open the PDF.

Verify in the PDF header contact line:
```
850 Tenth Street NW, Washington, DC 20001  ·  202-662-6000  ·  carlingtonburling.com
```
- The address and phone number render in slate/gray (Montserrat 400)
- `carlingtonburling.com` renders in gold (Montserrat 500)
- The entire line is centered on the page

---

## Why two variables must change together

`CONTACT_LINE` is used only to measure the total pixel width of the full line:
```js
var contactW = fonts.sans.widthOfTextAtSize(CONTACT_LINE, contactSize);
```
This width drives the starting x position for both text segments:
```js
page.drawText(contactPre, { x: centerX - contactW / 2, ... });
page.drawText(contactDomain, { x: centerX - contactW / 2 + preW, ... });
```
If `CONTACT_LINE` is updated but `contactDomain` is not (or vice versa), `contactW` will be computed from the new domain length but `contactDomain` will draw the old shorter string — the gold text will appear at the correct x position but show the wrong domain. Both must match.
