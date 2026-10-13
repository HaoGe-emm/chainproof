import assert from "node:assert/strict";
import test from "node:test";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { certificateUrl } from "../lib/certificate.ts";

test("locally generated QR code decodes to the full certificate URL", () => {
  const hash = `0x${"a".repeat(64)}`;
  for (const origin of ["http://localhost:3000", "https://chainproof-git-feature-chainproof-v2-example.vercel.app", "https://chainproof-two.vercel.app", "https://chainproof.example.com"]) {
    const link = certificateUrl(origin, hash);
    const qr = QRCode.create(link, { errorCorrectionLevel: "M" });
    const scale = 5;
    const margin = 4;
    const width = (qr.modules.size + margin * 2) * scale;
    const image = new Uint8ClampedArray(width * width * 4);
    image.fill(255);
    for (let y = 0; y < width; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const row = Math.floor(y / scale) - margin;
        const col = Math.floor(x / scale) - margin;
        const dark = row >= 0 && col >= 0 && row < qr.modules.size && col < qr.modules.size && qr.modules.get(row, col);
        if (dark) {
          const offset = (y * width + x) * 4;
          image[offset] = image[offset + 1] = image[offset + 2] = 0;
        }
      }
    }
    const decoded = jsQR(image, width, width);
    assert.ok(decoded, "QR must be scannable");
    assert.equal(decoded.data, link);
  }
});
