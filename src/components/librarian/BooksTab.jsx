import { useRef, useState } from "react";
import { useLibrary } from "../../store/LibraryProvider";
import { useToast } from "../../store/ToastProvider";
import { Barcode, QrCode } from "../Barcode";
import { BOOK_CATEGORIES, MAX_IMAGE_BYTES } from "../../lib/format";

const COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function BooksTab({ active }) {
  const { books, registerBook, deleteBook } = useLibrary();
  const { showToast } = useToast();
  const formRef = useRef(null);
  const galleryRef = useRef(null);
  const cameraRef = useRef(null);
  const [cover, setCover] = useState({ file: null, url: "", name: "" });
  const [labels, setLabels] = useState(null);
  const [busy, setBusy] = useState(false);

  const clearCover = () => {
    setCover(current => {
      if (current.url) URL.revokeObjectURL(current.url);
      return { file: null, url: "", name: "" };
    });
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  const pickCover = (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!COVER_TYPES.includes(file.type)) {
      input.value = "";
      showToast("Choose a JPEG, PNG or WebP image for the book cover.", "error");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      input.value = "";
      showToast("Book cover images must be 5 MB or smaller.", "error");
      return;
    }
    if (input === galleryRef.current && cameraRef.current) cameraRef.current.value = "";
    if (input === cameraRef.current && galleryRef.current) galleryRef.current.value = "";
    setCover(current => {
      if (current.url) URL.revokeObjectURL(current.url);
      return { file, url: URL.createObjectURL(file), name: file.name || "Camera photo" };
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();
    const quantity = Number(form.get("quantity"));
    setBusy(true);
    const result = await registerBook({
      title,
      author: String(form.get("author") || "").trim(),
      category: String(form.get("category") || ""),
      quantity,
      description: String(form.get("description") || "").trim(),
      coverFile: cover.file
    });
    setBusy(false);
    if (!result) return;
    formRef.current?.reset();
    clearCover();
    setLabels(result);
  };

  const remove = (book) => {
    if (!window.confirm("Delete “" + book.title + "” from the catalogue? This is only allowed if the book has no active loans.")) return;
    void deleteBook(book);
  };

  return (
    <div id="booksAdminTab" className={"tab-content" + (active ? " active" : "")}>
      <h3>Register a book</h3>
      <form id="bookForm" ref={formRef} className="form-grid" onSubmit={submit}>
        <label>Book title<input name="title" required maxLength="160" /></label>
        <label>Author<input name="author" required maxLength="120" /></label>
        <label>
          Category
          <select name="category" required defaultValue={BOOK_CATEGORIES[0]}>
            {BOOK_CATEGORIES.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label>Physical copies<input name="quantity" type="number" min="1" max="400" defaultValue="1" required /></label>

        <div className="book-cover-field full-span">
          <span className="book-cover-label">Book cover image <small>Optional · JPEG, PNG or WebP · up to 5 MB</small></span>
          <div className="book-cover-actions">
            <label className="btn btn-outline" htmlFor="bookCoverGalleryInput">Choose from device</label>
            <input
              id="bookCoverGalleryInput"
              ref={galleryRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={pickCover}
            />
            <label className="btn btn-outline" htmlFor="bookCoverCameraInput">Take cover photo</label>
            <input
              id="bookCoverCameraInput"
              ref={cameraRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              hidden
              onChange={pickCover}
            />
          </div>
          <div id="bookCoverPreviewWrap" className={"book-cover-preview" + (cover.url ? "" : " hidden")}>
            {cover.url ? <img id="bookCoverPreview" src={cover.url} alt="Selected book cover preview" /> : null}
            <div>
              <strong id="bookCoverFileName">{cover.name || "Selected cover"}</strong>
              <small>Preview before registering</small>
              <button id="removeBookCoverBtn" className="btn btn-sm btn-outline" type="button" onClick={clearCover}>
                Remove image
              </button>
            </div>
          </div>
        </div>

        <label>Short description (optional)<input name="description" maxLength="500" /></label>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          Register book &amp; generate barcode
        </button>
      </form>

      <div id="copyLabelsPanel" className={"copy-labels-panel" + (labels ? "" : " hidden")}>
        {labels ? (
          <>
            <h4>Copy labels — {labels.title}</h4>
            <p className="muted">Each label identifies one physical copy. Print and attach one label to each copy.</p>
            <button className="btn btn-outline top-gap" type="button" onClick={() => window.print()}>
              Print copy labels
            </button>
            <div className="copy-label-grid">
              {labels.copies.map(copy => (
                <article key={copy.barcode} className="copy-label">
                  <strong>Copy {copy.copyNumber}</strong>
                  <Barcode value={copy.barcode} height={42} width={1.4} />
                  <small>{copy.barcode}</small>
                  <QrCode value={copy.barcode} size={88} className="copy-label-qr" />
                </article>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <h3 className="top-gap">Current inventory</h3>
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr><th>Barcode / Library #</th><th>Book</th><th>Category</th><th>Available / Total</th><th>Actions</th></tr>
          </thead>
          <tbody id="inventoryTable">
            {books.map(book => (
              <tr key={book.id}>
                <td>
                  <strong>{book.libraryNumber || book.barcode}</strong>
                  <Barcode
                    value={book.barcode || book.libraryNumber}
                    height={30}
                    width={1}
                    style={{ width: "130px", height: "35px" }}
                  />
                </td>
                <td>{(book.title || "") + " — " + (book.author || "Unknown author")}</td>
                <td>{book.category}</td>
                <td>{Number(book.available || 0) + " / " + Number(book.quantity || 0)}</td>
                <td>
                  <button className="btn btn-sm btn-danger" type="button" onClick={() => remove(book)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
