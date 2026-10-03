"""
Shared table renderer used by every module.
One layout description (a "template") -> the same table as PNG bytes and as a PDF page.
"""
import io
import os
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ------------------------------------------------------------------ fonts
_DIRS = [r"C:\Windows\Fonts",
         os.path.join(os.environ.get("LOCALAPPDATA", ""), r"Microsoft\Windows\Fonts"),
         "/usr/share/fonts/truetype/crosextra", "/usr/share/fonts/truetype/liberation"]


def _find(names):
    for d in _DIRS:
        for n in names:
            p = os.path.join(d, n)
            if os.path.exists(p):
                return p
    return None


_REG = _find(["calibri.ttf", "Carlito-Regular.ttf", "arial.ttf", "LiberationSans-Regular.ttf"])
_BLD = _find(["calibrib.ttf", "Carlito-Bold.ttf", "arialbd.ttf", "LiberationSans-Bold.ttf"])
if _REG and _BLD:
    pdfmetrics.registerFont(TTFont("LM", _REG))
    pdfmetrics.registerFont(TTFont("LM-B", _BLD))
    FONT, FONT_B = "LM", "LM-B"
else:
    FONT, FONT_B = "Helvetica", "Helvetica-Bold"


def _pil_font(bold, size):
    path = _BLD if bold else _REG
    try:
        return ImageFont.truetype(path, size) if path else ImageFont.load_default(size)
    except Exception:
        return ImageFont.load_default()


# ------------------------------------------------------------------ templates
DEFAULT_TEMPLATE = {
    "id": "classic-grid",
    "name": "Classic Grid (matches the original image)",
    "module": "any",
    "title": "LOGGED IN DATE {date}",
    "date_format": "MM/DD/YYYY",
    "font_size": 11.5,
    "row_height": 21,
    "cell_pad": 8,
    "min_col": 80,
    "max_chars": 45,
    "null_text": "-",
    "align_first": "left",
    "align_rest": "center",
    "title_fill": "#FFFFFF", "title_text": "#000000",
    "header_fill": "#FFFFFF", "header_text": "#000000",
    "body_text": "#000000", "body_fill": "#FFFFFF",
    "zebra": False, "zebra_fill": "#F5EFE0",
    "border_color": "#000000", "border_width": 0.8,
    "status_colors": False,
    "builtin": True,
}

STATUS_FILL = {"P": "#DCEBDF", "V": "#DFE4E9", "L": "#F6E8C8", "HD": "#F6E8C8", "H": "#E4E1DA", "Ab": "#F3C9CF"}

BUILTIN_TEMPLATES = [
    DEFAULT_TEMPLATE,
    {**DEFAULT_TEMPLATE,
     "id": "lakmee-maroon", "name": "Lakmee Maroon Broadcast",
     "title_fill": "#800020", "title_text": "#FFFFFF",
     "header_fill": "#2E2E30", "header_text": "#F5EFE0",
     "body_fill": "#FFFFFF", "zebra": True, "zebra_fill": "#F5EFE0",
     "border_color": "#0D0D0D", "border_width": 0.7, "row_height": 24, "font_size": 12},
    {**DEFAULT_TEMPLATE,
     "id": "emp-sheet", "name": "Staff Sheet (exact copy of the Excel layout)", "module": "employee",
     "title": "", "title_fill": "#800020", "title_text": "#FFFFFF",
     "border_color": "#000000", "border_width": 0.5, "row_height": 20, "font_size": 11},
    {**DEFAULT_TEMPLATE,
     "id": "emp-summary", "name": "Staff Summary (title + clean grid)", "module": "employee",
     "title": "STAFF ATTENDANCE {month}", "title_fill": "#800020", "title_text": "#FFFFFF",
     "header_fill": "#2E2E30", "header_text": "#F5EFE0", "zebra": True, "zebra_fill": "#F5EFE0",
     "border_color": "#0D0D0D", "border_width": 0.7, "row_height": 22, "font_size": 11.5},
    {**DEFAULT_TEMPLATE,
     "id": "emp-grid", "name": "Staff Monthly Grid (coloured status cells)", "module": "employee",
     "title": "STAFF ATTENDANCE {month}", "title_fill": "#800020", "title_text": "#FFFFFF",
     "header_fill": "#2E2E30", "header_text": "#F5EFE0", "status_colors": True,
     "border_color": "#0D0D0D", "border_width": 0.6, "row_height": 19, "font_size": 9.5,
     "cell_pad": 4, "min_col": 24, "max_chars": 30},
]


