# AMG Library
<img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/fdcaf279-c6fb-418e-968d-ab078e0bae8b" />

Responsive library web app for learner membership, catalogue search, borrowing, librarian circulation, membership cards, attendance, e-books, announcements and statistics.

## Current setup status
The Firebase client configuration is intentionally a placeholder. Do not use this as a live library until a real Firebase web configuration is added, the included rules are deployed, and a librarian custom claim is provisioned.

## Firebase setup
1. Create/select a project at https://console.firebase.google.com/ and add a Web App.
2. Copy the app config into `firebase-config.js`, replacing every `REPLACE_...` value. Web config is public; never put service-account keys in the browser.
3. Enable **Authentication → Email/Password**, create Firestore and enable Storage.
4. From the repository root, install the Firebase CLI and deploy rules:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use YOUR_FIREBASE_PROJECT_ID
   firebase deploy --only firestore:rules,storage
   ```
5. Create the staff account in Firebase Authentication using the librarian email you will set in `firebase-config.js`. For the requested write-up credentials, the login screen accepts the username **Librarian**; set the Firebase Auth password to **AMG@2026** when provisioning the account. This username is only a display/login alias: authentication still happens through Firebase, not a hardcoded password in browser code. After first access, rotate the default password to a unique strong password.
6. On a trusted local machine, download a service-account JSON to a location outside this repository. Set `GOOGLE_APPLICATION_CREDENTIALS` to that file path and run:
   ```bash
   npm install
   # Linux/macOS
   export GOOGLE_APPLICATION_CREDENTIALS="/secure/path/service-account.json"
   # Windows PowerShell
   # $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\secure\\path\\service-account.json"
   npm run set-librarian -- librarian@example.com
   ```
   Replace the email with the actual librarian account. Sign out and sign in again to refresh the custom claim. Never commit or share the service-account file.
7. Set `librarianEmail` in `firebase-config.js` to the same staff account email. The `firebase-config.js` value is a public identifier, not a secret. Run the command below to grant the account the librarian custom claim. Sign out and sign in again to refresh the claim. The librarian can then approve learners and register books.

## Features
- Learner registration with school, level, gender and parent/guardian details.
- Firebase Email/Password authentication and password reset.
- Librarian approval before borrowing.
- Searchable catalogue, category filter, starred books.
- Borrow request, approve/decline, issuing and returning with Firestore transactions.
- Membership card with unique library number, CODE-128 barcode and QR code.
- Optional camera photo capture or a selected illustrated avatar.
- Member directory and card downloads for librarians.
- Check-in/check-out by library number and optional camera scanning.
- Occupancy/remaining-capacity tracking.
- PDF/EPUB e-book uploads through Firebase Storage.
- News and events.
- Statistics for members, stock, borrowing and attendance.
- Responsive blue, green and white styling, with a home page featuring the library's mission, vision, services, values and membership journey.

## Authentication and data model
The login form accepts the librarian username `admin` and resolves it to the provisioned Firebase Auth account email in `firebase-config.js` (`librarianEmail`). Set this value to the actual librarian account email, and ensure that account has the `librarian: true` custom claim. Firebase Auth still verifies the password; the browser does not bypass authentication. The written default is `admin` / `admin`, but it must be provisioned in Firebase Auth intentionally and changed to a strong unique password before going live.

Member accounts still authenticate using the email associated with their Firebase account. True learner full-name login requires a trusted username-to-account mapping service; the public browser must not search private member records or weaken Firestore rules to simulate name-based login.

Librarian authorization uses a Firebase Authentication custom claim `librarian: true`. The UI checks this claim, but Firestore and Storage rules are the actual security boundary.

Collections: `users/{uid}`, `books/{bookId}`, `borrowRequests/{requestId}`, `loans/{loanId}`, `attendance/{attendanceId}`, `ebooks/{ebookId}`, `announcements/{id}`, `events/{id}`, and `settings/library`.

## Verification
Run from the repository root:
```bash
npm install
npm test
```
This checks JavaScript syntax only. Against your configured Firebase project, test registration, approval, claim authorization, book registration, request approval/return, e-book upload, attendance and denial of unauthorized writes.

## Vercel deployment
- Import `vince551/AMG`.
- Root Directory: repository root (default/blank). Do not select the empty `AMG/` directory.
- Framework preset: **Other**; Build Command blank; Output Directory `.`.
- Add the public Firebase web configuration in `firebase-config.js`, deploy a preview, and run the test checklist before production.

## Security
- Never commit service-account JSON, private keys, passwords or deployment tokens.
- The old sample librarian password in earlier notes is not used by this implementation.
- Rules deny admin writes unless the authenticated account has the librarian custom claim.
- Guardian contact information is readable only by the member and librarian.
- Camera scanning requires HTTPS and browser permission; manual library-number entry remains available.
