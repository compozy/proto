/** Header-only image inspection for comment attachments (PNG, JPEG, GIF, WebP, at most 5 MB). */
export function inspectImage(bytes: Uint8Array) {
  if (bytes.length > 5 * 1024 * 1024) throw new Error("attachment_too_large");
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));
  let type: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  let width = 0;
  let height = 0;
  try {
    if (bytes[0] === 137 && text(1, 7) === "PNG\r\n\u001a\n" && text(12, 4) === "IHDR") {
      type = "image/png";
      width = data.getUint32(16);
      height = data.getUint32(20);
    } else if (text(0, 6) === "GIF87a" || text(0, 6) === "GIF89a") {
      type = "image/gif";
      width = data.getUint16(6, true);
      height = data.getUint16(8, true);
    } else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
      type = "image/jpeg";
      let offset = 2;
      while (offset < bytes.length) {
        if (bytes[offset++] !== 255) break;
        while (bytes[offset] === 255) offset++;
        const marker = bytes[offset++];
        if (marker === undefined || marker === 218 || marker === 217) break;
        if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
        const length = data.getUint16(offset);
        if (length < 2 || offset + length > bytes.length) break;
        if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
          if (length < 7) break;
          height = data.getUint16(offset + 3);
          width = data.getUint16(offset + 5);
          break;
        }
        offset += length;
      }
    } else if (text(0, 4) === "RIFF" && text(8, 4) === "WEBP") {
      type = "image/webp";
      const chunk = text(12, 4);
      if (chunk === "VP8X" && bytes.length >= 30) {
        width = 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
        height = 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
      } else if (chunk === "VP8L" && bytes[20] === 47) {
        const bits = data.getUint32(21, true);
        width = (bits & 0x3fff) + 1;
        height = ((bits >>> 14) & 0x3fff) + 1;
      } else if (chunk === "VP8 " && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) {
        width = data.getUint16(26, true) & 0x3fff;
        height = data.getUint16(28, true) & 0x3fff;
      }
    } else throw new Error("unsupported_media_type");
  } catch {
    throw new Error("unsupported_media_type");
  }
  if (!width || !height) throw new Error("unsupported_media_type");
  return { type, width, height, size: bytes.length };
}
