import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ url, size = 160 }: { url: string; size?: number }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: size * 2, color: { dark: "#000000", light: "#39ff14" } }).then(setSrc);
  }, [url, size]);
  return src ? <img className="qr" src={src} width={size} height={size} alt={`QR code for ${url}`} /> : null;
}
