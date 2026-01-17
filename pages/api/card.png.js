import sharp from "sharp";

export default async function handler(req, res) {
  try {
    const username = (req.query.user || "draj48").toString();

    // yahi tera existing SVG endpoint call karega
    const baseUrl = `https://${req.headers.host}`;
    const svgUrl = `${baseUrl}/api/card?user=${encodeURIComponent(username)}`;

    const svgRes = await fetch(svgUrl);
    const svgText = await svgRes.text();

    // svg -> png
    const pngBuffer = await sharp(Buffer.from(svgText)).png().toBuffer();

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=1800");
    res.status(200).send(pngBuffer);
  } catch (e) {
    res.status(500).send("error");
  }
}
