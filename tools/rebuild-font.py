#!/usr/bin/env python3
"""Rebuild a usable font from a specimen image.

Give it a picture of an alphabet — one row per line of characters — and it slices
the rows into glyphs, vectorises each one, and compiles a real TTF and WOFF2.

    python3 tools/rebuild-font.py specimen.png "ABCDEFGHIJKLMNOPQRSTUVWXYZ" "1234567890" \
        --name Bernoru --out build/bernoru

The awkward part is not the tracing, it is the metrics. A specimen shows the letters
but not the font's own coordinate system, so cap height, baseline and sidebearings all
have to be recovered from the ink itself: the baseline is where the flat-bottomed
glyphs sit, cap height is measured off those same glyphs rather than off O or S, which
overshoot it, and each glyph keeps the whitespace it was drawn with. Get that wrong and
every letter is individually fine while the word is unreadable.
"""
import argparse, os, sys
from PIL import Image
import numpy as np
import potrace
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.areaPen import AreaPen
from fontTools.pens.reverseContourPen import ReverseContourPen

UPEM = 1000
# Letters with a flat foot and a flat top. They define the baseline and the cap line;
# round letters like O, S and G are drawn a little taller and lower on purpose, so
# measuring off them would tilt the whole alphabet.
FLAT = set('BDEFHIJKLMNPRTUVWXYZ1234567')


def load_binary(path, threshold):
    im = Image.open(path).convert('L')
    a = np.array(im)
    return a < threshold                                   # True where there is ink


def bands(mask, axis, gap):
    """Runs of ink along one axis, merging anything separated by less than `gap`."""
    present = mask.any(axis=axis)
    runs, start = [], None
    for i, v in enumerate(present):
        if v and start is None:
            start = i
        elif not v and start is not None:
            runs.append((start, i)); start = None
    if start is not None:
        runs.append((start, len(present)))
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < gap:
            merged[-1] = (merged[-1][0], r[1])
        else:
            merged.append(list(r) if False else (r[0], r[1]))
    return [(a, b) for a, b in merged]


