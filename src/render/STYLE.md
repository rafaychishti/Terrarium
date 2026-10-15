# Paper renderer style

The Paper level should feel like a field sketch that has become a living,
three-dimensional specimen. Keep the jar itself the subject; no panels,
controls, or interface chrome sit over it.

## Palette

| Use | Colour |
| --- | --- |
| Warm paper | `#eee7d8` |
| Ink / outlines | `#354139` |
| Glass wash and highlight | `#c9d7d1`, `#fffdf5` |
| Gravel | `#82745f` |
| Sand | `#c4a875` |
| Soil | `#604d3f` |
| Clay | `#8b7667` |
| Rock | `#555b55` |
| Water | `#8ebdc0` |
| Detritus | `#80674b` |
| Plant / microbial wash | `#536e4b`, `#739a66` |

Materials are translucent washes over the paper ground; glass is lighter and
never obscures its contents. Unknown material IDs use a muted earth-grey
rather than an error colour.

## Line weights and composition

Use narrow, irregular-looking botanical ink lines. The outer case outline is
about 0.9% of the rendered jar width, the inside edge 0.6%, and the reflective
glass strokes 1.8%. The case remains tall and narrow (256 × 384 mm by default),
centred with generous paper margin. Scale by real-world proportions, not by
stretching to fit either screen axis.

## Paper texture

Use deterministic, low-contrast short flecks on the warm paper. Texture must
be reproducible for identical input, inexpensive enough for the Paper quality
level, and generated with renderer-local integer hashing rather than random
or wall-clock values.
