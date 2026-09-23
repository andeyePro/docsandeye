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
safety: "Unplug before you finish."
---
Fit the widgets.

<!-- when supplier=shop-a,shop-b -->
Your kit includes the widgets pre-cut.
<!-- /when -->

<!-- TODO: an ordinary comment stays a comment -->
Done.
