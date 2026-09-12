"""The README's pictures, drawn from the game's own parts.

    tools/.venv/bin/python -m tools.make_readme_art            write every image
    tools/.venv/bin/python -m tools.make_readme_art --check    report what would change, write nothing

Five committed PNGs under apps/web/public/readme/: a hero lockup in a dark and a light version,
and three figures: how one quest works, the game layer, and the two completion paths. GitHub
renders the README from the repository, so the images are committed rather than built; they live
under the web app's public folder rather than assets/ because the site renders the same README at
/readme, from disk, and has to be able to serve them. The README refers to them by repository path
and the site's markdown renderer rewrites that prefix to its own root.

The README uses plain markdown images with GitHub's #gh-dark-mode-only and #gh-light-mode-only
fragments rather than a <picture> element: the site's renderer does not pass raw HTML through, and
a fragment on an image URL is something every renderer can ignore.

What is kept from the README diagram system: Pillow only, so a colour here is the product's colour
and not a diagramming tool's; everything rendered at twice its size and reduced with Lanczos; every
box sized from the measured width of its own text, so nothing overlaps; a contrast audit that runs
first and refuses to write if a label would fall under WCAG AA; transparent outside a rounded card,
so the file has no corners of its own on either GitHub theme.

What is deliberately not kept: the white page, the grey card, the one accent, the mark in the top
left, the sober type. These pictures are of a game, and they are drawn like one. The palette is the
site's: black, the electric blue of its chips, the gold of its partner badges, the brown of the
dungeon floor, sampled from the very tile the hero stands on. The characters are the game's own
sprites, the Kenney warrior the hero page draws and the season-three raid boss assembled from the
same monster parts RaidScene assembles it from, drawn nearest-neighbour so the pixels stay pixels.
The proof that travels from Ethereum to Creditcoin is a scroll with a face, because a picture of a
Merkle proof is a picture of nothing. The wordmark, "Vael" in the navbar's own Matemasie, sits in
the bottom right of every image. Nothing sits in the top left.

Every number a figure states was read from the chain or the index when the README was written and
is repeated in the README's own tables; a figure must never be the only place a number lives.
"""
from __future__ import annotations

import colorsys
import math
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/web/public/readme"
FONTS = {
    "word": ROOT / "tools/fonts/Matemasie-Regular.ttf",
    "bold": ROOT / "tools/fonts/SpaceMono-Bold.ttf",
    "regular": ROOT / "tools/fonts/SpaceMono-Regular.ttf",
}
TILES = ROOT / "apps/web/public/game/kenney-tiny-dungeon/tilemap_packed.png"
MONSTERS = ROOT / "apps/web/public/game/kenney-monster-builder/spritesheet_default.png"
MONSTER_ATLAS = ROOT / "apps/web/public/game/kenney-monster-builder/spritesheet_default.xml"
ITEM_ART = ROOT / "apps/web/public/items/warhammer.webp"

SCALE = 2
WIDTH = 960
HERO_FRAME = 96  # the warrior, as HeroScene draws a hero with strength as its dominant stat
FLOOR_FRAME = 49  # sandy floor with grit, the tile under every hero


def px(value: float) -> int:
    return int(round(value * SCALE))


# ---------------------------------------------------------------- colour

