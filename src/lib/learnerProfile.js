import { doc, runTransaction, serverTimestamp } from "firebase/firestore";

/**
 * Create the learner profile on the client so registration keeps working on a
 * Firebase Spark project. The member number is reserved in the same
 * transaction; firestore.rules verifies the pairing with getAfter().
 */
export async function createLearnerProfile(db, uid, email, profileInput) {
  const userRef = doc(db, "users", uid);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const libraryNumber = "AMG-" + String(100000 + (random[0] % 900000));
    const numberRef = doc(db, "memberNumbers", libraryNumber);

    const result = await runTransaction(db, async (transaction) => {
      const [existingProfile, reservedNumber] = await Promise.all([
        transaction.get(userRef),
        transaction.get(numberRef)
      ]);

      if (existingProfile.exists()) {
        const existing = existingProfile.data();
        if (existing.role !== "learner" || existing.email !== email) {
          throw new Error("This account already has a different library profile. Please contact the librarian.");
        }
        return { profile: existing, created: false };
      }
      if (reservedNumber.exists()) return null;

      const timestamp = serverTimestamp();
      const profile = {
        uid,
        ...profileInput,
        email,
        libraryNumber,
        role: "learner",
        isApproved: false,
        membershipStatus: "Pending",
        photoURL: "",
        starredBookIds: [],
        createdAt: timestamp,
        updatedAt: timestamp
      };

      transaction.set(numberRef, { uid, createdAt: timestamp });
      transaction.set(userRef, profile);
      return { profile: { ...profile, createdAt: new Date(), updatedAt: new Date() }, created: true };
    });

    if (result) return result;
  }

  throw new Error("A library number could not be allocated. Please try again.");
}
