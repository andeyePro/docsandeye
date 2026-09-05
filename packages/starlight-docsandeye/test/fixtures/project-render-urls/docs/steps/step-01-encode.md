---
id: step-01-encode
order: 1
title: Encode the render URLs
guide: enc
parts:
  - {component: odd-cap, qty: 1, cat: printed}
  - {component: model-kit, qty: 1, cat: part}
renders:
  - {id: odd-front, component: odd-cap, view: front, format: stl}
  - {id: kit-iso, component: model-kit, format: glb}
  - {id: plain-iso, component: plain-cap, format: png}
viewer: {component: odd-cap, format: stl}
---
Three renders: an STL-only hand export, a hand export with a GLB, and an
ordinary rendered PNG. The step viewer points at the STL-only hand export,
which `<docsi-model>` cannot load: it must be offered as a download.
