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
      - {problem: "It *wobbles*", fix: "Tighten the widgets **by hand**; see the [torque table](https://widgets.example/torque)."}
  - id: probe-seated
    question: "Is the probe seated?"
    when: {temp-kit: true}
  - id: config
    question: "Does `config.ini` list every widget?"
    issues:
      - {problem: "A widget is missing from `config.ini`", fix: "Add a line per widget."}
  - id: frame-feet
    question: "Which way up are the frame's feet?"
    options:
      - {label: "Pointing up", fix: "Turn the frame over."}
      - {label: "Pointing sideways", fix: "Rotate the frame a quarter turn."}
      - {label: "Touching the table", correct: true}
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

Links: back to [unpacking](step-01-unpack.md#keep-the-spares), the [probe](./step-02-probe.md),
the [widget file](../components/widget.yaml), the [readme](../../README.md#over-ssh),
the [cap folder](../../Components/Vial%20Cap/), the [other guide's step](other-01-paint.md),
[outside](../../../elsewhere/notes.md), [the site](https://example.com/x) and [top](#_top).

![Wiring](../../Media/wiring%20diagram.png)

<a href="../components/">The parts folder</a>
