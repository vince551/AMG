// Sample catalogue cards shown only while the Firestore `books` collection is
// empty, so the Lib Shelf demonstrates its layout before the librarian registers
// anything. They are presentation-only: nothing is written to Firestore and the
// borrow action is disabled for every entry here.
//
// `code` and `hue` drive the generated cover artwork, so no image files or
// external requests are needed.
export const DEMO_BOOKS = [
  {
    id: "demo-001", demo: true, code: "PP", hue: 28,
    title: "First Words, Big Pictures",
    author: "AMG Early Years Team",
    category: "PP / Pre-Primary",
    description: "A picture-led reader that builds first vocabulary for pre-primary learners."
  },
  {
    id: "demo-002", demo: true, code: "ENG", hue: 145,
    title: "Mwangaza Readers, Book 1",
    author: "Grace Wairimu",
    category: "Primary",
    description: "Short graded stories with comprehension questions for lower primary readers."
  },
  {
    id: "demo-003", demo: true, code: "KIS", hue: 200,
    title: "Kiswahili Made Simple",
    author: "Joseph Mutiso",
    category: "Junior Secondary",
    description: "Grammar, insha practice and vocabulary drills for junior secondary learners."
  },
  {
    id: "demo-004", demo: true, code: "MAT", hue: 262,
    title: "Numbers That Matter",
    author: "Peter Otieno",
    category: "Senior Secondary",
    description: "Worked examples and past-paper questions covering the senior mathematics syllabus."
  },
  {
    id: "demo-005", demo: true, code: "CHM", hue: 168,
    title: "Chemistry Practicals Made Easy",
    author: "Sarah Kilonzo",
    category: "Senior Secondary",
    description: "Step-by-step laboratory guides with safety notes for practical chemistry."
  },
  {
    id: "demo-006", demo: true, code: "FIC", hue: 332,
    title: "The Silent Harvest",
    author: "Lydia Achieng",
    category: "General / Fiction",
    description: "A village novel about family, drought and the quiet courage of a young teacher."
  },
  {
    id: "demo-007", demo: true, code: "HIS", hue: 18,
    title: "A History of East Africa",
    author: "Martin Njoroge",
    category: "High School",
    description: "Regional history from early trade routes to independence, with source exercises."
  },
  {
    id: "demo-008", demo: true, code: "CSC", hue: 218,
    title: "Introduction to Computer Science",
    author: "Samuel Karanja",
    category: "University",
    description: "Foundations of programming, data structures and computational thinking."
  }
];
