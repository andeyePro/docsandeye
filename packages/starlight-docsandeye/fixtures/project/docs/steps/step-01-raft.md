---
id: step-01-raft
order: 1
title: Print the raft
guide: [aep, mep]
parts:
  - {component: blank-cap, qty: 2, cat: printed}
  - {component: anode, qty: 1, cat: part}
# blank-cap is hand-exported (master_format f3z): its outputs are its
# derived_files, so core's render plan collapses these two renders AND
# step-03-mep-only's viewer into a single job. All three references must
# still resolve — by outputs, not by job key.
renders:
  - {id: blank-front, component: blank-cap, view: front, format: stl}
  - {id: blank-iso, component: blank-cap, format: stl}
media: [photo-01-raft, vid-01-raft]
---
Print two blank caps as a raft for the vials. Use the default slicer profile.

Check that the anode fits through the centre bore before continuing.
