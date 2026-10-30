const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const {randomBytes} = require("node:crypto");
initializeApp();
const db=getFirestore();
function requireLibrarian(request){if(!request.auth||request.auth.token.librarian!==true)throw new HttpsError("permission-denied","Authorized librarian access is required.");}
function clean(value,max=160){return String(value??"").trim().slice(0,max);}
function makeCopyBarcode(){return "AMG-COPY-"+randomBytes(9).toString("hex").toUpperCase();}
async function findMember(code){
 const snap=await db.collection("users").where("libraryNumber","==",clean(code,180)).limit(1).get();
 if(snap.empty)throw new HttpsError("not-found","No member matches that library number.");
 const d=snap.docs[0],data=d.data();if(data.isApproved!==true)throw new HttpsError("failed-precondition","This member is not approved.");
 return {ref:d.ref,id:d.id,data};
}
async function findCopy(code){
 const snap=await db.collection("bookCopies").where("barcode","==",clean(code,100)).limit(1).get();
 if(snap.empty)throw new HttpsError("not-found","No physical book copy matches that barcode.");
 return snap.docs[0];
}
exports.registerBookCopies=onCall(async request=>{
 requireLibrarian(request);
 const title=clean(request.data?.title),author=clean(request.data?.author,120),category=clean(request.data?.category,80),quantity=Number(request.data?.quantity);
 if(!title||!Number.isInteger(quantity)||quantity<1||quantity>400)throw new HttpsError("invalid-argument","Provide a title and between 1 and 400 physical copies.");
 const batch=db.batch(),bookRef=db.collection("books").doc(),titleCode="AMG-TITLE-"+randomBytes(6).toString("hex").toUpperCase();
 batch.create(bookRef,{title,author,category,quantity,available:quantity,barcode:titleCode,libraryNumber:titleCode,coverUrl:clean(request.data?.coverUrl,1000),description:clean(request.data?.description,500),createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),createdBy:request.auth.uid});
 const copies=[];
 for(let i=1;i<=quantity;i++){const ref=db.collection("bookCopies").doc(),barcode=makeCopyBarcode();batch.create(ref,{bookId:bookRef.id,title,barcode,copyNumber:i,status:"Available",createdAt:FieldValue.serverTimestamp()});copies.push({copyNumber:i,barcode});}
 await batch.commit();return {bookId:bookRef.id,bookBarcode:titleCode,copies,message:quantity+" individual copy barcodes created."};
});
exports.recordMemberAttendance=onCall(async request=>{
 requireLibrarian(request);const action=clean(request.data?.action,20);
 if(!["check-in","check-out"].includes(action))throw new HttpsError("invalid-argument","Choose check-in or check-out.");
 const member=await findMember(request.data?.libraryNumber),presenceRef=db.collection("memberPresence").doc(member.id),attendanceRef=db.collection("attendance").doc();
 await db.runTransaction(async tx=>{
  const presence=await tx.get(presenceRef),settings=await tx.get(db.collection("settings").doc("library"));
  if(action==="check-in"){
   if(presence.exists&&presence.data().status==="In library")throw new HttpsError("already-exists","This member is already checked in.");
   const capacity=Math.max(1,Number(settings.data()?.capacity||100));
   const active=await tx.get(db.collection("memberPresence").where("status","==","In library"));
   if(active.size>=capacity)throw new HttpsError("resource-exhausted","The library has reached its configured capacity.");
   tx.create(attendanceRef,{uid:member.id,memberName:member.data.fullName,libraryNumber:member.data.libraryNumber,checkInAt:FieldValue.serverTimestamp(),checkOutAt:null,status:"In library",recordedBy:request.auth.uid});
   tx.set(presenceRef,{uid:member.id,attendanceId:attendanceRef.id,status:"In library",updatedAt:FieldValue.serverTimestamp()});
  }else{
   if(!presence.exists||presence.data().status!=="In library")throw new HttpsError("failed-precondition","This member has no active check-in.");
   tx.update(db.collection("attendance").doc(presence.data().attendanceId),{checkOutAt:FieldValue.serverTimestamp(),status:"Checked out",checkedOutBy:request.auth.uid});
   tx.set(presenceRef,{uid:member.id,status:"Checked out",updatedAt:FieldValue.serverTimestamp()});
  }
 });
 return {message:member.data.fullName+(action==="check-in"?" checked in.":" checked out.")};
});
exports.issueBookCopy=onCall(async request=>{
 requireLibrarian(request);const member=await findMember(request.data?.libraryNumber),copy=await findCopy(request.data?.copyBarcode),loanRef=db.collection("loans").doc();
 await db.runTransaction(async tx=>{
  const [copySnap,bookSnap]=await Promise.all([tx.get(copy.ref),tx.get(db.collection("books").doc(copy.data().bookId))]);
  if(!copySnap.exists||copySnap.data().status!=="Available")throw new HttpsError("failed-precondition","This physical copy is already on loan.");
  if(!bookSnap.exists||Number(bookSnap.data().available||0)<1)throw new HttpsError("failed-precondition","No available stock remains for this title.");
  const due=new Date();due.setDate(due.getDate()+14);
  tx.update(copy.ref,{status:"Borrowed",borrowedBy:member.id,borrowedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
  tx.update(bookSnap.ref,{available:Number(bookSnap.data().available)-1,updatedAt:FieldValue.serverTimestamp()});
  tx.create(loanRef,{userId:member.id,userName:member.data.fullName,bookId:bookSnap.id,bookTitle:bookSnap.data().title,bookCopyId:copy.id,copyBarcode:copy.data().barcode,status:"Borrowed",borrowedAt:FieldValue.serverTimestamp(),dueAt:due.toISOString(),createdAt:FieldValue.serverTimestamp(),issuedBy:request.auth.uid});
 });
 return {message:member.data.fullName+" — "+copy.data().title+" issued."};
});
exports.returnBookCopy=onCall(async request=>{
 requireLibrarian(request);const copy=await findCopy(request.data?.copyBarcode);
 const matches=await db.collection("loans").where("bookCopyId","==",copy.id).get();
 const loanDoc=matches.docs.find(d=>d.data().status==="Borrowed");
 if(!loanDoc)throw new HttpsError("failed-precondition","This copy has no active loan.");
 await db.runTransaction(async tx=>{
  const [copySnap,loanSnap,bookSnap]=await Promise.all([tx.get(copy.ref),tx.get(loanDoc.ref),tx.get(db.collection("books").doc(copy.data().bookId))]);
  if(!copySnap.exists||copySnap.data().status!=="Borrowed"||!loanSnap.exists||loanSnap.data().status!=="Borrowed")throw new HttpsError("failed-precondition","This copy was already returned or its loan changed.");
  if(!bookSnap.exists)throw new HttpsError("not-found","The title record is missing.");
  tx.update(copy.ref,{status:"Available",returnedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
  tx.update(bookSnap.ref,{available:Number(bookSnap.data().available||0)+1,updatedAt:FieldValue.serverTimestamp()});
  tx.update(loanDoc.ref,{status:"Returned",returnedAt:FieldValue.serverTimestamp(),returnedBy:request.auth.uid});
 });
 return {message:copy.data().title+" returned successfully."};
});
