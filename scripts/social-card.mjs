import sharp from "sharp";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#171918"/><rect x="65" y="68" width="1070" height="494" fill="none" stroke="#47503d"/><circle cx="1060" cy="136" r="27" fill="#c1f45b"/><text x="110" y="170" font-family="Arial" font-size="25" letter-spacing="5" fill="#c1f45b">REMERAS OFICIALES</text><text x="100" y="348" font-family="Arial" font-size="164" font-weight="900" letter-spacing="-8" fill="#f7f7f2">UPR 2026</text><text x="110" y="427" font-family="Arial" font-size="39" fill="#c1f45b">EL EVENTO TAMBIÉN SE LLEVA.</text><text x="110" y="508" font-family="Arial" font-size="23" fill="#bcc5b4">Retiro en el evento. No realizamos envíos.</text></svg>`;
await sharp(Buffer.from(svg))
  .png()
  .toFile(
    new URL("../public/og.png", import.meta.url).pathname.replace(
      /^\/([A-Za-z]:)/,
      "$1",
    ),
  );
