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
  - id: laid-out
    question: "How are the parts laid out on the table?"
    options:
      - {label: "Still in the box", fix: "Take every part out so you can count it."}
      - {label: "In one pile per unit", correct: true}
      - {label: "All in one heap", image: docs/img/parts-heap.svg, alt: "Every part in a single heap", fix: "Split them into one pile per unit."}
---
Open the box and lay the parts out.

<!-- when units>=2 -->
Building several units? Sort the parts into one tray per unit.
<!-- /when -->

Keep the bag of spares.

:::tip[Sort first]
Lay the widgets out before you count them.
:::

:::note
Nothing here needs tools.
:::
