# Replace Attorney: David M. Gottesman → Max Theodore

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every occurrence of "David M. Gottesman" with "Max Theodore", swap the monogram CSS fallback from DG → MT, add the real headshot photo, and deploy to production.

**Architecture:** Static site served from `public/` via Vercel. No build step — changes to HTML/CSS/images go live on next `vercel --prod` deploy. Image is copied from Downloads into `public/images/` and referenced via a standard `<img>` tag replacing the current CSS placeholder.

**Tech Stack:** HTML, CSS, Vercel CLI

---

## File Map

| File | What changes |
|---|---|
| `public/images/max-theodore.webp` | NEW — copied from `/Users/sk_hga/Downloads/Max_Theodore.webp` |
| `public/index.html` | Name (×2), aria-label, placeholder → `<img>` |
| `public/about.html` | Meta description, name (×4), aria-label, placeholder → `<img>` |
| `public/css/styles.css` | `content: 'DG'` → `content: 'MT'` (CSS fallback monogram) |
| `README.md` | Documentation references (×2) |

---

## Task 1: Copy the headshot image

**Files:**
- Create: `public/images/max-theodore.webp`

- [ ] **Step 1: Copy image into the public assets folder**

```bash
cp /Users/sk_hga/Downloads/Max_Theodore.webp /Users/sk_hga/lawfirmprojet/covington-burling/public/images/max-theodore.webp
```

- [ ] **Step 2: Verify the file exists and is non-empty**

```bash
ls -lh /Users/sk_hga/lawfirmprojet/covington-burling/public/images/max-theodore.webp
```

Expected: file listed with size > 0 bytes.

- [ ] **Step 3: Commit**

```bash
git -C /Users/sk_hga/lawfirmprojet/covington-burling add public/images/max-theodore.webp
git -C /Users/sk_hga/lawfirmprojet/covington-burling commit -m "feat: add Max Theodore headshot photo"
```

---

## Task 2: Update index.html

**Files:**
- Modify: `public/index.html:104` — attorney name in credentials
- Modify: `public/index.html:121` — aria-label on image wrapper
- Modify: `public/index.html:122-124` — replace placeholder div with real `<img>`

- [ ] **Step 1: Replace attorney name in credentials block (line 104)**

Old:
```html
              <h3 class="attorney-spotlight__name">David M. Gottesman</h3>
```
New:
```html
              <h3 class="attorney-spotlight__name">Max Theodore</h3>
```

- [ ] **Step 2: Replace aria-label and placeholder with real image (lines 121-124)**

Old:
```html
          <div class="attorney-spotlight__image" aria-label="David M. Gottesman, Partner">
            <div class="attorney-spotlight__image-placeholder">
              David M. Gottesman<br><span class="attorney-spotlight__role" style="color:var(--text-on-dark-muted);">Partner</span>
            </div>
          </div>
```
New:
```html
          <div class="attorney-spotlight__image" aria-label="Max Theodore, Partner">
            <img src="/images/max-theodore.webp" alt="Max Theodore, Partner" class="attorney-spotlight__image-photo" loading="lazy" width="480" height="480">
          </div>
```

- [ ] **Step 3: Verify no remaining "Gottesman" or "David M." in index.html**

```bash
grep -n "Gottesman\|David M\." /Users/sk_hga/lawfirmprojet/covington-burling/public/index.html
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git -C /Users/sk_hga/lawfirmprojet/covington-burling add public/index.html
git -C /Users/sk_hga/lawfirmprojet/covington-burling commit -m "feat: replace Gottesman with Max Theodore in index.html, swap placeholder for real headshot"
```

---

## Task 3: Update about.html

**Files:**
- Modify: `public/about.html:6` — meta description
- Modify: `public/about.html:88-92` — aria-label + placeholder → `<img>`
- Modify: `public/about.html:94` — h3 name
- Modify: `public/about.html:96` — bio paragraph (×2 occurrences)
- Modify: `public/about.html:151` — FAQ question text
- Modify: `public/about.html:155` — FAQ answer text (×2 occurrences)

- [ ] **Step 1: Update meta description (line 6)**

Old:
```html
  <meta name="description" content="About Carlington &amp; Burling LLP — Founded 1927 in Washington, D.C. Learn about our firm history and featured attorney David M. Gottesman.">
```
New:
```html
  <meta name="description" content="About Carlington &amp; Burling LLP — Founded 1927 in Washington, D.C. Learn about our firm history and featured attorney Max Theodore.">
```

- [ ] **Step 2: Replace aria-label and placeholder with real image (lines 88-92)**

Old:
```html
          <div class="attorney-spotlight__image" aria-label="David M. Gottesman, Partner">
            <div class="attorney-spotlight__image-placeholder">
              David M. Gottesman<br><span style="color:var(--text-light);">Partner</span>
            </div>
          </div>
```
New:
```html
          <div class="attorney-spotlight__image" aria-label="Max Theodore, Partner">
            <img src="/images/max-theodore.webp" alt="Max Theodore, Partner" class="attorney-spotlight__image-photo" loading="lazy" width="480" height="480">
          </div>
```

- [ ] **Step 3: Replace name in h3 heading (line 94)**

Old:
```html
            <h3>David M. Gottesman</h3>
```
New:
```html
            <h3>Max Theodore</h3>
```

