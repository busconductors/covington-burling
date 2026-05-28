# Covington & Burling LLP — Website

Professional law firm website for **Covington & Burling LLP**, a preeminent international law firm founded in 1919 in Washington, D.C.

## Project Structure

```
covington-burling/
├── public/
│   ├── index.html           # Home page
│   ├── about.html           # Firm history + attorney bio
│   ├── practice.html        # 7 practice areas
│   ├── contact.html         # Contact form + HQ details
│   ├── waiver-nda.html      # Waiver & NDA download page
│   ├── 404.html             # Custom 404 page
│   ├── css/
│   │   └── styles.css       # Complete stylesheet (WCAG AA compliant)
│   ├── js/
│   │   ├── main.js           # Navigation, scroll, accordion
│   │   ├── contact-form.js   # Form validation
│   │   └── pdf-generation.js # PDF download handler
│   └── images/              # Image assets (placeholder headshot)
├── server.js                # Express server (PDF generation)
├── pdf-templates/
│   ├── waiver-definition.js # pdfmake waiver definition
│   └── nda-definition.js    # pdfmake NDA definition
├── latex/
│   ├── waiver.tex           # LaTeX source: Waiver & Release of Liability
│   └── nda.tex              # LaTeX source: Mutual NDA
├── package.json
├── .gitignore
├── firebase.json
└── README.md
```

## Firm Data

All firm and lawyer details verified. Covington & Burling LLP is an active Am Law 100 firm. David M. Gottesman is a verified partner (DC Bar #1003706). Domain covbur.com was available at time of research — verify before purchase.

- **HQ:** 850 Tenth Street NW, Washington, DC 20001
- **Phone:** 202-662-6000
- **Founded:** 1919

## Setup Instructions

### Prerequisites
- Node.js 18+
- npm

### Install Dependencies

```bash
npm install
```

### Run PDF Server Locally

```bash
npm start
```

Server runs at `http://localhost:3000`. The PDF generation endpoints are:

- `POST /api/generate-waiver` — Waiver and Release of Liability
- `POST /api/generate-nda` — Mutual Non-Disclosure Agreement

### View the Static Site

Just open `public/index.html` in a browser, or use a static server:

```bash
npx serve public
```

## Deployment

### Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # Select existing project or create new
firebase deploy --only hosting
```

### Netlify

Drag the `public/` folder to Netlify Drop, or create a `netlify.toml`:

```toml
[build]
  publish = "public"

[[redirects]]
  from = "/api/*"
  to = "https://your-server-url.com/api/:splat"
  status = 200
```

## LaTeX Documents

Two LaTeX source files are provided for download and editing:

- **waiver.tex** — WAIVER AND RELEASE OF LIABILITY (5 clauses, signature blocks)
- **nda.tex** — MUTUAL NON-DISCLOSURE AGREEMENT (5 clauses, dual signature blocks)

### Compile with pdflatex

```bash
cd latex
pdflatex waiver.tex
pdflatex nda.tex
```

Both templates use Covington & Burling LLP as the firm name throughout.

## Accessibility

This site is designed to meet WCAG 2.1 AA standards:

- Semantic HTML5 (header, nav, main, footer)
- Color contrast ≥4.5:1 for normal text, ≥3:1 for large text
- Skip-to-content link on every page
- All interactive elements are keyboard-accessible with visible focus indicators
- Form labels are programmatically associated with inputs
- ARIA attributes on mobile navigation and accordion components
- Responsive layout (mobile-first, breakpoints at 640px, 768px, 1024px)

## User Checklist

- [ ] Verify domain availability and purchase covbur.com or alternative
- [ ] Replace placeholder headshot image for David M. Gottesman
- [ ] Verify phone number 202-662-6000 before publishing
- [ ] Set up contact form email integration (currently logs to console)
- [ ] Configure Firebase or Netlify deployment
- [ ] Review all content with firm stakeholders
- [ ] Verify LaTeX documents compile with pdflatex before distribution
- [ ] Set up CAPTCHA or spam protection on the contact form
- [ ] Add a privacy policy page
- [ ] Replace favicon.ico with the firm's actual icon
