#!/usr/bin/env python3
"""Narrow a font, keeping its weight.

A family's widths are separate designs, not one design stretched, so this cannot
produce the real narrow cut of a face from its wide one. What it can do is get close
enough to work, which matters when the only file you have is the wrong width.

    python3 tools/condense-font.py Bernoru.otf --width 0.62 --name "Bernoru Narrow" \
        --out build/bernoru-narrow

Squeezing horizontally is the easy half and the half that looks wrong: a vertical stem
is thinned by exactly the squeeze while a horizontal bar keeps its thickness, so a
heavy face goes lopsided and light. So the stems are put back — the outline is unioned
with copies of itself shifted left and right by half the width the squeeze removed,
which grows verticals and leaves horizontals alone. Measured off the font's own I, so
the amount suits the face rather than a guess.
"""
import argparse, os
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.fontBuilder import FontBuilder
import pathops


def as_path(glyphset, name):
    p = pathops.Path()
    glyphset[name].draw(p.getPen(glyphSet=glyphset))
    return p


def stem_width(glyphset, cmap):
    """The face's vertical stem, taken off I where there is nothing else in the way,
    falling back to the narrowest letter that has one."""
    for ch in 'IHLET':
        name = cmap.get(ord(ch))
        if not name:
            continue
        p = as_path(glyphset, name)
        x0, y0, x1, y1 = p.bounds
        if ch == 'I':
            return x1 - x0
        return (x1 - x0) * 0.22          # a rough stem for a heavy grotesque
    return None


def condense(src_path, k, out, family, style, weight, restore, sb, steps):
    font = TTFont(src_path)
    upem = font['head'].unitsPerEm
    cmap = font.getBestCmap()
    gs = font.getGlyphSet()
    hmtx = font['hmtx']

    stem = stem_width(gs, cmap) or upem * 0.2
    shift = stem * (1 - k) / 2 * restore
    print('squeezing to %.0f%% · stem measures %d units · widening back by %d either side'
          % (k * 100, round(stem), round(shift)))

    names = ['.notdef'] + [n for n in sorted(set(cmap.values()))]
    # where the ink sat before anything was done to it, so the space around it can be kept
    orig_bounds = {}
    for name in names:
        if name in gs:
            q = as_path(gs, name)
            orig_bounds[name] = q.bounds if q.contours else (0, 0, 0, 0)
    glyphs, widths = {}, {}
    for name in names:
        if name not in gs:
            continue
        p = as_path(gs, name)
        p.simplify(fix_winding=True, keep_starting_points=False)
        # transform() hands back a new path rather than changing this one, so its
        # return value is the whole point of calling it
        p = p.transform(k, 0, 0, 1, 0, 0)                   # the squeeze
        if shift > 0.5 and p.contours:
            # Sweep the outline along a horizontal segment and union the lot. Three
            # copies is not a sweep, it is three copies: on a vertical stem you cannot
            # tell, but on the diagonals of M, W and N it leaves notches where the
            # shifted edges cross. Enough steps and it converges on the real thing.
            parts = [p.transform(1, 0, 0, 1, -shift + 2 * shift * i / (steps - 1), 0)
                     for i in range(steps)]
            merged = pathops.Path()
            pathops.union(parts, merged.getPen())
            merged.simplify(fix_winding=True, keep_starting_points=False)
            p = merged
        adv, _ = hmtx[name]
        if p.contours:
            # Sidebearings do NOT squeeze with the glyph. A narrower cut of a face keeps
            # roughly the space its stems ask for, so scaling them by the same factor —
            # which is what this did first — walks the letters into each other. Keep the
            # original space either side, and place the squeezed ink inside it.
            ox0, _, ox1, _ = orig_bounds[name]
            # a glyph may legitimately hang outside its advance; that is a kern, not
            # a sidebearing, and carrying it through as one makes the advance negative
            lsb, rsb = max(0, ox0), max(0, adv - ox1)
            nx0, _, nx1, _ = p.bounds
            p = p.transform(1, 0, 0, 1, (lsb * sb) - nx0, 0)
            widths[name] = max(0, int(round((nx1 - nx0) + lsb * sb + rsb * sb)))
        else:
            widths[name] = max(0, int(round(adv * k)))  # space and the like
        tt = TTGlyphPen(None)
        p.draw(Cu2QuPen(tt, 1.0))
        glyphs[name] = tt.glyph()

    order = [n for n in names if n in glyphs]
    fb = FontBuilder(upem, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap({c: n for c, n in cmap.items() if n in glyphs})
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics({n: (widths[n], 0) for n in order})
    hhea, os2 = font['hhea'], font['OS/2']
    fb.setupHorizontalHeader(ascent=hhea.ascent, descent=hhea.descent)
    fb.setupNameTable({'familyName': family, 'styleName': style,
                       'uniqueFontIdentifier': '%s %s' % (family, style),
                       'fullName': '%s %s' % (family, style),
                       'psName': ('%s-%s' % (family, style)).replace(' ', ''),
                       'version': 'Version 1.0'})
    fb.setupOS2(sTypoAscender=hhea.ascent, sTypoDescender=hhea.descent,
                usWinAscent=hhea.ascent, usWinDescent=abs(hhea.descent),
                sCapHeight=getattr(os2, 'sCapHeight', int(upem * 0.7)),
                usWeightClass=weight, achVendID='CNDS')
    fb.setupPost()
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    fb.save(out + '.ttf')
    f = TTFont(out + '.ttf'); f.flavor = 'woff2'; f.save(out + '.woff2')
    print('wrote %s.ttf and %s.woff2 (%d glyphs)' % (out, out, len(order)))


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('font')
    ap.add_argument('--width', type=float, required=True, help='0.62 keeps 62% of the width')
    ap.add_argument('--name', default='Condensed')
    ap.add_argument('--style', default='Black')
    ap.add_argument('--weight', type=int, default=900)
    ap.add_argument('--restore', type=float, default=1.0,
                    help='how much of the lost stem width to put back, 0 to 1')
    ap.add_argument('--steps', type=int, default=17,
                    help='samples in the widening sweep; too few notches the diagonals')
    ap.add_argument('--sidebearings', type=float, default=1.0,
                    help='how much of the original side space to keep, 1.0 = all of it')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    condense(a.font, a.width, a.out, a.name, a.style, a.weight, a.restore,
             a.sidebearings, a.steps)
