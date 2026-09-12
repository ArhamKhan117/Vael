"""Turn the supplied logo into the brand files the site ships.

    tools/.venv/bin/python tools/make_brand.py            write every file
    tools/.venv/bin/python tools/make_brand.py --check    report what would change, write nothing

The source is `apps/web/public/brand/vael-logo-source.png`, a 620 x 214 wordmark on a transparent
background as it was handed over: chunky white letters with a dark outline and a blue underside.
It is a small raster, and a raster that small placed in a footer at 2x is soft, so this makes a
master from it and everything else from the master.

The master, `vael-logo.png`, 2048 px wide. Made in this order, and the order matters:

1. Crop to the visible artwork plus a small margin, so the file's own padding is not the layout's.
2. Bleed the artwork's colour outward into the transparent surround before scaling. The source's
   transparent pixels carry the RGB of whatever background it was cut from, and a resampler mixes
   that colour into every edge pixel: that mix is the halo. With the edge colour continued
   outward there is nothing foreign to mix.
3. Resample colour and alpha separately with Lanczos.
4. Re-harden the alpha. Scaling a 1 px antialiased edge by 4 makes a 4 px soft edge; a smoothstep
   centred on half coverage brings it back to about 1.5 px, which is what "crisp" is at this size.
   Faint fringe pixels fall to zero in the same pass.
5. A light unsharp mask on the colour, inside the letters only.

Exports: a WebP at three times the footer's 92 x 28 slot, and the icon set: 16, 32, 48, a 180
apple-touch icon, 192 and 512 for the web manifest, and a 1024 tile, each the wordmark on a black
rounded-square tile with a one-pixel lighter border so it reads on any tab bar. Below 64 px the
outline and the shading average to grey, so the small tiles carry the wordmark's flat white
silhouette, taken from the same master's alpha, filling nine tenths of the tile. favicon.ico
bundles 16, 32 and 48.

Everything is rendered at four times its size and reduced with Lanczos, because Pillow has no
antialiased primitives and a rounded corner drawn at 16 px is a staircase.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "apps/web/public/brand"
ICONS = ROOT / "apps/web/public/icons"
SOURCE = BRAND / "vael-logo-source.png"
MASTER = BRAND / "vael-logo.png"

MASTER_WIDTH = 2048
# The footer slot is 92 x 28 CSS px; three times that, and next/image serves the 1x and 2x.
FOOTER_SCALE = 3
FOOTER_HEIGHT = 28

TILE = "#000000"
TILE_BORDER = "#2A2A2F"
ICON_SIZES = [16, 32, 48, 180, 192, 512, 1024]
SMALL_ICON_MAX = 64  # below this, the flat white silhouette rather than the shaded wordmark


def bleed(rgba: np.ndarray, passes: int = 24) -> np.ndarray:
    """Continue the artwork's colour outward under the transparent pixels, pass by pass."""
    rgb = rgba[..., :3].astype(np.float32)
    alpha = rgba[..., 3].astype(np.float32)
    known = alpha > 8
    for _ in range(passes):
        if known.all():
            break
        padded = np.pad(rgb, ((1, 1), (1, 1), (0, 0)), mode="edge")
        kpad = np.pad(known, ((1, 1), (1, 1)), mode="edge")
        total = np.zeros_like(rgb)
        count = np.zeros(known.shape, dtype=np.float32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0:
                    continue
                shifted = padded[1 + dy : 1 + dy + rgb.shape[0], 1 + dx : 1 + dx + rgb.shape[1]]
                mask = kpad[1 + dy : 1 + dy + rgb.shape[0], 1 + dx : 1 + dx + rgb.shape[1]]
                total += shifted * mask[..., None]
                count += mask
        fill = ~known & (count > 0)
        rgb[fill] = total[fill] / count[fill][:, None]
        known = known | fill
    out = rgba.copy()
    out[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    return out


def smoothstep(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    t = np.clip((x - lo) / (hi - lo), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def make_master() -> Image.Image:
    source = Image.open(SOURCE).convert("RGBA")
    box = source.getchannel("A").getbbox()
    if not box:
        raise SystemExit("the source has no visible artwork")
    margin = round((box[3] - box[1]) * 0.05)
    cropped = source.crop((
        max(0, box[0] - margin),
        max(0, box[1] - margin),
        min(source.width, box[2] + margin),
        min(source.height, box[3] + margin),
    ))

    bled = Image.fromarray(bleed(np.array(cropped)), "RGBA")
    scale = MASTER_WIDTH / bled.width
    size = (MASTER_WIDTH, round(bled.height * scale))
    rgb = bled.convert("RGB").resize(size, Image.LANCZOS)
    alpha = bled.getchannel("A").resize(size, Image.LANCZOS)

    a = np.array(alpha).astype(np.float32) / 255.0
    hardened = smoothstep(a, 0.32, 0.68)
    alpha_out = Image.fromarray((hardened * 255).round().astype(np.uint8))
    rgb_out = rgb.filter(ImageFilter.UnsharpMask(radius=2.5, percent=60, threshold=2))

    master = Image.merge("RGBA", (*rgb_out.split(), alpha_out))
    return master


def fit(image: Image.Image, width: int | None = None, height: int | None = None) -> Image.Image:
    if width is None and height is None:
        raise ValueError("width or height")
    ratio = image.width / image.height
    if width is None:
        width = round(height * ratio)
    if height is None:
        height = round(width / ratio)
    return image.resize((width, height), Image.LANCZOS)


def silhouette(master: Image.Image) -> Image.Image:
    """The wordmark's shape in flat white. At 16 and 32 px the dark outline and the shading
    average to grey; the silhouette alone stays white on the black tile and still reads."""
    alpha = master.getchannel("A")
    white = Image.new("RGBA", master.size, (255, 255, 255, 0))
    white.putalpha(alpha)
    return white


def tile(size: int, art: Image.Image, fill_fraction: float) -> Image.Image:
    """A rounded black square with a one pixel lighter border and the artwork centred on it."""
    s = 4
    canvas = Image.new("RGBA", (size * s, size * s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    radius = round(size * s * 0.22)
    draw.rounded_rectangle((0, 0, size * s - 1, size * s - 1), radius=radius, fill=TILE)
    art_box = art.getchannel("A").getbbox()
    art = art.crop(art_box)
    # Fit inside the fraction of the tile, whichever side binds.
    max_w = size * s * fill_fraction
    max_h = size * s * fill_fraction * 0.72
    ratio = min(max_w / art.width, max_h / art.height)
    placed = art.resize((max(1, round(art.width * ratio)), max(1, round(art.height * ratio))), Image.LANCZOS)
    canvas.paste(placed, ((size * s - placed.width) // 2, (size * s - placed.height) // 2), placed)
    reduced = canvas.resize((size, size), Image.LANCZOS)
    # The border is drawn after the reduce so it is exactly one device pixel at every size.
    ImageDraw.Draw(reduced).rounded_rectangle(
        (0, 0, size - 1, size - 1), radius=round(size * 0.22), outline=TILE_BORDER, width=1
    )
    return reduced


def outputs(master: Image.Image) -> dict[Path, Image.Image]:
    files: dict[Path, Image.Image] = {MASTER: master}
    files[BRAND / f"vael-logo-{FOOTER_HEIGHT * FOOTER_SCALE}h.webp"] = fit(master, height=FOOTER_HEIGHT * FOOTER_SCALE)
    flat = silhouette(master)
    for size in ICON_SIZES:
        art = flat if size < SMALL_ICON_MAX else master
        files[ICONS / f"icon-{size}.png"] = tile(size, art, 0.9 if size < SMALL_ICON_MAX else 0.82)
    files[ICONS / "apple-touch-icon.png"] = files[ICONS / "icon-180.png"]
    return files


def same_bytes(path: Path, image: Image.Image, **save) -> bool:
    if not path.is_file():
        return False
    from io import BytesIO

    buffer = BytesIO()
    image.save(buffer, format=path.suffix.lstrip(".").upper().replace("JPG", "JPEG"), **save)
    return buffer.getvalue() == path.read_bytes()


def main() -> int:
    check = "--check" in sys.argv
    if not SOURCE.is_file():
        print(f"ERROR: {SOURCE} is missing")
        return 2
    master = make_master()
    files = outputs(master)
    ICONS.mkdir(parents=True, exist_ok=True)

    changed = 0
    for path, image in files.items():
        save: dict = {}
        if path.suffix == ".webp":
            save = {"quality": 92, "method": 6}
        elif path.suffix == ".png":
            save = {"optimize": True}
        if same_bytes(path, image, **save):
            continue
        changed += 1
        print(f"{'would write' if check else 'wrote'}  {path.relative_to(ROOT)}  {image.width}x{image.height}")
        if not check:
            image.save(path, **save)

    ico = ICONS / "favicon.ico"
    # Largest first: Pillow drops any requested size larger than the base image, so an ICO saved
    # from the 16 px tile silently held one frame.
    ico_frames = [files[ICONS / f"icon-{s}.png"] for s in (48, 32, 16)]
    if not check:
        ico_frames[0].save(ico, format="ICO", sizes=[(s, s) for s in (48, 32, 16)], append_images=ico_frames[1:])
        print(f"wrote  {ico.relative_to(ROOT)}  48, 32, 16")

    art = master.getchannel("A").getbbox()
    print(f"master {master.width}x{master.height}, artwork {art[2] - art[0]}x{art[3] - art[1]}, {changed} file(s) {'would change' if check else 'written'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
