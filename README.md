# AMG Library

AMG Library is a learner-focused library portal for discovering books, applying for membership, requesting loans, accessing digital resources and managing library operations.

## Project structure

The front end is a React 19 application built with Vite.

- `index.html` — Vite entry document; it only mounts `<div id="root">`.
- `src/main.jsx` — React root, shared stylesheet import and service-worker registration.
- `src/App.jsx` — provider stack, section routing and the mounted page sections.
- `src/store/` — `ToastProvider`, `AuthProvider` (session, profile, librarian claim) and `LibraryProvider` (Firestore, Storage and callable Functions).
- `src/components/` — `Navbar`, `Hero`, `LibShelf`, `MemberProfile`, `NewsSection`, `AuthModal`, `CardModal`, `MemberCard`, `Barcode`.
- `src/components/librarian/` — `Desk` plus the membership, inventory, attendance, content and statistics tabs.
- `src/lib/` — Firebase singleton, formatting helpers and the learner-profile transaction.
- `amg-design-system.css` — the responsive visual foundation shared by the public site, member area and librarian workspace.
- `firebase-config.js` — Firebase web-app configuration. Firebase web config values are public identifiers; never put service-account credentials here.
- `firestore.rules`, `storage.rules` — database and file-access rules.
- `functions/` — trusted server-side membership, barcode and attendance operations.
- `service-worker.js`, `manifest.webmanifest` — installable PWA shell and offline caching.
- `AMG.images/` — website and PWA artwork.
- `scripts/build-static.mjs` — copies the non-bundled PWA files and artwork into `dist/` and verifies the Vite output.
- `scripts/strip-ebook-download-urls.cjs` — one-off admin cleanup that removes stored download URLs from older e-book records.

## Local checks

Use Node.js 20 or later.

```bash
npm install
npm run dev      # local development server with hot reloading
npm test         # structure, security and build checks
npm run build    # production build in dist/
npm run preview  # serve the production build
```

The test command checks the React entry point, the DOM contract the stylesheet depends on, the librarian navigation, async form-handler regressions, the Firebase rules, and the production build. The build output is written to `dist/`.

## Firebase setup and deployment

1. Create or select the AMG Firebase project.
2. Register a Web App and put its public web configuration in `firebase-config.js`.
3. Enable Email/Password in Firebase Authentication.
4. Deploy the Firestore and Storage rules from `firestore.rules` and `storage.rules`.
5. Deploy the callable Cloud Functions from `functions/`. The functions use the Admin SDK and must run in a Firebase project with the required billing and Functions permissions.
6. Create the librarian Authentication account, then assign the `librarian: true` custom claim using the trusted admin script. Do not expose a service-account key in the browser or commit it to Git.
7. Confirm the librarian can sign in and that the Librarian Desk is only shown to an account with the server-issued custom claim.

The client-side interface never grants librarian access by itself. Firestore, Storage and callable Functions enforce authorization independently.

### Digital library access

Visitors may browse the e-book catalogue without an account, but the files themselves are only served to signed-in users:

- `firestore.rules` makes `ebooks` documents world-readable so titles and categories appear on the public shelf.
- `storage.rules` only allows `ebooks/` reads when `signedIn()`, so the file behind a title still needs an account.
- A Firebase Storage download URL is itself an access token, so `uploadEbook` stores only the `storagePath`. The app calls `getDownloadURL` on demand through the `resolveEbookUrl` helper, which requires a signed-in user.

If the project already holds e-books uploaded before this change, run the cleanup once with Admin SDK credentials so the old tokenised URLs stop leaking files:

```bash
npm run clean-ebook-urls
```

## Deployment

The repository is configured for a static Vercel deployment. With the Git repository connected, pushes to `main` trigger a deployment using:

- Install command: `npm install` (the Vite toolchain is a dev dependency)
- Build command: `npm run build`
- Output directory: `dist`

After a deployment, verify the public homepage, sign-in and registration, catalogue search, member card, librarian dashboard, barcode workflows and PWA installation on both desktop and a real mobile browser. Browser/device testing is still required in addition to automated CI.

## Security notes

- Never commit Firebase service-account JSON, private keys, access tokens or passwords.
- Do not change Firestore or Storage rules to public write access to make a client-side error disappear.
- Membership approval and librarian permissions are server-controlled.
- Test security-rule changes with the Firebase emulators before deployment.
