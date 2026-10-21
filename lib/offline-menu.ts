import type { Menu } from "@/lib/menu";

const esc = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

// A single self-contained page: works with no internet, prints well, and can be shared like a PDF.
export function buildOfflineMenuHtml(menu: Menu, link: string) {
  const dishes = menu.dishes.filter((d) => !d.secret);
  const byCat = new Map<string, typeof dishes>();
  for (const d of dishes) {
    const k = d.category || "Menu";
    byCat.set(k, [...(byCat.get(k) || []), d]);
  }
  const saved = new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const sections = [...byCat.entries()]
    .map(
      ([cat, list]) => `<section><h2>${esc(cat)}</h2>${list
        .map(
          (d) => `<article class="${d.available ? "" : "off"}"><div class="row"><h3><span class="dot ${d.veg ? "veg" : "non"}"></span>${esc(d.name)}</h3><b>&#8377;${d.price}</b></div>${
            d.description ? `<p>${esc(d.description)}</p>` : ""
          }<small>${esc(d.spice)} spice${d.allergens ? " &middot; Allergens: " + esc(d.allergens) : ""}${d.available ? "" : " &middot; Sold out when saved"}</small></article>`
        )
        .join("")}</section>`
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(menu.name)} menu</title>
<style>body{margin:0;background:#fdf6ec;color:#251913;font:16px/1.5 system-ui,Arial,sans-serif}main{max-width:720px;margin:auto;padding:24px 18px 48px}
header{border-bottom:3px solid #df4d03;padding-bottom:14px;margin-bottom:8px}h1{margin:0;font:700 32px Georgia,serif}header p{margin:4px 0 0;color:#7b6d64}
h2{font:700 20px Georgia,serif;color:#b83d00;margin:26px 0 6px;border-bottom:1px solid #e9dccd;padding-bottom:4px}article{padding:10px 0;border-bottom:1px solid #f1e6d8}.row{display:flex;justify-content:space-between;gap:12px;align-items:baseline}
h3{margin:0;font-size:17px}article p{margin:2px 0;color:#5f5148}small{color:#9a8a7c}.off{opacity:.55}.dot{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:8px;border:2px solid}.veg{border-color:#16a34a;background:#16a34a}.non{border-color:#b91c1c;background:#b91c1c}
footer{margin-top:30px;color:#7b6d64;font-size:13px;text-align:center}@media print{body{background:#fff}}</style></head><body><main>
<header><h1>${esc(menu.name)}</h1>${menu.tagline ? `<p>${esc(menu.tagline)}</p>` : ""}</header>${sections}
<footer>${menu.note ? esc(menu.note) + "<br>" : ""}Saved on ${esc(saved)}. Prices and availability may have changed.<br>Order live at ${esc(link)}<br>Table Secret by AS 426 Studios</footer></main></body></html>`;
}