def _rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _clip(s, n):
    return s if len(s) <= n else s[:n - 1] + "…"


# ------------------------------------------------------------------ layout
def layout(tpl, title, headers, rows):
    """Returns (items, W, H) in points. item = dict(x,y,w,h,text,align,bold,fill,color)."""
    fs, rh, cp = tpl["font_size"], tpl["row_height"], tpl["cell_pad"]
    pad = 1.5
    nul, mx = tpl["null_text"], tpl["max_chars"]
    rows = [[_clip(v, mx) if v else nul for v in r] for r in rows]
    sw = pdfmetrics.stringWidth
    widths = [max(tpl["min_col"], max([sw(h, FONT_B, fs)] + [sw(r[i], FONT, fs) for r in rows]) + 2 * cp)
              for i, h in enumerate(headers)]
    need = sw(title, FONT_B, fs) + 2 * cp
    if sum(widths) < need:
        widths[-1] += need - sum(widths)
    total = sum(widths)
    items = [dict(x=pad, y=pad, w=total, h=rh, text=title, align="c", bold=True,
                  fill=tpl["title_fill"], color=tpl["title_text"])]

    def add_row(vals, y, header=False, zebra=False):
        x = pad
        for i, v in enumerate(vals):
            al = tpl["align_first"] if i == 0 else tpl["align_rest"]
            fill = tpl["header_fill"] if header else (tpl["zebra_fill"] if zebra else tpl["body_fill"])
            if not header and tpl.get("status_colors") and v in STATUS_FILL:
                fill = STATUS_FILL[v]
            items.append(dict(x=x, y=y, w=widths[i], h=rh, text=v, align={"left": "l"}.get(al, "c"),
                              bold=header,
                              fill=fill,
                              color=tpl["header_text"] if header else tpl["body_text"]))
            x += widths[i]

    y = pad + rh
    add_row(headers, y, header=True)
    for n, r in enumerate(rows):
        y += rh
        add_row(r, y, zebra=tpl["zebra"] and n % 2 == 1)
    return items, total + 2 * pad, rh * (len(rows) + 2) + 2 * pad


# ------------------------------------------------------------------ item drawing (shared)
def spec_with_title(spec, title, tpl):
    """Adds an optional title band above an exact-copy layout."""
    if not title:
        return spec
    rh = tpl["row_height"]
    items = [dict(it, y=it["y"] + rh) for it in spec["items"]]
    items.insert(0, dict(x=1.5, y=1.5, w=spec["width"] - 3, h=rh, text=title, align="c", bold=True,
                         fill=tpl["title_fill"], color=tpl["title_text"], size=tpl["font_size"] + 1))
    return {**spec, "items": items, "height": spec["height"] + rh}


def _draw_png(items, W, H, tpl, dpi):
    k = dpi / 72.0
    im = Image.new("RGB", (int(W * k), int(H * k)), "white")
    d = ImageDraw.Draw(im)
    fonts = {}

    def font(bold, size):
        key = (bold, round(size * k))
        if key not in fonts:
            fonts[key] = _pil_font(bold, max(6, int(size * k)))
        return fonts[key]

    lw = max(1, int(tpl["border_width"] * k))
    for it in items:
        x, y, w, h = it["x"], it["y"], it["w"], it["h"]
        d.rectangle([x * k, y * k, (x + w) * k, (y + h) * k], fill=_rgb(it["fill"] or tpl["body_fill"]),
                    outline=_rgb(tpl["border_color"]), width=lw)
        text = it["text"]
        if not text:
            continue
        f = font(it["bold"], it.get("size") or tpl["font_size"])
        col = _rgb(it["color"])
        if "\n" in text:
            d.multiline_text(((x + w / 2) * k, (y + h / 2) * k), text, font=f, fill=col, anchor="mm", align="center")
        elif it["align"] == "l":
            d.text(((x + 4) * k, (y + h / 2) * k), text, font=f, fill=col, anchor="lm")
        else:
            d.text(((x + w / 2) * k, (y + h / 2) * k), text, font=f, fill=col, anchor="mm")
    buf = io.BytesIO()
    im.save(buf, format="PNG", dpi=(dpi, dpi))
    return buf.getvalue()


