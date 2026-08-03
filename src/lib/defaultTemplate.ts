export const DEFAULT_TEMPLATE_NAME = "默认模板";

export const DEFAULT_TYPST_TEMPLATE = `#set page(width: 21cm, height: 29.7cm, margin: (x: 1.8cm, y: 1.6cm))
#set text(size: 10pt)
#set par(justify: true, leading: 0.55em)

#let section(title) = [
  #v(0.4em)
  #text(weight: "bold", size: 11pt)[#title]
  #line(length: 100%, stroke: 0.5pt)
  #v(0.2em)
]

#let entry(title, subtitle, dates, bullets) = [
  #grid(
    columns: (1fr, auto),
    text(weight: "bold")[#title], text(style: "italic")[#dates],
  )
  #text(size: 9.5pt, fill: rgb("#444444"))[#subtitle]
  #for b in bullets [
    - #b
  ]
  #v(0.3em)
]

// ---- Header ----
#align(center)[
  #text(size: 18pt, weight: "bold")[Your Name]
  #v(0.15em)
  #text(size: 9.5pt)[email\\@example.com | +1 234 567 8900 | City, Country]
]

#section[Education]
#entry(
  "University Name",
  "Degree, Major",
  "2022 -- 2026",
  (),
)

#section[Experience]
#entry(
  "Company / Project Title",
  "Role",
  "Jun 2025 -- Aug 2025",
  (
    "Bullet describing action and quantified result.",
    "Second bullet with another quantified outcome.",
  ),
)

#section[Skills]
Languages: \\
Tools: \\
`;
