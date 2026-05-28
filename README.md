# Covington & Burling LLP — Website

Professional law firm website for **Covington & Burling LLP**, a preeminent international law firm founded in 1919 in Washington, D.C.

## Project Structure

```
covington-burling/
├── public/
│   ├── index.html              # Home page
│   ├── about.html              # Firm history + attorney bio
│   ├── practice.html           # 7 practice areas
│   ├── contact.html            # Contact form + HQ details
│   ├── waiver-nda.html         # Fillable PDF downloads
│   ├── 404.html                # Custom 404 page
│   ├── css/
│   │   └── styles.css          # Complete stylesheet (WCAG AA compliant)
│   ├── js/
│   │   ├── main.js             # Navigation, scroll, accordion
│   │   └── contact-form.js     # Form validation
│   ├── forms/
│   │   ├── waiver-fillable.pdf # Fillable Waiver form
│   │   └── nda-fillable.pdf    # Fillable NDA form
│   └── images/                 # Image assets (placeholder headshot)
├── server.js                   # Express server (PDF generation)
├── functions/                  # Firebase Cloud Functions
│   ├── index.js                # PDF generation endpoints
│   └── package.json
├── pdf-templates/
│   ├── waiver-definition.js    # pdfmake waiver definition
│   └── nda-definition.js       # pdfmake NDA definition
├── scripts/
│   └── generate-fillable-pdfs.js  # One-off script to create fillable PDFs
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
cd functions && npm install && cd ..
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

### Generate Fillable PDFs

The fillable PDF forms are pre-generated in `public/forms/`. To regenerate them:

```bash
node scripts/generate-fillable-pdfs.js
```

## Deployment

### Firebase Hosting

```bash
firebase deploy --only hosting
```

Live at: **https://covington-burling-llp.web.app**

### Firebase Cloud Functions (PDF server)

Requires Firebase Blaze (pay-as-you-go) plan. Once upgraded:

```bash
firebase deploy --only functions
```

The API endpoints will be available at:
- `POST /api/generate-waiver`
- `POST /api/generate-nda`

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
- [ ] Upgrade Firebase to Blaze plan for Cloud Functions
- [ ] Review all content with firm stakeholders
- [ ] Set up CAPTCHA or spam protection on the contact form
- [ ] Add a privacy policy page
