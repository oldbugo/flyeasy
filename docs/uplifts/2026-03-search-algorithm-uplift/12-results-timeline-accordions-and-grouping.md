# Results Timeline Accordions And Grouping

## Status

`Complete`

## Why this change was needed

The live results timeline was too compressed.

Each row gave a useful visual position on the search window, but it was not
possible to expand the row to inspect the underlying flight details.

The grouping rule was also too loose. It could group routes that shared the
same broad carrier pattern and stop shape even when the actual flight chain was
not identical.

## What changed

- each grouped summary row now stays on a shared date-range axis:
  - the axis starts at the earliest departure date in view
  - the axis ends at the latest arrival date in view
  - each grouped route shows its trip date span aligned against that shared axis
  - airline chain, route, and representative fare are shown above or beside the
    summary line
- each timeline row is now expandable as an accordion-style details row
- expanding a row shows the exact grouped variants
- each variant shows:
  - separate outbound and return route lines
  - left anchor = departure time
  - right anchor = arrival time
  - line length = relative travel duration
  - transfer points = stopover markers
  - later-day arrivals = small `+1` style badge
  - fare
  - flight-by-flight legs
  - provider labels
  - exact departure and arrival timestamps
  - stopover details
- grouped variants are now only grouped when:
  - the booking type matches
  - the stitched risk bucket matches
  - the full flight chain matches
  - the stopover structure matches
  - the remaining difference is timing-related

## Result

The results timeline is now usable as both:

- a fast visual ranking surface
- a drill-down surface for exact flight inspection

The tighter grouping rule also makes the `similar routes` label more honest,
because grouped variants now represent timing variants of the same provider
chain rather than looser route cousins.
