# fairyhooks.com

Marketing website for **FairyHooks**, a woodworking planning tool by **Foglia LLC**.
It helps customers create precise cut lists, sheet cutting layouts and assembly plans for furniture.

Static site: plain HTML, CSS and JavaScript. No build step, no dependencies.

## Structure

```
fairyhooks.com/
├── index.html            Landing page (hero, how it works, features, assembly guide, free planner, FAQ, early access)
├── privacy.html          Privacy policy
├── 404.html              Not found page
├── assets/
│   ├── css/style.css
│   ├── js/planner.js     Cut list optimizer (guillotine packing with kerf and edge trim)
│   ├── js/main.js        Navigation, planner UI, CSV export, early access form
│   ├── js/visuals.js     Hero cut-plan animation, isometric assembly player, scroll reveal
│   └── img/logo.svg      Logo and favicon
├── CNAME                 Custom domain for GitHub Pages
├── robots.txt
└── sitemap.xml
```

## Run locally

```bash
cd fairyhooks.com
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

Any static host works. Publish the contents of this folder as the site root.

- **Cloudflare Pages / Netlify**: set the build output (publish) directory to `fairyhooks.com`, no build command.
- **GitHub Pages**: Pages only serves from the repo root or `/docs`, so either move this folder into its own repository or copy it to `/docs`. The `CNAME` file sets the custom domain.

DNS for `fairyhooks.com`: point the apex and `www` to your host as its docs describe (for GitHub Pages, A records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` and a `www` CNAME to `<user>.github.io`).

## Things to update before launch

- Contact email `hello@fairyhooks.com` (used in the form, FAQ, footer and privacy page).
- The early access form opens the visitor's email app (`mailto:`). To collect signups directly, point the form at a form service (Formspree, Netlify Forms, etc.) in `assets/js/main.js`.
- Review `privacy.html` with someone qualified for your jurisdiction.