def parse_hex(colour: str) -> tuple[int, int, int]:
    text = colour.strip().lstrip("#")
    return tuple(int(text[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def hex_of(rgb: tuple[int, int, int]) -> str:
    return "#%02X%02X%02X" % rgb


def relative_luminance(colour: str) -> float:
    def channel(value: int) -> float:
        c = value / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (channel(v) for v in parse_hex(colour))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(foreground: str, background: str) -> float:
    a, b = relative_luminance(foreground), relative_luminance(background)
    lighter, darker = max(a, b), min(a, b)
    return (lighter + 0.05) / (darker + 0.05)


def readable(accent: str, *surfaces: str) -> str:
    """Nearest colour to `accent` that clears AA on every surface given, searching both ways."""
    hue, saturation, value = colorsys.rgb_to_hsv(*[c / 255 for c in parse_hex(accent)])

    def at(v: float) -> str:
        return hex_of(tuple(round(c * 255) for c in colorsys.hsv_to_rgb(hue, saturation, v)))  # type: ignore[arg-type]

    def passes(colour: str) -> bool:
        return all(contrast_ratio(colour, surface) >= 4.5 for surface in surfaces)

    if passes(accent):
        return accent
    for step in range(1, 46):
        for direction in (-1, 1):
            v = value + direction * step * 0.02
            if 0.0 <= v <= 1.0 and passes(at(v)):
                return at(v)
    return accent


def blend(top: str, bottom: str, alpha: float) -> str:
    t, b = parse_hex(top), parse_hex(bottom)
    return hex_of(tuple(round(t[i] * alpha + b[i] * (1 - alpha)) for i in range(3)))  # type: ignore[arg-type]


def floor_colour() -> str:
    """The dungeon floor, sampled from the tile the hero stands on rather than typed in."""
    sheet = Image.open(TILES).convert("RGBA")
    x, y = (FLOOR_FRAME % 12) * 16, (FLOOR_FRAME // 12) * 16
    tile = sheet.crop((x, y, x + 16, y + 16))
    counts: dict[tuple[int, int, int], int] = {}
    for r, g, b, a in tile.getdata():
        if a:
            counts[(r, g, b)] = counts.get((r, g, b), 0) + 1
    return hex_of(max(counts, key=counts.get))  # type: ignore[arg-type]


@dataclass(frozen=True)
class Palette:
    name: str
    page: str  # the card the whole picture sits on
    well: str  # a sunken panel on the card
    border: str
    text: str
    muted: str
    blue: str  # electric blue, the site's chip and link colour (Tailwind sky-400 in the app)
    blue_text: str
    gold: str  # the site's partner badge gold (Tailwind amber-400 in the app)
    gold_text: str
    floor: str
    ethereum: str  # a cooler, quieter blue-grey for the other chain


FLOOR = floor_colour()
DARK = Palette(
    name="dark",
    page="#0B0B0F",
    well="#141419",
    border="#26262B",
    text="#FFFFFF",
    muted="#A1A1AA",
    blue="#38BDF8",
    blue_text=readable("#38BDF8", "#0B0B0F", "#141419"),
    gold="#FBBF24",
    gold_text=readable("#FBBF24", "#0B0B0F", "#141419"),
    floor=FLOOR,
    ethereum="#5B6B8A",
)
LIGHT = Palette(
    name="light",
    page="#FAFAFB",
    well="#EEEEF2",
    border="#D6D6DD",
    text="#131316",
    muted="#43434E",
    blue="#38BDF8",
    blue_text=readable("#38BDF8", "#FAFAFB", "#EEEEF2"),
    gold="#FBBF24",
    gold_text=readable("#FBBF24", "#FAFAFB", "#EEEEF2"),
    floor=FLOOR,
    ethereum="#5B6B8A",
)


def audit(palette: Palette) -> list[str]:
    problems = []
    for surface_name, surface in (("card", palette.page), ("well", palette.well)):
        for role in ("text", "muted", "blue_text", "gold_text"):
            colour = getattr(palette, role)
            ratio = contrast_ratio(colour, surface)
            mark = "ok  " if ratio >= 4.5 else "FAIL"
            line = f"  {mark}  {palette.name:5} {role:10} {colour} on the {surface_name} {surface}  {ratio:5.2f}:1"
            print(line)
            if ratio < 4.5:
                problems.append(line.strip())
    return problems


# ---------------------------------------------------------------- type

def font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS[kind]), size * SCALE)


def line_height(f: ImageFont.FreeTypeFont) -> int:
    ascent, descent = f.getmetrics()
    return int((ascent + descent) * 1.3)


def wrap(text: str, f: ImageFont.FreeTypeFont, max_width: int, draw: ImageDraw.ImageDraw) -> list[str]:
    """Wrap on measured widths. A character count is how a last word gets clipped."""
    if not text:
        return []
    lines, words = [], text.split()
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if draw.textlength(candidate, font=f) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def text_block(draw, x, y, lines, f, fill, align="left", width=None) -> int:
    """Draw wrapped lines; return the y below them."""
    lh = line_height(f)
    for line in lines:
        w = draw.textlength(line, font=f)
        dx = 0
        if align == "center" and width:
            dx = (width - w) / 2
        elif align == "right" and width:
            dx = width - w
        draw.text((x + dx, y), line, font=f, fill=fill)
        y += lh
    return y


# ---------------------------------------------------------------- sprites and characters

def hero_sprite(height: int) -> Image.Image:
    """The warrior from the tile sheet, scaled nearest-neighbour so its pixels stay square."""
    sheet = Image.open(TILES).convert("RGBA")
    x, y = (HERO_FRAME % 12) * 16, (HERO_FRAME // 12) * 16
    tile = sheet.crop((x, y, x + 16, y + 16))
    box = tile.getchannel("A").getbbox()
    tile = tile.crop(box)
    factor = height / tile.height
    return tile.resize((round(tile.width * factor), height), Image.NEAREST)


def floor_strip(width: int, height: int) -> Image.Image:
    sheet = Image.open(TILES).convert("RGBA")
    x, y = (FLOOR_FRAME % 12) * 16, (FLOOR_FRAME // 12) * 16
    tile = sheet.crop((x, y, x + 16, y + 16)).resize((height, height), Image.NEAREST)
    strip = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    for sx in range(0, width, height):
        strip.paste(tile, (sx, 0))
    return strip


def pick(items, season_id: int, salt: int):
    """RaidScene's own hash, so the boss drawn here is the boss the raid page drew for season 3."""
    h = ((season_id + 1) * 2654435761 + salt * 40503) & 0xFFFFFFFF
    h ^= h >> 13
    return items[h % len(items)]


COLOURS = ["red", "green", "blue", "yellow", "dark", "white"]
BODY_LETTERS = ["A", "B", "C", "D", "E", "F"]
ARM_LETTERS = ["A", "B", "C", "D", "E"]
MOUTHS = ["mouthA", "mouthB", "mouthC", "mouthF", "mouthG", "mouth_closed_fangs"]
EYES = ["eye_angry_red", "eye_angry_green", "eye_psycho_light", "eye_red", "eye_yellow"]
CROWNS = ["horn_large", "horn_small", "ear", "ear_round", "antenna_large"]


def boss_sprite(season_id: int, height: int) -> Image.Image:
    """The raid boss, assembled from the monster atlas exactly as RaidScene assembles it."""
    atlas = {
        node.get("name"): tuple(int(node.get(k)) for k in ("x", "y", "width", "height"))
        for node in ET.parse(MONSTER_ATLAS).getroot()
    }
    sheet = Image.open(MONSTERS).convert("RGBA")

    def part(name: str) -> Image.Image:
        x, y, w, h = atlas[name]
        return sheet.crop((x, y, x + w, y + h))

    colour = pick(COLOURS, season_id, 1)
    body = part(f"body_{colour}{pick(BODY_LETTERS, season_id, 2)}.png")
    arm = part(f"arm_{colour}{pick(ARM_LETTERS, season_id, 3)}.png")
    crown = part(f"detail_{colour}_{pick(CROWNS, season_id, 4)}.png")
    eye = part(f"{pick(EYES, season_id, 5)}.png")
    mouth = part(f"{pick(MOUTHS, season_id, 6)}.png")

    bw, bh = body.size
    canvas = Image.new("RGBA", (bw * 2, bh * 2), (0, 0, 0, 0))
    cx, cy = bw, bh

    def place(img: Image.Image, dx: float, dy: float, flip=False):
        if flip:
            img = img.transpose(Image.FLIP_LEFT_RIGHT)
        canvas.alpha_composite(img, (round(cx + dx - img.width / 2), round(cy + dy - img.height / 2)))

    place(crown, -bw * 0.22, -bh * 0.46)
    place(crown, bw * 0.22, -bh * 0.46, flip=True)
    place(arm, -bw * 0.42, bh * 0.05)
    place(arm, bw * 0.42, bh * 0.05, flip=True)
    place(body, 0, 0)
    place(eye, -bw * 0.16, -bh * 0.12)
    place(eye, bw * 0.16, -bh * 0.12, flip=True)
    place(mouth, 0, bh * 0.1)
    canvas = canvas.crop(canvas.getchannel("A").getbbox())
    factor = height / canvas.height
    return canvas.resize((round(canvas.width * factor), height), Image.LANCZOS)


def proof_scroll(palette: Palette, height: int, tilt: float = -8) -> Image.Image:
    """The proof, as a character: a rolled scroll with a face and a blue seal."""
    s = 4  # drawn large and reduced, for smooth curves
    h = height * s
    w = round(h * 0.78)
    img = Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ox, oy = w // 2, h // 2
    paper = "#F5E6C4"
    edge = "#C9A86A"
    # body
    d.rounded_rectangle((ox, oy + h * 0.12, ox + w, oy + h * 0.88), radius=h * 0.12, fill=paper, outline=edge, width=s * 2)
    # rolled ends
    for y in (oy + h * 0.04, oy + h * 0.80):
        d.rounded_rectangle((ox - w * 0.06, y, ox + w * 1.06, y + h * 0.16), radius=h * 0.08, fill="#EAD5A6", outline=edge, width=s * 2)
    # face
    ex = ox + w * 0.32
    ey = oy + h * 0.42
    for fx in (ex, ox + w * 0.68):
        d.ellipse((fx - s * 5, ey - s * 5, fx + s * 5, ey + s * 5), fill="#1F1F24")
        d.ellipse((fx - s * 2, ey - s * 4, fx + s * 1, ey - s * 1), fill="#FFFFFF")
    d.arc((ox + w * 0.34, oy + h * 0.46, ox + w * 0.66, oy + h * 0.66), start=10, end=170, fill="#1F1F24", width=s * 2)
    # seal
    sx, sy = ox + w * 0.5, oy + h * 0.74
    d.ellipse((sx - s * 8, sy - s * 8, sx + s * 8, sy + s * 8), fill=palette.blue, outline="#0369A1", width=s)
    d.text((sx - s * 3, sy - s * 5), "✓", font=ImageFont.truetype(str(FONTS["bold"]), s * 9), fill="#0B0B0F")
    img = img.rotate(tilt, resample=Image.BICUBIC, expand=True)
    img = img.crop(img.getchannel("A").getbbox())
    return img.resize((round(img.width / s), round(img.height / s)), Image.LANCZOS)


def coin(palette: Palette, size: int) -> Image.Image:
    s = 4
    img = Image.new("RGBA", (size * s, size * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((0, 0, size * s - 1, size * s - 1), fill=palette.gold, outline="#B45309", width=s * 2)
    d.ellipse((size * s * 0.2, size * s * 0.2, size * s * 0.8, size * s * 0.8), outline="#B45309", width=s)
    f = ImageFont.truetype(str(FONTS["bold"]), int(size * s * 0.42))
    t = "V"
    box = d.textbbox((0, 0), t, font=f)
    d.text(((size * s - (box[2] - box[0])) / 2 - box[0], (size * s - (box[3] - box[1])) / 2 - box[1]), t, font=f, fill="#7C2D12")
    return img.resize((size, size), Image.LANCZOS)


def sparkle(draw: ImageDraw.ImageDraw, x: float, y: float, r: float, fill: str):
    pts = []
    for i in range(8):
        angle = math.pi / 4 * i
        radius = r if i % 2 == 0 else r * 0.38
        pts.append((x + math.cos(angle) * radius, y + math.sin(angle) * radius))
    draw.polygon(pts, fill=fill)


def dotted_path(draw: ImageDraw.ImageDraw, points: list[tuple[float, float]], fill: str, radius: float, gap: float):
    """Dots along a polyline, evenly spaced by arc length."""
    total = 0.0
    segments = []
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        length = math.hypot(x2 - x1, y2 - y1)
        segments.append(((x1, y1), (x2, y2), length))
        total += length
    t = 0.0
    while t <= total:
        remaining = t
        for (x1, y1), (x2, y2), length in segments:
            if remaining <= length:
                u = remaining / length if length else 0
                x, y = x1 + (x2 - x1) * u, y1 + (y2 - y1) * u
                draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)
                break
            remaining -= length
        t += gap


def bezier(p0, p1, p2, p3, steps=48) -> list[tuple[float, float]]:
    pts = []
    for i in range(steps + 1):
        t = i / steps
        x = (1 - t) ** 3 * p0[0] + 3 * (1 - t) ** 2 * t * p1[0] + 3 * (1 - t) * t**2 * p2[0] + t**3 * p3[0]
        y = (1 - t) ** 3 * p0[1] + 3 * (1 - t) ** 2 * t * p1[1] + 3 * (1 - t) * t**2 * p2[1] + t**3 * p3[1]
        pts.append((x, y))
    return pts


def glow(image: Image.Image, box: tuple[int, int, int, int], colour: str, radius: int, alpha: int):
    """A soft halo behind something, composited rather than drawn, so it never punches the card."""
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse(box, fill=(*parse_hex(colour), alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(radius))
    image.alpha_composite(layer)


# ---------------------------------------------------------------- the card and the wordmark

def new_card(palette: Palette, height: int) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    """A rounded card of the palette's page colour, transparent outside, with a 1px border."""
    w, h = px(WIDTH), px(height)
    image = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    inset = px(2)
    card = (inset, inset, w - inset - 1, h - inset - 1)
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle(card, radius=px(28), fill=255)
    fill = Image.new("RGBA", (w, h), (*parse_hex(palette.page), 255))
    image.paste(fill, (0, 0), mask)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(card, radius=px(28), outline=palette.border, width=SCALE)
    return image, draw


def wordmark(draw: ImageDraw.ImageDraw, palette: Palette, image_size: tuple[int, int]):
    """"Vael", bottom right, in the navbar's own face. Never top left."""
    f = font("word", 22)
    box = draw.textbbox((0, 0), "Vael", font=f)
    x = image_size[0] - px(26) - (box[2] - box[0])
    y = image_size[1] - px(20) - (box[3] - box[1])
    draw.text((x - box[0], y - box[1]), "Vael", font=f, fill=palette.text)


def finish(image: Image.Image) -> Image.Image:
    w, h = image.size
    if h % SCALE:
        image = image.crop((0, 0, w, h - h % SCALE))
    return image.resize((image.width // SCALE, image.height // SCALE), Image.LANCZOS)


def sticker(draw, box, palette, fill, outline, radius=16, width=2):
    draw.rounded_rectangle(box, radius=px(radius), fill=fill, outline=outline, width=px(width))


# ---------------------------------------------------------------- the hero lockup

def hero(palette: Palette) -> Image.Image:
    height = 300
    image, draw = new_card(palette, height)
    w, h = image.size

    # Floor along the bottom, inside the card's rounded corners.
    strip = floor_strip(w - px(40), px(28))
    mask = Image.new("L", strip.size, 255)
    image.alpha_composite(strip, (px(20), h - px(28) - px(14)))
    # The floor's own shadow line, so it reads as ground rather than a stripe.
    draw.line([(px(20), h - px(42)), (w - px(20), h - px(42))], fill=blend("#000000", FLOOR, 0.45), width=px(2))

    # The hero, left, standing on the floor; the boss, right, looming.
    sprite = hero_sprite(px(108))
    glow(image, (px(56), px(126), px(56) + sprite.width + px(40), px(126) + sprite.height + px(40)), palette.blue, px(18), 90)
    image.alpha_composite(sprite, (px(76), h - px(42) - sprite.height))
    boss = boss_sprite(3, px(132))
    glow(image, (w - px(90) - boss.width, px(80), w - px(50), px(80) + boss.height + px(30)), palette.gold, px(22), 70)
    image.alpha_composite(boss, (w - px(70) - boss.width, h - px(42) - boss.height))

    # Sparkles, a few, gold.
    for (sx, sy, r) in ((0.12, 0.28, 7), (0.19, 0.18, 4), (0.84, 0.22, 6), (0.9, 0.36, 3), (0.76, 0.16, 4)):
        sparkle(draw, w * sx, h * sy, px(r), palette.gold)

    # Wordmark and tagline, centred between the two characters.
    f_word = font("word", 72)
    f_tag = font("bold", 15)
    left, right = px(230), w - px(235)
    span = right - left
    word = "Vael"
    box = draw.textbbox((0, 0), word, font=f_word)
    wx = left + (span - (box[2] - box[0])) / 2 - box[0]
    draw.text((wx + px(3), px(44) + px(3) - box[1]), word, font=f_word, fill=palette.blue)
    draw.text((wx, px(44) - box[1]), word, font=f_word, fill=palette.text)
    y = px(44) + (box[3] - box[1]) + px(16)
    y = text_block(draw, left, y, wrap("Do real DeFi on Ethereum. Prove it on Creditcoin. Earn what no key can hand out.", f_tag, span, draw), f_tag, palette.text, "center", span)

    # The proof scroll, hopping from an Ethereum blob to a Creditcoin blob under the tagline. The
    # row is placed from the tagline's measured bottom, so a longer line cannot run into the arc.
    ey = cy = y + px(50)
    ex, cx = left + px(70), right - px(70)
    draw.ellipse((ex - px(16), ey - px(16), ex + px(16), ey + px(16)), fill=palette.ethereum, outline=palette.border, width=SCALE)
    draw.ellipse((cx - px(16), cy - px(16), cx + px(16), cy + px(16)), fill=palette.blue, outline=palette.border, width=SCALE)
    # Labels beside the blobs, not under them: under them is the floor.
    f_lab = font("bold", 8)
    lw = draw.textlength("Ethereum", font=f_lab)
    draw.text((ex - px(22) - lw, ey - line_height(f_lab) / 2), "Ethereum", font=f_lab, fill=palette.muted)
    draw.text((cx + px(22), cy - line_height(f_lab) / 2), "Creditcoin", font=f_lab, fill=palette.muted)
    arc = bezier((ex + px(18), ey), (ex + span * 0.3, ey - px(40)), (cx - span * 0.3, ey - px(40)), (cx - px(18), cy))
    dotted_path(draw, arc, palette.blue_text if palette.name == "light" else palette.blue, px(1.6), px(9))
    scroll = proof_scroll(palette, px(34))
    mid = arc[len(arc) // 2]
    image.alpha_composite(scroll, (round(mid[0] - scroll.width / 2), round(mid[1] - scroll.height / 2 - px(4))))

    wordmark(draw, palette, (w, h))
    return finish(image)


# ---------------------------------------------------------------- how one quest works

@dataclass
class Station:
    number: str
    chain: str  # "eth" | "ctc" | "both"
    title: str
    lines: list[str]


def quest_flow(palette: Palette) -> Image.Image:
    stations = [
        Station("1", "ctc", "Accept", ["acceptQuest on QuestManager records the attested Sepolia height. The action has to come after it."]),
        Station("2", "eth", "Do the thing", ["A Uniswap swap, an Aave supply, a portal check-in: on Ethereum Sepolia, with the player's own wallet."]),
        Station("3", "both", "Attest", ["Creditcoin's validators attest the Ethereum block that holds the log. No proof exists before this."]),
        Station("4", "both", "Prove", ["A Merkle proof of the receipt and a continuity proof of the block, built from public data by anyone."]),
        Station("5", "ctc", "Verify and pay", ["QuestASC calls the Block Prover precompile at 0x…0FD2, checks the rule, then reward, badge, XP, raid damage."]),
    ]
    f_title = font("bold", 20)
    f_sub = font("regular", 10)
    f_num = font("word", 20)
    f_st = font("bold", 11)
    f_body = font("regular", 8.5)
    f_lab = font("bold", 8)

    pad = px(30)
    gutter = px(16)
    col_w = (px(WIDTH) - pad * 2 - gutter * (len(stations) - 1)) // len(stations)
    inner = col_w - px(24)

    probe = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    body_lh = line_height(f_body)
    # Measured: the tallest station sets the row height, so no card clips its last line.
    heights = []
    for s in stations:
        n = sum(len(wrap(line, f_body, inner, probe)) for line in s.lines)
        heights.append(px(14) + line_height(f_st) + px(6) + n * body_lh + px(14))
    card_h = max(heights)

    head_h = pad + line_height(f_title) + line_height(f_sub) + px(10)
    path_h = px(92)
    foot_lh = line_height(f_sub)
    foot_lines = 2
    height_px = head_h + path_h + card_h + px(22) + foot_lines * foot_lh + px(56)
    image, draw = new_card(palette, height_px / SCALE)
    w, h = image.size

    draw.text((pad, pad - px(2)), "How one quest works", font=f_title, fill=palette.text)
    draw.text((pad, pad + line_height(f_title)), "Left to right. The only thing anybody trusts is the precompile's answer.", font=f_sub, fill=palette.muted)

    # Two chains as blobs behind the path: Ethereum over the middle, Creditcoin at both ends.
    py = head_h + path_h // 2
    xs = [pad + i * (col_w + gutter) + col_w // 2 for i in range(len(stations))]
    for i, s in enumerate(stations):
        colour = {"eth": palette.ethereum, "ctc": palette.blue, "both": blend(palette.blue, palette.ethereum, 0.5)}[s.chain]
        draw.ellipse((xs[i] - px(13), py - px(13), xs[i] + px(13), py + px(13)), fill=colour, outline=palette.border, width=SCALE)
    lane = [(xs[0], py)] + [(x, py) for x in xs[1:]]
    for (x1, y1), (x2, y2) in zip(lane, lane[1:]):
        dotted_path(draw, bezier((x1 + px(15), y1), (x1 + (x2 - x1) * 0.4, y1 - px(30)), (x2 - (x2 - x1) * 0.4, y2 - px(30)), (x2 - px(15), y2)), palette.blue_text if palette.name == "light" else palette.blue, px(1.5), px(8))
    for x0, label in ((xs[0], "Creditcoin"), (xs[1], "Ethereum"), (xs[2], "attestation"), (xs[3], "proof builder"), (xs[4], "Creditcoin")):
        lw = draw.textlength(label, font=f_lab)
        draw.text((x0 - lw / 2, py + px(17)), label, font=f_lab, fill=palette.muted)
    scroll = proof_scroll(palette, px(40), tilt=-12)
    hop = bezier((xs[2] + px(15), py), (xs[2] + (xs[3] - xs[2]) * 0.4, py - px(30)), (xs[3] - (xs[3] - xs[2]) * 0.4, py - px(30)), (xs[3] - px(15), py))
    mid = hop[len(hop) // 2]
    image.alpha_composite(scroll, (round(mid[0] - scroll.width / 2), round(mid[1] - scroll.height / 2 - px(20))))
    sparkle(draw, xs[4] + px(22), py - px(24), px(6), palette.gold)
    sparkle(draw, xs[4] - px(26), py - px(30), px(4), palette.gold)

    # The stations.
    top = head_h + path_h
    for i, s in enumerate(stations):
        x = pad + i * (col_w + gutter)
        emphasis = s.number == "5"
        sticker(draw, (x, top, x + col_w, top + card_h), palette, palette.well, palette.gold if emphasis else palette.border, radius=18, width=2 if emphasis else 1)
        # number badge
        bx, by = x + px(12), top + px(10)
        draw.ellipse((bx, by, bx + px(26), by + px(26)), fill=palette.blue)
        nb = draw.textbbox((0, 0), s.number, font=f_num)
        draw.text((bx + px(13) - (nb[2] - nb[0]) / 2 - nb[0], by + px(13) - (nb[3] - nb[1]) / 2 - nb[1]), s.number, font=f_num, fill="#0B0B0F")
        ty = top + px(14)
        draw.text((x + px(46), ty + px(3)), s.title, font=f_st, fill=palette.gold_text if emphasis else palette.text)
        y = ty + line_height(f_st) + px(6)
        for line in s.lines:
            y = text_block(draw, x + px(12), y, wrap(line, f_body, inner, draw), f_body, palette.muted)

    fy = top + card_h + px(22)
    foot = ("Remove the worker and a player submits the same proof from the browser. Remove the precompile and nothing can complete a quest: "
            "there is no address that can be told a swap happened.")
    text_block(draw, pad, fy, wrap(foot, f_sub, w - pad * 2 - px(90), draw)[:foot_lines], f_sub, palette.text)

    wordmark(draw, palette, (w, h))
    return finish(image)


# ---------------------------------------------------------------- the game layer

def game_layer(palette: Palette) -> Image.Image:
    f_title = font("bold", 20)
    f_sub = font("regular", 10)
    f_tile = font("bold", 11)
    f_body = font("regular", 8.5)
    f_hub = font("bold", 10)

    pad = px(30)
    tiles = [
        ("Hero", "soul-bound, one per wallet", "XP by action type, 50 to 150. Streaks measured in source blocks. Affinity from the dominant stat.", "hero"),
        ("Raid boss", "one season at a time", "Damage is the proof's tier. Loot by share of damage, and the last hit is recorded.", "boss"),
        ("Arena", "duels on earned stats", "Stake VAEL, seed committed at acceptance. A pure function of both heroes; the round log is on chain.", "arena"),
        ("Loot and market", "ERC-1155, earned only", "No owner mint. An item is escrowed the moment it lists. 13 listed, 4 sold.", "item"),
        ("Badges and VAEL", "per completion", "A badge from QuestManager. VAEL from the vault, or from a partner pool through the escrow.", "coin"),
    ]
    w = px(WIDTH)
    tile_w = (w - pad * 2 - px(14) * (len(tiles) - 1)) // len(tiles)
    inner = tile_w - px(20)
    probe = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    body_lh = line_height(f_body)
    most = max(len(wrap(body, f_body, inner, probe)) for _, _, body, _ in tiles)
    tile_h = px(56) + px(12) + line_height(f_tile) + line_height(f_body) + px(4) + most * body_lh + px(14)
    top = px(226)
    height = (top + tile_h + px(16) + px(18) + px(58)) / SCALE
    image, draw = new_card(palette, height)
    w, h = image.size
    draw.text((pad, pad - px(2)), "The game layer", font=f_title, fill=palette.text)
    draw.text((pad, pad + line_height(f_title)), "Every module reads the same completion. None of them can be paid, damaged or minted any other way.", font=f_sub, fill=palette.muted)

    # The hub: one verified completion, centre.
    hx, hy = w // 2, px(150)
    glow(image, (hx - px(70), hy - px(50), hx + px(70), hy + px(50)), palette.blue, px(20), 110)
    draw.rounded_rectangle((hx - px(96), hy - px(30), hx + px(96), hy + px(30)), radius=px(30), fill=palette.blue, outline=palette.border, width=SCALE)
    label = "one verified completion"
    lw = draw.textlength(label, font=f_hub)
    draw.text((hx - lw / 2, hy - line_height(f_hub) / 2 + px(1)), label, font=f_hub, fill="#0B0B0F")
    sparkle(draw, hx + px(104), hy - px(34), px(6), palette.gold)
    sparkle(draw, hx - px(110), hy + px(26), px(4), palette.gold)

    for i, (title, sub, body, art) in enumerate(tiles):
        x = pad + i * (tile_w + px(14))
        cx = x + tile_w // 2
        # spoke from the hub, dotted, gold
        dotted_path(draw, bezier((hx, hy + px(30)), (hx, hy + px(60)), (cx, top - px(40)), (cx, top - px(2))), palette.gold, px(1.4), px(8))
        sticker(draw, (x, top, x + tile_w, top + tile_h), palette, palette.well, palette.border, radius=18, width=1)
        # the picture
        ay = top + px(10)
        if art == "hero":
            sp = hero_sprite(px(48))
            image.alpha_composite(sp, (cx - sp.width // 2, ay))
        elif art == "boss":
            sp = boss_sprite(3, px(52))
            image.alpha_composite(sp, (cx - sp.width // 2, ay - px(2)))
        elif art == "arena":
            a = hero_sprite(px(40))
            b = a.transpose(Image.FLIP_LEFT_RIGHT)
            image.alpha_composite(a, (cx - a.width - px(6), ay + px(6)))
            image.alpha_composite(b, (cx + px(6), ay + px(6)))
            draw.text((cx - px(5), ay + px(12)), "vs", font=f_body, fill=palette.gold_text)
        elif art == "item":
            item = Image.open(ITEM_ART).convert("RGBA").resize((px(50), px(50)), Image.LANCZOS)
            mask = Image.new("L", item.size, 0)
            ImageDraw.Draw(mask).rounded_rectangle((0, 0, px(50) - 1, px(50) - 1), radius=px(10), fill=255)
            image.paste(item, (cx - px(25), ay), mask)
        elif art == "coin":
            c = coin(palette, px(44))
            image.alpha_composite(c, (cx - px(22), ay + px(2)))
        ty = top + px(56) + px(12)
        tw = draw.textlength(title, font=f_tile)
        draw.text((cx - tw / 2, ty), title, font=f_tile, fill=palette.text)
        ty += line_height(f_tile)
        sw = draw.textlength(sub, font=f_body)
        draw.text((cx - sw / 2, ty), sub, font=f_body, fill=palette.blue_text)
        ty += line_height(f_body) + px(4)
        text_block(draw, x + px(10), ty, wrap(body, f_body, inner, probe), f_body, palette.muted, "center", inner)

    # Floor under the tiles.
    strip = floor_strip(w - px(40), px(18))
    image.alpha_composite(strip, (px(20), top + tile_h + px(16)))

    wordmark(draw, palette, (w, h))
    return finish(image)


# ---------------------------------------------------------------- the two completion paths

def two_paths(palette: Palette) -> Image.Image:
    f_title = font("bold", 20)
    f_sub = font("regular", 10)
    f_lane = font("bold", 12)
    f_step = font("bold", 9)
    f_body = font("regular", 8.5)

    pad = px(30)
    lane_top = pad + line_height(f_title) + line_height(f_sub) + px(14)
    lane_h = px(96)
    height = (lane_top + 2 * lane_h + px(14) + px(10) + 2 * line_height(f_sub) + px(58)) / SCALE
    image, draw = new_card(palette, height)
    w, h = image.size
    draw.text((pad, pad - px(2)), "Two completion paths, no third", font=f_title, fill=palette.text)
    draw.text((pad, pad + line_height(f_title)), "A quest is filed to one of them at creation, by its action type. Neither can stand in for the other.", font=f_sub, fill=palette.muted)

    lanes = [
        ("Proved", "QuestASC", palette.blue, [
            ("Ethereum", "the player acts with their own wallet"),
            ("Attestcoin", "validators attest the block; a proof is built"),
            ("QuestASC", "verifies at the precompile, checks the rule"),
            ("paid", "vault or partner pool, same transaction"),
        ]),
        ("Native", "NativePortal", palette.gold, [
            ("Creditcoin", "the player calls NativePortal with their tokens"),
            ("the action", "PenguinSwap swap or CTC wrap, performed by the contract"),
            ("recorded", "completion in the same transaction, or nothing"),
            ("paid", "vault, or a partner pool through CampaignPayoutHook"),
        ]),
    ]
    step_w = (w - pad * 2 - px(120) - px(12) * 3) // 4
    for li, (name, contract, colour, steps) in enumerate(lanes):
        y = lane_top + li * (lane_h + px(14))
        sticker(draw, (pad, y, w - pad, y + lane_h), palette, palette.well, colour, radius=20, width=2)
        draw.text((pad + px(14), y + px(14)), name, font=f_lane, fill=colour if palette.name == "dark" else (palette.blue_text if li == 0 else palette.gold_text))
        draw.text((pad + px(14), y + px(14) + line_height(f_lane)), contract, font=f_body, fill=palette.muted)
        sx = pad + px(120)
        for si, (label, note) in enumerate(steps):
            x = sx + si * (step_w + px(12))
            draw.rounded_rectangle((x, y + px(12), x + step_w, y + lane_h - px(12)), radius=px(12), fill=palette.page, outline=palette.border, width=SCALE)
            draw.text((x + px(10), y + px(18)), label, font=f_step, fill=colour if palette.name == "dark" else (palette.blue_text if li == 0 else palette.gold_text))
            text_block(draw, x + px(10), y + px(18) + line_height(f_step), wrap(note, f_body, step_w - px(20), draw)[:3], f_body, palette.muted)
            if si < len(steps) - 1:
                ax = x + step_w + px(6)
                draw.polygon([(ax - px(3), y + lane_h // 2 - px(4)), (ax + px(3), y + lane_h // 2), (ax - px(3), y + lane_h // 2 + px(4))], fill=palette.muted)
        if li == 0:
            scroll = proof_scroll(palette, px(30), tilt=10)
            image.alpha_composite(scroll, (sx + step_w + px(4) - scroll.width // 2, y - px(14)))

    fy = lane_top + 2 * lane_h + px(14) + px(10)
    text_block(draw, pad, fy, wrap("Both release exactly the quest's own reward. There is no owner release, no owner mint, and no address that can be told a quest was done.", f_sub, w - pad * 2 - px(90), draw)[:2], f_sub, palette.text)
    wordmark(draw, palette, (w, h))
    return finish(image)


# ---------------------------------------------------------------- main

def main() -> int:
    check = "--check" in sys.argv
    for kind, path in FONTS.items():
        if not path.is_file():
            print(f"ERROR: the {kind} font is missing at {path}")
            return 2
    for path in (TILES, MONSTERS, MONSTER_ATLAS, ITEM_ART):
        if not path.is_file():
            print(f"ERROR: {path} is missing")
            return 2

    print("contrast audit")
    problems = audit(DARK) + audit(LIGHT)
    if problems:
        print(f"{len(problems)} label(s) under AA; nothing written")
        return 1

    images = {
        "hero-dark.png": hero(DARK),
        "hero-light.png": hero(LIGHT),
        "quest-flow.png": quest_flow(DARK),
        "game-layer.png": game_layer(DARK),
        "two-paths.png": two_paths(DARK),
    }
    OUT.mkdir(parents=True, exist_ok=True)
    changed = 0
    for name, image in images.items():
        path = OUT / name
        buffer = BytesIO()
        image.save(buffer, format="PNG", optimize=True)
        data = buffer.getvalue()
        if path.is_file() and path.read_bytes() == data:
            continue
        changed += 1
        print(f"{'would write' if check else 'wrote'}  {path.relative_to(ROOT)}  {image.width}x{image.height}  {len(data) // 1024} KB")
        if not check:
            path.write_bytes(data)
    print(f"{changed} file(s) {'would change' if check else 'written'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
