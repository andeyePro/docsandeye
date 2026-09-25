---
id: step-03-finish
order: 3
title: Finish the build
guide: kit
parts:
  - {component: widget, qty: 2}
  - {component: bracket, qty: 1, when: {supplier: shop-b}}
media: [yt-03-old]
checks:
  - id: rigid
    question: "Is the frame rigid?"
    issues:
      - {problem: "It wobbles", fix: "Tighten the widgets."}
  - id: probe-seated
    question: "Is the probe seated?"
    when: {temp-kit: true}
  - id: config
    question: "Does `config.ini` list every widget?"
    issues:
      - {problem: "A widget is missing from `config.ini`", fix: "Add a line per widget."}
safety: "Unplug before you finish."
---
Fit the widgets.

:::caution[Mind the `edge`]
The frame edge is sharp.
:::

<!-- when supplier=shop-a,shop-b -->
Your kit includes the widgets pre-cut.
<!-- /when -->

<!-- TODO: an ordinary comment stays a comment -->
Done.
