---
id: step-01-unpack
order: 1
title: Unpack the kit
guide: kit
receipt: true
profile: true
parts:
  - {component: widget, qty: 2}
  - {component: spares-bag, qty: 1}
  - {component: plain, qty: 1}
media: [yt-01-unpack]
checks_draft: true
checks:
  - id: count
    question: "Did every part on the list arrive?"
    issues:
      - {problem: "A part is missing", fix: "Use the missing-parts email above."}
      - {problem: "A part is damaged", fix: "Photograph it and email your supplier."}
  - id: dry
    question: "Is everything dry?"
---
Open the box and lay the parts out.

<!-- when units>=2 -->
Building several units? Sort the parts into one tray per unit.
<!-- /when -->

Keep the bag of spares.
