// Run locally from a trusted computer with Firebase Admin SDK credentials.
// Do not upload service-account credentials to GitHub or run this in the browser.
const admin = require("firebase-admin");

const email = process.argv[2];
if (!email || !email.includes("@")) {
  console.error("Usage: npm run set-librarian -- librarian@example.com");
  process.exit(1);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("Set GOOGLE_APPLICATION_CREDENTIALS to a local service-account JSON path.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

(async () => {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, {
      ...(user.customClaims || {}),
      librarian: true
    });
    console.log(`Librarian role granted to ${email} (${user.uid}). Sign out and back in to refresh claims.`);
  } catch (error) {
    console.error("Could not grant librarian role:", error.message);
    process.exitCode = 1;
  } finally {
    await admin.app().delete();
  }
})();
