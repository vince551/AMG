import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

export function Barcode({ value, className, style, height = 38, width = 1.35, displayValue = false }) {
  const svgRef = useRef(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !value) return;
    try {
      JsBarcode(svg, value, {
        format: "CODE128", displayValue, margin: 0, height, width,
        background: "#ffffff", lineColor: "#111827"
      });
    } catch (_) {
      svg.textContent = value;
    }
  }, [value, height, width, displayValue]);

  return <svg ref={svgRef} className={className} style={style} aria-label="Membership barcode" />;
}

export function QrCode({ value, size = 68, className = "qr-holder" }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!value) {
      setSrc("");
      return undefined;
    }
    let active = true;
    QRCode.toDataURL(value, { width: size, margin: 0, color: { dark: "#111827", light: "#ffffff" } })
      .then(url => { if (active) setSrc(url); })
      .catch(() => { if (active) setSrc(""); });
    return () => { active = false; };
  }, [value, size]);

  return (
    <div className={className}>
      {src ? <img src={src} width={size} height={size} alt={"QR code " + value} /> : null}
    </div>
  );
}
