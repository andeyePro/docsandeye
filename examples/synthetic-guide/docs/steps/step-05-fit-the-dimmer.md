---
id: step-05-fit-the-dimmer
order: 5
title: Fit the dimmer
guide: lamp
when: {dimmer: true}
parts:
  - {component: dimmer-module, qty: 1, cat: part}
media: [vid-05-fit-the-dimmer]
safety: "Work with the power supply unplugged."
checks_draft: true
checks:
  - id: dims
    question: "Does turning the dimmer knob change the brightness smoothly?"
    issues:
      - {problem: "The lamp is off at every setting", fix: "The dimmer's input and output are swapped: the supply goes to IN, the lamp to OUT."}
      - {problem: "The lamp only switches between off and full", fix: "Check the knob's grub screw is tight on its shaft."}
---
This step only appears for readers fitting the optional dimmer.

Cut the spare cable you left at the base and strip 5 mm from each end.

Connect the supply side to the dimmer's **IN** terminals and the lamp side to **OUT**. Match red to plus.

Stick the dimmer to the underside of the base with its knob facing out through the cable slot.
