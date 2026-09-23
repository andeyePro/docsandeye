---
id: step-03-fit-the-led-module
order: 3
title: Fit the LED module
guide: lamp
parts:
  - {component: led-module, qty: 1, cat: part}
  - {component: m3-screw, qty: 2, cat: part}
  - {component: dimmer-module, qty: 1, cat: part, when: {dimmer: true}}
media: [photo-03-led-module]
safety: "Work with the power supply unplugged."
checks:
  - id: lights
    question: "Does the LED module light when you plug in the supply?"
    issues:
      - {problem: "Nothing lights", fix: "Check the plug is fully home and the supply is switched on at the wall."}
      - {problem: "It flickers", fix: "Reseat the LED module in its recess so the contacts meet squarely."}
  - id: cable-free
    question: "Does the cable run freely through the arm without pinching?"
    issues:
      - {problem: "The cable is trapped", fix: "Loosen the two M3 screws, free the cable and tighten them again."}
---
Feed the LED cable down through the arm and out through the cable slot in the base.

<!-- when dimmer=true -->
Fitting the dimmer? Leave 10 cm of spare cable at the base; the dimmer goes in line there in the last step.
<!-- /when -->

Seat the **LED module** in the recess at the top of the arm. Fix it with two M3 screws.

Plug in the supply and check that the module lights. Unplug it again before the next step.

<!-- when lamps>=2 -->
Building more than one lamp? Test each LED module now, before its arm is closed up; a dud found later means taking the lamp apart again.
<!-- /when -->
