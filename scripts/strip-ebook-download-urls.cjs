// One-off cleanup for e-book records created before the catalogue became public.
//
// The `ebooks` collection is now world-readable so visitors can browse titles,
// but a Firebase Storage download URL carries its own access token and therefore
// works without signing in. Older records stored one in `downloadUrl`, which
// would hand the actual file to guests. This script deletes that field so the
// app has to resolve the file through Storage rules that require an account.
//
// Run locally from a trusted computer with Firebase Admin SDK credentials.
// Do not upload service-account credentials to GitHub or run this in the browser.
const admin = require("firebase-admin");

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("Set GOOGLE_APPLICATION_CREDENTIALS to a local service-account JSON path.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

(async () => {
  try {
    const snapshot = await admin.firestore().collection("ebooks").get();
    const stale = snapshot.docs.filter(item => "downloadUrl" in item.data());
    if (!stale.length) {
      console.log(`No e-book records need cleaning up (${snapshot.size} checked).`);
      return;
    }

    let updated = 0;
    let batch = admin.firestore().batch();
    for (const item of stale) {
      batch.update(item.ref, { downloadUrl: admin.firestore.FieldValue.delete() });
      updated += 1;
      // Firestore batches are capped at 500 writes.
      if (updated % 400 === 0) {
        await batch.commit();
        batch = admin.firestore().batch();
      }
    }
    await batch.commit();
    console.log(`Removed the stored download URL from ${updated} of ${snapshot.size} e-book records.`);
  } catch (error) {
    console.error("Could not clean up e-book records:", error.message);
    process.exitCode = 1;
  } finally {
    await admin.app().delete();
  }
})();
