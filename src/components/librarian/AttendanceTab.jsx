import { useCallback, useEffect, useRef, useState } from "react";
import { useLibrary } from "../../store/LibraryProvider";
import { useToast } from "../../store/ToastProvider";
import { errorMessage, formatDate } from "../../lib/format";

const DEFAULT_INSTRUCTION = "Select an action, then scan the relevant membership card or book-copy label.";
const SCAN_MODES = [
  { value: "check-in", label: "Member check-in" },
  { value: "check-out", label: "Member check-out" },
  { value: "issue-book", label: "Issue book (scan member, then copy)" },
  { value: "return-book", label: "Return book (scan copy)" }
];

export function AttendanceTab({ active }) {
  const { attendance, capacity, scanMemberCode, processUnifiedCode, updateCapacity, resetScanMember } = useLibrary();
  const { showToast } = useToast();

  const [mode, setMode] = useState("check-in");
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [hint, setHint] = useState("");
  const [capacityInput, setCapacityInput] = useState(String(capacity));

  const videoRef = useRef(null);
  const codeRef = useRef(null);
  const modeRef = useRef(mode);
  const memberRef = useRef(scanMemberCode);
  const busyRef = useRef(false);
  const lastScanRef = useRef("");
  const lastScanAtRef = useRef(0);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { memberRef.current = scanMemberCode; }, [scanMemberCode]);
  useEffect(() => { setCapacityInput(String(capacity)); }, [capacity]);

  // A scanned code is only processed once, even if the detector reports the
  // same value on several consecutive frames.
  const scanHandler = useCallback(async (rawCode) => {
    const value = String(rawCode || "").trim();
    if (!value || busyRef.current) return;
    const now = Date.now();
    const currentMode = modeRef.current;
    if (currentMode === "issue-book" && memberRef.current && value === memberRef.current) return;
    if (value === lastScanRef.current && now - lastScanAtRef.current < 1600) return;
    lastScanRef.current = value;
    lastScanAtRef.current = now;
    busyRef.current = true;
    const hadMember = Boolean(memberRef.current);
    try {
      await processUnifiedCode(value, currentMode);
    } finally {
      busyRef.current = false;
    }
    if (currentMode !== "issue-book" || hadMember) setScanning(false);
  }, [processUnifiedCode]);

  const handlerRef = useRef(scanHandler);
  useEffect(() => { handlerRef.current = scanHandler; }, [scanHandler]);

  useEffect(() => {
    if (!scanning) return undefined;
    let disposed = false;
    let stream = null;
    let frame = 0;
    let controls = null;

    const run = async () => {
      const video = videoRef.current;
      if (!video) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        showToast("Camera access is unavailable. Use a USB barcode scanner connected to the code field.", "error");
        setScanning(false);
        return;
      }
      try {
        if ("BarcodeDetector" in window) {
          try {
            const formats = ["code_128", "qr_code", "ean_13", "ean_8", "upc_a", "upc_e"];
            const supported = await window.BarcodeDetector.getSupportedFormats?.();
            const usable = supported ? formats.filter(format => supported.includes(format)) : formats;
            if (usable.length) {
              const detector = new window.BarcodeDetector({ formats: usable });
              stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
              if (disposed) {
                stream.getTracks().forEach(track => track.stop());
                return;
              }
              video.srcObject = stream;
              await video.play();
              const loop = async () => {
                if (disposed) return;
                try {
                  if (!busyRef.current) {
                    const codes = await detector.detect(video);
                    if (codes.length && codes[0].rawValue) await handlerRef.current(codes[0].rawValue);
                  }
                } catch (_) { /* skip this frame */ }
                if (!disposed) frame = window.requestAnimationFrame(loop);
              };
              setHint("Camera ready. Scan a membership card or book-copy label.");
              loop();
              return;
            }
          } catch (_) {
            if (stream) stream.getTracks().forEach(track => track.stop());
            stream = null;
            video.srcObject = null;
          }
        }

        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (disposed) return;
        const reader = new BrowserMultiFormatReader();
        setHint("Loading the compatible barcode and QR camera reader…");
        controls = await reader.decodeFromVideoDevice(undefined, video, result => {
          if (result) void handlerRef.current(result.getText());
        });
        setHint("Camera ready. Scan a membership card or book-copy label.");
      } catch (error) {
        showToast(
          "Could not start camera scanning: " + errorMessage(error) + ". Check camera permission and use HTTPS, or connect a USB scanner.",
          "error"
        );
        setScanning(false);
      }
    };

    void run();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      try { controls?.stop(); } catch (_) { /* reader already stopped */ }
      if (stream) stream.getTracks().forEach(track => track.stop());
      const video = videoRef.current;
      if (video) video.srcObject = null;
      setHint("");
      resetScanMember();
    };
  }, [scanning, showToast, resetScanMember]);

  const submitCode = async (event) => {
    event.preventDefault();
    const value = code.trim();
    if (!value) return;
    await processUnifiedCode(value, mode);
    setCode("");
    codeRef.current?.focus();
  };

  const submitCapacity = async (event) => {
    event.preventDefault();
    const next = Number(capacityInput);
    if (!Number.isInteger(next) || next < 1 || next > 10000) {
      showToast("Capacity must be between 1 and 10,000.", "error");
      return;
    }
    await updateCapacity(next);
  };

  const inside = attendance.filter(item => item.status === "In library").length;
  const instruction = hint || (scanMemberCode
    ? "Member scanned. Now scan the individual book-copy barcode."
    : DEFAULT_INSTRUCTION);

  return (
    <div id="attendanceTab" className={"tab-content" + (active ? " active" : "")}>
      <h3>Smart barcode &amp; QR scanner</h3>
      <p className="muted">
        Use a USB barcode scanner connected to a computer, or scan with the rear camera on a phone or tablet.
        Both methods use the same attendance and circulation records.
      </p>

      <div className="scanner-method-hints">
        <span><b>USB scanner</b><small>Click the code field and scan. Configure the scanner to send Enter after each scan.</small></span>
        <span><b>Phone camera</b><small>Allow camera access and hold the barcode or QR code inside the frame.</small></span>
      </div>

      <form id="attendanceForm" className="inline-form" onSubmit={submitCode}>
        <label>
          Scanner mode
          <select name="action" value={mode} onChange={event => setMode(event.target.value)}>
            {SCAN_MODES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label>
          Scan / enter barcode
          <input
            id="attendanceCodeInput"
            ref={codeRef}
            name="libraryNumber"
            type="text"
            required
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Click here, then scan CODE-128 or QR code"
            value={code}
            onChange={event => setCode(event.target.value)}
          />
        </label>
        <button className="btn btn-primary" type="submit">Process scan</button>
      </form>

      <p id="scannerInstruction" className="muted">{instruction}</p>

      <button
        id="startScannerBtn"
        className="btn btn-outline top-gap"
        type="button"
        onClick={() => setScanning(true)}
        disabled={scanning}
      >
        Open phone camera scanner
      </button>

      <div id="scannerBox" className={"scanner-box" + (scanning ? "" : " hidden")}>
        <video id="scannerVideo" ref={videoRef} playsInline muted></video>
        <p className="scanner-camera-help">Position the code inside the camera view. The scanner will process it automatically.</p>
        <button id="stopScannerBtn" className="btn btn-secondary" type="button" onClick={() => setScanning(false)}>
          Stop scanner
        </button>
      </div>

      <p id="currentCapacity" className="notice notice-info">
        Library occupancy: {inside} / {capacity} · Remaining capacity: {Math.max(0, capacity - inside)}
      </p>

      <form id="capacityForm" className="inline-form" onSubmit={submitCapacity}>
        <label>
          Maximum capacity
          <input
            name="capacity"
            type="number"
            min="1"
            max="10000"
            required
            value={capacityInput}
            onChange={event => setCapacityInput(event.target.value)}
          />
        </label>
        <button className="btn btn-outline" type="submit">Update capacity</button>
      </form>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr><th>Member</th><th>Library #</th><th>Check-in</th><th>Check-out</th><th>Status</th></tr>
          </thead>
          <tbody id="attendanceTable">
            {attendance.map(item => (
              <tr key={item.id}>
                <td>{item.memberName}</td>
                <td>{item.libraryNumber}</td>
                <td>{formatDate(item.checkInAt)}</td>
                <td>{formatDate(item.checkOutAt)}</td>
                <td>{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
