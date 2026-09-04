---
id: step-01-example
order: 1
title: Gather the parts
guide: {{guide}}
parts:
  - {component: example-part, qty: 1}
---
Lay out every part listed above before you start.

Each step is a Markdown file under `docs/steps/` whose frontmatter names the
parts, tools and renders it needs. Add renders with

```yaml
renders:
  - {id: part-iso, component: example-part}
```

once the component has a CAD master, then run `docsandeye render`.
