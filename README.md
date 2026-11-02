# AMG Library

AMG Library is a learner-focused library portal for discovering books, applying for membership, requesting loans, accessing digital resources and managing library operations.

## Project structure

- `index.html` — public website, learner profile, membership forms and librarian workspace.
- `app.js` — Firebase Authentication, Firestore, Storage and callable Functions integration.
- `amg-design-system.css` — the new responsive visual foundation for the public site, member area and librarian workspace.
- `mobile-effects.js` — progressive scroll reveals, counters and reading progress.
- `firebase-config.js` — Firebase web-app configuration. Firebase web config values are public identifiers; never put service-account credentials here.
- `firestore.rules`, `storage.rules` — database and file-access rules.
- `functions/` — trusted server-side membership, barcode and attendance operations.
- `service-worker.js`, `manifest.webmanifest` — installable PWA shell and offline caching.
- `AMG.images/` — website and PWA artwork.

## Local checks

Use Node.js 20 or later.

```bash
npm install
npm test
npm run build
```

The test command checks JavaScript syntax, static HTML/JavaScript references, async form-handler regressions, Firebase rules (in CI), and the production static build. The build output is written to `dist/`.

## Firebase setup and deployment

1. Create or select the AMG Firebase project.
2. Register a Web App and put its public web configuration in `firebase-config.js`.
3. Enable Email/Password in Firebase Authentication.
4. Deploy the Firestore and Storage rules from `firestore.rules` and `storage.rules`.
5. Deploy the callable Cloud Functions from `functions/`. The functions use the Admin SDK and must run in a Firebase project with the required billing and Functions permissions.
6. Create the librarian Authentication account, then assign the `librarian: true` custom claim using the trusted admin script. Do not expose a service-account key in the browser or commit it to Git.
7. Confirm the librarian can sign in and that the Librarian Desk is only shown to an account with the server-issued custom claim.

The client-side interface never grants librarian access by itself. Firestore, Storage and callable Functions enforce authorization independently.

## Deployment

The repository is configured for a static Vercel deployment. With the Git repository connected, pushes to `main` trigger a deployment using:

- Build command: `npm run build`
- Output directory: `dist`

After a deployment, verify the public homepage, sign-in and registration, catalogue search, member card, librarian dashboard, barcode workflows and PWA installation on both desktop and a real mobile browser. Browser/device testing is still required in addition to automated CI.

## Security notes

- Never commit Firebase service-account JSON, private keys, access tokens or passwords.
- Do not change Firestore or Storage rules to public write access to make a client-side error disappear.
- Membership approval and librarian permissions are server-controlled.
- Test security-rule changes with the Firebase emulators before deployment.
