/* The fixed wording used on every page other than the homepage (top bar, bottom booking box,
   footer, page labels, the 404 and booking-confirmed pages). Saved in site-src/content/site-text.json
   and read by site-src/build.py. These are the labels the editor shows for each line. */
export const SITE_TEXT_JSON = "site-src/content/site-text.json";
export const SITE_TEXT_GROUPS = [
  { name: "Top bar and phone buttons", items: [
    ["hdr.book", "Top bar: book button"], ["hdr.contact", "Top bar: contact button"],
    ["qb.call", "Phone bottom bar: call"], ["qb.book", "Phone bottom bar: book"]] },
  { name: "Booking box at the bottom of pages", items: [
    ["cta.h", "Heading"], ["cta.p", "Text", "long"], ["cta.btn", "Button"], ["cta.call", "Call link"]] },
  { name: "Footer", items: [
    ["foot.tag", "Line under the logo", "long"], ["foot.company", "Column heading: Company"], ["foot.explore", "Column heading: Explore"],
    ["foot.contact", "Column heading: Contact"], ["foot.book", "Book link"], ["foot.copy", "Copyright line"],
    ["foot.privacy", "Privacy link"], ["foot.terms", "Terms link"]] },
  { name: "Labels on guide, industry and service pages", items: [
    ["pg.inshort", "Key points heading"], ["pg.questions", "Questions heading"], ["pg.onpage", "Contents heading"],
    ["pg.keep", "Related pages heading"], ["pg.minread", "After the reading time (5 …)"], ["pg.updated", "Before the date"],
    ["pg.nz", "Service area label"], ["pg.free", "Free session label"], ["pg.readguide", "Guide card link"],
    ["pg.learn", "Industry and service card link"], ["pg.readmore", "News card link"],
    ["pg.allguides", "All guides link"], ["pg.allind", "All industries link"], ["pg.popular", "Popular guides heading"],
    ["pg.byind", "Guides by industry heading"], ["pg.svchow", "Services: steps heading"],
    ["pg.post", "News count: one (1 …)"], ["pg.posts", "News count: many (3 …)"],
    ["pg.legalwhere", "Privacy and terms: place"], ["pg.lastupdated", "Privacy and terms: before the date"]] },
  { name: "Hours calculator on guide pages", items: [
    ["calc.k", "Small heading"], ["calc.h", "Heading"], ["calc.sub", "Text", "long"], ["calc.times", "Slider: times a week"],
    ["calc.mins", "Slider: minutes"], ["calc.share", "Slider: share automated"], ["calc.now", "Result: hours now"],
    ["calc.year", "Result: hours a year"], ["calc.note", "Note", "long"], ["calc.link", "Link"]] },
  { name: "Page not found (404)", items: [
    ["nf.eyebrow", "Small heading"], ["nf.h1", "Heading"], ["nf.lead", "Text", "long"], ["nf.home", "Home button"], ["nf.guides", "Guides button"]] },
  { name: "Booking confirmed page", items: [
    ["bk.eyebrow", "Small heading"], ["bk.h1", "Heading (the visitor's first name is added after it)"],
    ["bk.meeting", "Label: meeting"], ["bk.service", "Meeting name"], ["bk.date", "Label: date"], ["bk.time", "Label: time"],
    ["bk.length", "Label: length"], ["bk.lengthv", "Length"], ["bk.with", "Label: with"], ["bk.withv", "With"],
    ["bk.mail", "Email line", "long"], ["bk.mailto", "Email line with their address (the address goes after it)", "long"],
    ["bk.change", "Change the time line (the phone number goes after it)", "long"], ["bk.back", "Home button"]] },
];
export const SITE_TEXT_KEYS = SITE_TEXT_GROUPS.flatMap((g) => g.items.map((i) => i[0]));
