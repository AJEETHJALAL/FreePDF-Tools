# FreePDF Tools — ready-to-deploy starter

A responsive, static PDF utility website. JPG/PNG-to-PDF, merge PDF, extract page ranges, and PDF-to-JPG are processed in the browser. There is no login, database, upload API, or file-storage server in this starter.

## Files
- `index.html` — main page and tool UI
- `styles.css` — responsive styling
- `app.js` — browser-side conversion logic
- `privacy.html` and `terms.html` — starter policy pages; customize before launch

## Test locally
Because the app loads JavaScript libraries from CDNs, internet access is required. You can open `index.html` directly in a modern browser, or run a local static server:
```bash
python -m http.server 8000
```
Then open `http://localhost:8000`.

## Deploy free with Cloudflare Pages
1. Create a GitHub repository and upload the files in this folder to its root.
2. Sign in to Cloudflare and open Workers & Pages → Create → Pages → Connect to Git.
3. Select your repository.
4. For a plain static site, use no build command and set the output directory to `/` (or follow the current Cloudflare Pages UI instructions for a root-level static site).
5. Deploy and test the generated `*.pages.dev` URL on desktop Chrome and mobile Chrome.
6. Contact email is set to `studentmart24x7@gmail.com`. Review and adapt the privacy policy and terms for your actual business, country, and services.
7. Test all tools using non-sensitive sample files before sharing the website publicly.

Cloudflare's free-plan features and limits may change. Check current plan terms before launch. A custom domain is optional and normally costs money; start with the free subdomain if you want to keep startup costs at zero.

## Advertising / AdSense
The visible ad boxes are placeholders, not live ads. Do not replace them with fake ad interactions or encourage users to click ads.
1. Make the site useful, complete, and accessible first.
2. Apply at https://adsense.google.com/ using accurate account and payment details.
3. After approval, follow the ad provider's instructions for verification, ads.txt (if required), ad code, and consent requirements.
4. Update the privacy policy before enabling personalized ads, cookies, analytics, or other third-party advertising features.
5. Keep ads clearly separate from file upload, conversion, and download controls. Avoid accidental-click layouts.

Approval and income are not guaranteed. Ad policies, consent rules, and account/payment requirements vary by country and can change.

## Privacy and technical notes
- Files are handled in browser memory; the app does not send document contents to a FreePDF Tools backend.
- The PDF libraries are loaded from CDNs. CDN requests expose ordinary request metadata to the CDN. For tighter privacy, download and self-host pinned, trusted versions and update the PDF.js worker URL accordingly.
- Large PDFs can use significant RAM/CPU. Some phones may fail on large files; show clear errors and avoid promising unlimited file sizes.
- PDF-to-JPG exports pages into a ZIP file because one download cannot conveniently contain multiple independent images on all browsers.
- Password-protected PDFs may fail. This starter does not provide OCR, Office document conversion, advanced compression, or guaranteed preservation of all PDF features.
- The code is a starter implementation, not a security audit. Test thoroughly before production use.

## Before launch checklist
- [ ] Replace example contact email
- [ ] Review privacy/terms for your jurisdiction and actual ad provider
- [ ] Test JPG, PNG, merge, split page ranges, and PDF-to-JPG on desktop and mobile
- [ ] Test error cases, very large files, encrypted PDFs, and low-memory phones
- [ ] Add a real favicon and social preview if desired
- [ ] Configure analytics only if needed and disclose it
- [ ] Apply for ads only after the website is complete