- [ ] **Step 4: Replace name in bio paragraph (line 96)**

Old:
```html
            <p class="text-muted bio-detail__note">David M. Gottesman is a partner in the firm&rsquo;s Washington, D.C. office. His practice focuses on complex commercial litigation and appellate advocacy, representing clients before federal and state courts, arbitration panels, and regulatory bodies.</p>
```
New:
```html
            <p class="text-muted bio-detail__note">Max Theodore is a partner in the firm&rsquo;s Washington, D.C. office. His practice focuses on complex commercial litigation and appellate advocacy, representing clients before federal and state courts, arbitration panels, and regulatory bodies.</p>
```

- [ ] **Step 5: Replace name in FAQ question (line 151)**

Old:
```html
              Is David M. Gottesman accepting new clients?
```
New:
```html
              Is Max Theodore accepting new clients?
```

- [ ] **Step 6: Replace name in FAQ answer (line 155)**

Old:
```html
              <div class="accordion__panel-content">David M. Gottesman is an active partner at the firm. For inquiries regarding his availability, please contact our office directly at 202-555-0142. All consultations are confidential and protected by attorney-client privilege.</div>
```
New:
```html
              <div class="accordion__panel-content">Max Theodore is an active partner at the firm. For inquiries regarding his availability, please contact our office directly at 202-555-0142. All consultations are confidential and protected by attorney-client privilege.</div>
```

- [ ] **Step 7: Verify no remaining "Gottesman" or "David M." in about.html**

```bash
grep -n "Gottesman\|David M\." /Users/sk_hga/lawfirmprojet/covington-burling/public/about.html
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git -C /Users/sk_hga/lawfirmprojet/covington-burling add public/about.html
git -C /Users/sk_hga/lawfirmprojet/covington-burling commit -m "feat: replace Gottesman with Max Theodore in about.html, swap placeholder for real headshot"
```

---

## Task 4: Update CSS monogram fallback

**Files:**
- Modify: `public/css/styles.css:877` — `content: 'DG'` → `content: 'MT'`

The `::before` pseudo-element renders initials over the gradient background if the `<img>` fails to load. Update it to match the new name.

- [ ] **Step 1: Update monogram initials in CSS**

Old:
```css
  content: 'DG';
```
New:
```css
  content: 'MT';
```

- [ ] **Step 2: Add `object-fit` CSS for the real photo**

Add this new rule after `.attorney-spotlight__image-placeholder { ... }`:

```css
.attorney-spotlight__image-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  display: block;
}
```

- [ ] **Step 3: Verify CSS change**

```bash
grep -n "content: 'DG'\|content: 'MT'" /Users/sk_hga/lawfirmprojet/covington-burling/public/css/styles.css
```

Expected: one line showing `content: 'MT'`.

- [ ] **Step 4: Commit**

```bash
git -C /Users/sk_hga/lawfirmprojet/covington-burling add public/css/styles.css
git -C /Users/sk_hga/lawfirmprojet/covington-burling commit -m "feat: update CSS monogram fallback DG → MT, add image-photo object-fit rule"
```

---

## Task 5: Update README.md

**Files:**
- Modify: `README.md:42` — verified partner note
- Modify: `README.md:125` — placeholder headshot TODO

- [ ] **Step 1: Update README line 42**

Old:
```
David M. Gottesman is a verified partner (DC Bar #1003706).
```
New:
```
Max Theodore is the featured partner.
```

- [ ] **Step 2: Update README line 125**

Old:
```
- [ ] Replace placeholder headshot image for David M. Gottesman
```
New:
```
- [x] Replace placeholder headshot image for Max Theodore
```

- [ ] **Step 3: Verify no remaining references**

```bash
grep -n "Gottesman\|David M\." /Users/sk_hga/lawfirmprojet/covington-burling/README.md
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git -C /Users/sk_hga/lawfirmprojet/covington-burling add README.md
git -C /Users/sk_hga/lawfirmprojet/covington-burling commit -m "docs: update README — Gottesman → Max Theodore, mark headshot TODO done"
```

---

## Task 6: Final verification and deploy

- [ ] **Step 1: Global grep — confirm zero remaining references**

```bash
grep -rn "Gottesman\|David M\." /Users/sk_hga/lawfirmprojet/covington-burling/ --include="*.html" --include="*.css" --include="*.js" --include="*.md"
```

Expected: no output.

- [ ] **Step 2: Check DG monogram is gone from CSS**

```bash
grep -n "'DG'" /Users/sk_hga/lawfirmprojet/covington-burling/public/css/styles.css
```

Expected: no output.

- [ ] **Step 3: Confirm image is in place**

```bash
ls -lh /Users/sk_hga/lawfirmprojet/covington-burling/public/images/max-theodore.webp
```

Expected: file present with reasonable size (>50 KB).

- [ ] **Step 4: Deploy to Vercel production**

```bash
vercel --prod 2>&1
```

Expected: `● Aliased  https://carlingtonburling.com` and status `READY`.

- [ ] **Step 5: Spot-check live URLs**

Verify the name and photo appear correctly:
- https://carlingtonburling.com (homepage attorney spotlight)
- https://carlingtonburling.com/about (bio section + FAQ)