def _draw_pdf(c, items, W, H, tpl):
    c.setPageSize((W, H))
    c.setLineWidth(tpl["border_width"])
    bc = [v / 255 for v in _rgb(tpl["border_color"])]
    for it in items:
        x, y, w, h = it["x"], it["y"], it["w"], it["h"]
        yb = H - y - h
        c.setFillColorRGB(*[v / 255 for v in _rgb(it["fill"] or tpl["body_fill"])])
        c.setStrokeColorRGB(*bc)
        c.rect(x, yb, w, h, fill=1, stroke=1)
        text = it["text"]
        if not text:
            continue
        size = it.get("size") or tpl["font_size"]
        c.setFillColorRGB(*[v / 255 for v in _rgb(it["color"])])
        c.setFont(FONT_B if it["bold"] else FONT, size)
        lines = text.split("\n")
        lead = size * 1.1
        top = yb + h / 2 + (len(lines) - 1) * lead / 2 - size * 0.3
        for n, line in enumerate(lines):
            base = top - n * lead
            if it["align"] == "l" and len(lines) == 1:
                c.drawString(x + 4, base, line)
            else:
                c.drawCentredString(x + w / 2, base, line)
    c.showPage()


def render_png_spec(tpl, spec, dpi=300):
    return _draw_png(spec["items"], spec["width"], spec["height"], tpl, dpi)


def draw_pdf_spec(c, tpl, spec):
    _draw_pdf(c, spec["items"], spec["width"], spec["height"], tpl)


# ------------------------------------------------------------------ PNG
def render_png(tpl, title, headers, rows, dpi=300):
    items, W, H = layout(tpl, title, headers, rows)
    k = dpi / 72.0
    im = Image.new("RGB", (int(W * k), int(H * k)), "white")
    d = ImageDraw.Draw(im)
    fb, fr = _pil_font(True, int(tpl["font_size"] * k)), _pil_font(False, int(tpl["font_size"] * k))
    lw = max(1, int(tpl["border_width"] * k))
    for it in items:
        x, y, w, h = it["x"], it["y"], it["w"], it["h"]
        d.rectangle([x * k, y * k, (x + w) * k, (y + h) * k], fill=_rgb(it["fill"]),
                    outline=_rgb(tpl["border_color"]), width=lw)
        f = fb if it["bold"] else fr
        if it["align"] == "l":
            d.text(((x + 4) * k, (y + h / 2) * k), it["text"], font=f, fill=_rgb(it["color"]), anchor="lm")
        else:
            d.text(((x + w / 2) * k, (y + h / 2) * k), it["text"], font=f, fill=_rgb(it["color"]), anchor="mm")
    buf = io.BytesIO()
    im.save(buf, format="PNG", dpi=(dpi, dpi))
    return buf.getvalue()


# ------------------------------------------------------------------ PDF
def draw_pdf_page(c, tpl, title, headers, rows):
    items, W, H = layout(tpl, title, headers, rows)
    c.setPageSize((W, H))
    c.setLineWidth(tpl["border_width"])
    bc = [v / 255 for v in _rgb(tpl["border_color"])]
    for it in items:
        x, y, w, h = it["x"], it["y"], it["w"], it["h"]
        yb = H - y - h
        c.setFillColorRGB(*[v / 255 for v in _rgb(it["fill"])])
        c.setStrokeColorRGB(*bc)
        c.rect(x, yb, w, h, fill=1, stroke=1)
        c.setFillColorRGB(*[v / 255 for v in _rgb(it["color"])])
        c.setFont(FONT_B if it["bold"] else FONT, tpl["font_size"])
        base = yb + (h - tpl["font_size"]) / 2 + tpl["font_size"] * 0.22
        if it["align"] == "l":
            c.drawString(x + 4, base, it["text"])
        else:
            c.drawCentredString(x + w / 2, base, it["text"])
    c.showPage()