def slice_glyphs(mask, rows_text, gap_ratio):
    """Cut the sheet into rows, then each row into glyph boxes."""
    row_bands = bands(mask, 1, max(4, mask.shape[0] // 50))
    if len(row_bands) != len(rows_text):
        raise SystemExit('found %d rows of ink but %d row(s) of text were given — '
                         'check the image, or pass one string per visible row'
                         % (len(row_bands), len(rows_text)))
    out = []
    for (y0, y1), text in zip(row_bands, rows_text):
        band = mask[y0:y1]
        height = y1 - y0
        # a gap wider than this is between letters, anything narrower is inside one
        cols = bands(band, 0, max(2, int(height * gap_ratio)))
        if len(cols) != len(text):
            raise SystemExit('row "%s": %d characters but %d ink shapes were found. '
                             'Try --gap higher to join broken glyphs, lower to split '
                             'touching ones.' % (text, len(text), len(cols)))
        row = len(set(g['row'] for g in out))
        for (x0, x1), ch in zip(cols, text):
            sub = mask[y0:y1, x0:x1]
            ys = np.where(sub.any(axis=1))[0]
            out.append({'char': ch, 'row': row, 'x0': x0, 'x1': x1,
                        'top': y0 + ys[0], 'bottom': y0 + ys[-1] + 1,
                        'mask': mask[y0 + ys[0]: y0 + ys[-1] + 1, x0:x1]})
    return out


def metrics(glyphs):
    """A baseline PER ROW, and one cap height for the whole face.

    Each row of a specimen sits at its own height on the sheet, so a single baseline
    averaged over all of them belongs to none of them: the letters come out sitting
    correctly and the digits float half a line above the text, which is exactly what
    the first build did. Cap height is shared, because the rows are the same face.

    Both are measured off the flat-footed characters only. O, S, G and 8 are drawn a
    little past the cap line and below the baseline on purpose, and letting them vote
    tilts the whole alphabet."""
    rows = sorted(set(g['row'] for g in glyphs))
    baselines, caps = {}, []
    for r in rows:
        here = [g for g in glyphs if g['row'] == r]
        flat = [g for g in here if g['char'] in FLAT] or here
        baselines[r] = int(round(np.median([g['bottom'] for g in flat])))
        caps.append(baselines[r] - int(round(np.median([g['top'] for g in flat]))))
    cap_px = int(round(np.median(caps)))
    if cap_px < 8:
        raise SystemExit('cap height measures %d pixels — far too small to rebuild from. '
                         'Supply a larger specimen.' % cap_px)
    if max(caps) - min(caps) > cap_px * 0.12:
        print('  note: the rows differ in cap height by %d%% — if they were set at '
              'different sizes the rebuild will average them.'
              % round((max(caps) - min(caps)) / cap_px * 100))
    return baselines, cap_px


def trace(mask, upscale):
    """Vectorise one glyph. Upscaling first costs nothing and takes the stair-stepping
    off the diagonals, which is most of what makes a traced letter look cheap.

    The bitmap goes in INVERTED. potrace treats a set pixel as background, so handing
    it the ink directly traces the white space instead: you get the edge of the image
    as a contour and every letter as a hole in it, which comes out as garbage that
    still looks vaguely font-shaped."""
    im = Image.fromarray((mask * 255).astype(np.uint8))
    if upscale > 1:
        im = im.resize((im.width * upscale, im.height * upscale), Image.LANCZOS)
    ink = np.array(im) > 127
    return potrace.Bitmap(~ink).trace(turdsize=2, alphamax=1.0, opticurve=1,
                                      opttolerance=0.2)


def record(curve, sx, sy, dx, dy):
    """One potrace contour into a RecordingPen, as real cubics. Emitting the two cubic
    control points to qCurveTo instead — which is what this did first — silently means
    something else in TrueType, and bends every curve in the alphabet."""
    T = lambda p: (p.x * sx + dx, p.y * sy + dy)
    rec = RecordingPen()
    rec.moveTo(T(curve.start_point))
    for seg in curve:
        if seg.is_corner:
            rec.lineTo(T(seg.c))
            rec.lineTo(T(seg.end_point))
        else:
            rec.curveTo(T(seg.c1), T(seg.c2), T(seg.end_point))
    rec.closePath()
    return rec


def bbox(rec):
    xs = [p[0] for _, args in rec.value for p in args]
    ys = [p[1] for _, args in rec.value for p in args]
    return (min(xs), min(ys), max(xs), max(ys)) if xs else (0, 0, 0, 0)


def inside(a, b):
    return a[0] > b[0] and a[1] > b[1] and a[2] < b[2] and a[3] < b[3]


def draw(path, pen, sx, sy, dx, dy):
    """Contours out, holes in. potracer gives no nesting information of its own — the
    curves arrive as a flat list — so containment decides which contours are counters,
    and each is then wound the way TrueType needs: outlines clockwise, counters the
    other way. Get this wrong and the O fills in solid while the A comes out inverted,
    which is precisely what it did."""
    recs = [record(c, sx, sy, dx, dy) for c in path]
    boxes = [bbox(r) for r in recs]
    for i, rec in enumerate(recs):
        depth = sum(1 for j, other in enumerate(boxes) if j != i and inside(boxes[i], other))
        ap = AreaPen()
        rec.replay(ap)
        # AreaPen is positive for a counter-clockwise contour; TrueType wants an
        # outline clockwise (negative) and a counter the other way round
        want_negative = (depth % 2 == 0)
        if (ap.value < 0) != want_negative:
            rec.replay(ReverseContourPen(pen))
        else:
            rec.replay(pen)


def build(args):
    mask = load_binary(args.image, args.threshold)
    glyphs = slice_glyphs(mask, args.rows, args.gap)
    baselines, cap_px = metrics(glyphs)
    cap_units = args.cap_height
    scale = cap_units / cap_px
    print('%d glyphs · cap height %dpx in the image -> %d units' % (len(glyphs), cap_px, cap_units))
    if cap_px < 60:
        print('  note: under 60px of cap height the curves will carry some of the '
              'image\'s own noise. It will still set, but it will not be crisp.')

    # Sidebearings: the median gap between neighbouring glyphs in the specimen, split
    # in two. Taking it from the image keeps the rebuilt face spacing like the original
    # rather than like whatever default I would have picked.
    gaps = [b['x0'] - a['x1'] for a, b in zip(glyphs, glyphs[1:])
            if b['row'] == a['row'] and b['x0'] > a['x1']]
    measured = (np.median(gaps) / 2 if gaps else cap_px * 0.06) / cap_px
    if args.sidebearing is not None:
        side_ratio = args.sidebearing
    else:
        side_ratio = measured
        # A specimen is usually set with tracking added so the letters are easy to read
        # apart, and that tracking is indistinguishable from the font's own sidebearings.
        # Past this much it is almost certainly the sheet, not the face.
        if measured > 0.10:
            side_ratio = 0.06
            print('  gaps in the sheet measure %.0f%% of cap height a side, which is far '
                  'too loose to be the font\'s own — assuming the specimen was tracked '
                  'out and using 6%%. Pass --sidebearing to set it yourself.'
                  % (measured * 100))
    side = int(round(side_ratio * cap_px * scale))

    pens, widths = {}, {}
    for g in glyphs:
        paths = trace(g['mask'], args.upscale)
        up = args.upscale
        tt = TTGlyphPen(None)
        # cu2qu does the cubic-to-quadratic conversion properly, to a stated tolerance,
        # rather than my pretending the control points mean the same thing in both
        pen = Cu2QuPen(tt, args.tolerance)
        # potrace y runs down the bitmap; the font's runs up from the baseline
        draw(paths, pen, scale / up, -scale / up,
             side, (baselines[g['row']] - g['top']) * scale)
        pens[g['char']] = tt.glyph()
        widths[g['char']] = int(round((g['x1'] - g['x0']) * scale)) + side * 2

    order = ['.notdef', 'space'] + [chr_name(g['char']) for g in glyphs]
    gset = {'.notdef': TTGlyphPen(None).glyph(), 'space': TTGlyphPen(None).glyph()}
    wset = {'.notdef': int(cap_units * 0.5), 'space': int(cap_units * 0.32)}
    cmap = {}
    for g in glyphs:
        n = chr_name(g['char'])
        gset[n] = pens[g['char']]
        wset[n] = widths[g['char']]
        cmap[ord(g['char'])] = n
    cmap[32] = 'space'

    fb = FontBuilder(UPEM, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(gset)
    fb.setupHorizontalMetrics({n: (wset[n], 0) for n in order})
    asc, desc = int(cap_units * 1.05), int(-cap_units * 0.25)
    fb.setupHorizontalHeader(ascent=asc, descent=desc)
    fam, sub = args.name, args.style
    fb.setupNameTable({'familyName': fam, 'styleName': sub,
                       'uniqueFontIdentifier': '%s %s rebuilt' % (fam, sub),
                       'fullName': '%s %s' % (fam, sub),
                       'psName': ('%s-%s' % (fam, sub)).replace(' ', ''),
                       'version': 'Version 1.0'})
    fb.setupOS2(sTypoAscender=asc, sTypoDescender=desc, usWinAscent=asc, usWinDescent=-desc,
                sCapHeight=cap_units, achVendID='RBLD',
                usWeightClass=args.weight)
    fb.setupPost()
    os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)
    fb.save(args.out + '.ttf')
    try:
        from fontTools.ttLib import TTFont
        f = TTFont(args.out + '.ttf'); f.flavor = 'woff2'; f.save(args.out + '.woff2')
    except Exception as e:
        print('  woff2 skipped:', e)
    print('wrote %s.ttf (%d bytes)' % (args.out, os.path.getsize(args.out + '.ttf')))
    if os.path.exists(args.out + '.woff2'):
        print('wrote %s.woff2 (%d bytes)' % (args.out, os.path.getsize(args.out + '.woff2')))


def chr_name(c):
    if c.isalpha(): return c
    return {'0':'zero','1':'one','2':'two','3':'three','4':'four','5':'five',
            '6':'six','7':'seven','8':'eight','9':'nine'}.get(c, 'uni%04X' % ord(c))


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('image')
    ap.add_argument('rows', nargs='+', help='the characters in each row, top to bottom')
    ap.add_argument('--name', default='Rebuilt')
    ap.add_argument('--style', default='Regular')
    ap.add_argument('--weight', type=int, default=900)
    ap.add_argument('--out', default='build/rebuilt')
    ap.add_argument('--cap-height', type=int, default=700, help='cap height in font units')
    ap.add_argument('--threshold', type=int, default=128)
    ap.add_argument('--gap', type=float, default=0.06,
                    help='column gap counted as a letter break, as a fraction of row height')
    ap.add_argument('--sidebearing', type=float, default=None,
                    help='side space per glyph as a fraction of cap height '
                         '(default: measured off the sheet)')
    ap.add_argument('--upscale', type=int, default=4)
    ap.add_argument('--tolerance', type=float, default=1.0,
                    help='cubic-to-quadratic error allowed, in font units')
    build(ap.parse_args())
