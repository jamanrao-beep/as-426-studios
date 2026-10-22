"use client";

import { useEffect, useRef, useState } from "react";
import { poll } from "@/lib/poller";
import { LockKeyhole, Sparkles, Leaf, Flame, Plus, Minus, Search, Heart, Shuffle, Share2, Moon, Sun, ArrowUp, ArrowUpRight, ReceiptText, Coffee, CakeSlice, Salad, Soup, UtensilsCrossed, BellRing, Receipt, Languages, Download, WifiOff } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import PlacedOrders from "./placed-orders";
import Cart, { type CartItem } from "./cart";
import TableGames from "./table-games";
import TasteQuiz from "./taste-quiz";
import { Switch } from "@/components/ui/switch";
import type { Menu, Dish } from "@/lib/menu";
import { LANGS, useLang, type Lang } from "@/lib/i18n";
import { buildOfflineMenuHtml } from "@/lib/offline-menu";

function CategoryIcon({ name }: { name: string }) {
  const v = name.toLowerCase();
  const Icon = /drink|beverage|coffee/.test(v)
    ? Coffee
    : /sweet|dessert/.test(v)
    ? CakeSlice
    : /small|starter|salad/.test(v)
    ? Salad
    : /big|main|rice|biryani/.test(v)
    ? Soup
    : UtensilsCrossed;
  return <Icon size={22} strokeWidth={1.5} />;
}

export default function MenuView({ restaurant }: { restaurant: string }) {
  const { lang, setLang, t } = useLang();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [popular, setPopular] = useState<string[]>([]);
  const [large, setLarge] = useState(false);
  const [svcTable, setSvcTable] = useState("");
  const [svcMsg, setSvcMsg] = useState("");
  // Tapping "Add" swaps the button for a - 1 + control right under the finger. A quick second tap used to land
  // on the "-" and silently take the dish back out, so ignore minus taps for a moment after the first add.
  const justAdded = useRef<{ id: string; at: number } | null>(null);
  function removeFromCart(id: string) {
    if (justAdded.current?.id === id && Date.now() - justAdded.current.at < 700) return;
    setCart((items) => items.map((i) => (i.id === id ? { ...i, quantity: i.quantity - 1 } : i)).filter((i) => i.quantity > 0));
  }
  function toggleSaved(id: string) {
    setSaved((items) => (items.includes(id) ? items.filter((x) => x !== id) : [...items, id]));
  }
  function openOrders() {
    window.dispatchEvent(new Event("table-open-orders"));
    document.getElementById("placed-orders")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function addToCart(id: string) {
    setCart((items) =>
      items.some((i) => i.id === id)
        ? items.map((i) => (i.id === id ? { ...i, quantity: Math.min(20, i.quantity + 1) } : i))
        : [...items, { id, quantity: 1 }]
    );
  }

  const [menu, setMenu] = useState<Menu | null>(null);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("All dishes");
  const [veg, setVeg] = useState(false);
  const [query, setQuery] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [selected, setSelected] = useState<Dish | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [sort, setSort] = useState("recommended");
  const [onlySaved, setOnlySaved] = useState(false);
  const [spice, setSpice] = useState("any");
  const [toast, setToast] = useState("");
  const [offline, setOffline] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      setDark(localStorage.getItem("ts-theme") === "dark");
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.dataset.tsTheme = dark ? "dark" : "light";
    return () => {
      delete document.documentElement.dataset.tsTheme;
    };
  }, [dark]);

  useEffect(() => {
    try {
      setLarge(localStorage.getItem("ts-large") === "1");
      const g = localStorage.getItem("ts-guest:" + restaurant);
      if (g) setSvcTable((JSON.parse(g) as { table?: string }).table || "");
    } catch {}
  }, [restaurant]);

  function toggleLarge() {
    setLarge((v) => {
      try {
        localStorage.setItem("ts-large", v ? "0" : "1");
      } catch {}
      return !v;
    });
  }

  async function requestService(kind: "waiter" | "bill") {
    const table = svcTable.trim();
    if (!table) {
      setSvcMsg("Please enter your table number first.");
      return;
    }
    try {
      localStorage.setItem("ts-guest:" + restaurant, JSON.stringify({ table, name: "" }));
    } catch {}
    try {
      const r = await fetch("/api/service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurant, table, kind }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok && r.status !== 429) throw Error(d.error);
      setSvcMsg(t("Your server has been notified."));
      setToast(t("Your server has been notified."));
    } catch (e) {
      setSvcMsg(e instanceof Error ? e.message : "We couldn’t reach your server. Please wave to them.");
    }
  }

  function toggleTheme() {
    setDark((d) => {
      try {
        localStorage.setItem("ts-theme", d ? "light" : "dark");
      } catch {}
      return !d;
    });
  }
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 700);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    function reorder(e: Event) {
      const items = (e as CustomEvent<CartItem[]>).detail || [];
      const available = items.filter((i) => menu?.dishes.some((d) => d.id === i.id && d.available));
      setCart((cur) => {
        const next = [...cur];
        for (const i of available) {
          const at = next.findIndex((n) => n.id === i.id);
          if (at >= 0) next[at] = { ...next[at], quantity: Math.min(20, next[at].quantity + i.quantity) };
          else next.push({ id: i.id, quantity: Math.min(20, i.quantity) });
        }
        return next;
      });
      setToast(available.length ? "Items added to your cart" : "Those dishes aren’t available right now");
    }
    window.addEventListener("table-reorder", reorder);
    return () => window.removeEventListener("table-reorder", reorder);
  }, [menu]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function shareMenu() {
    const url = window.location.href.split("#")[0];
    try {
      if (navigator.share) {
        await navigator.share({ title: menu?.name || "Table Secret", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast("Menu link copied");
    } catch {
      setToast("Couldn’t share the link");
    }
  }
  const [avoid, setAvoid] = useState<string[]>([]);
  const [dishRatings, setDishRatings] = useState<Record<string, { averageRating: number; ratingCount: number }>>({});

  async function load() {
    setError("");
    try {
      const r = await fetch(`/api/menu?restaurant=${encodeURIComponent(restaurant)}`);
      const d = (await r.json()) as any;
      if (!r.ok) throw Error(d.error);
      setMenu(d.menu);
      setOffline(false);
      // Keep a copy on this phone so the menu still opens with no signal.
      try {
        localStorage.setItem(`ts-menu-cache:${restaurant}`, JSON.stringify({ menu: d.menu, savedAt: Date.now() }));
      } catch {}

      fetch(`/api/popular?restaurant=${encodeURIComponent(restaurant)}`)
        .then((res) => res.json())
        .then((data: any) => setPopular(Array.isArray(data?.popular) ? data.popular : []))
        .catch(() => {});

      // Fetch public star rating aggregates for each dish
      fetch(`/api/dish-ratings?restaurant=${encodeURIComponent(restaurant)}&public=1`)
        .then((res) => res.json())
        .then((data: any) => {
          if (data?.ratings) {
            setDishRatings(data.ratings);
          }
        })
        .catch(() => {});
    } catch (e) {
      // No signal: show the copy saved on this phone, if there is one.
      try {
        const raw = localStorage.getItem(`ts-menu-cache:${restaurant}`);
        if (raw && (!navigator.onLine || /fetch|network|load/i.test(String(e)))) {
          setMenu(JSON.parse(raw).menu);
          setOffline(true);
          setError("");
          return;
        }
      } catch {}
      setError(e instanceof Error ? e.message : "Couldn’t load menu");
    }
  }

  function downloadMenu() {
    if (!menu) return;
    try {
      const html = buildOfflineMenuHtml(menu, window.location.href.split("#")[0]);
      const file = new File([html], `${restaurant}-menu.html`, { type: "text/html" });
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      localStorage.setItem(`ts-menu-cache:${restaurant}`, JSON.stringify({ menu, savedAt: Date.now() }));
      setToast("Menu saved. Open it any time, even with no internet.");
    } catch {
      setToast("Couldn’t save the menu on this device");
    }
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`ts-favourites:${restaurant}`);
      if (raw) setSaved(JSON.parse(raw));
    } catch {}
  }, [restaurant]);

  useEffect(() => {
    try {
      localStorage.setItem(`ts-favourites:${restaurant}`, JSON.stringify(saved));
    } catch {}
  }, [saved, restaurant]);

  useEffect(() => {
    load();
    return poll(async () => {
      await load();
    }, { base: 60000, max: 120000 });
  }, [restaurant]);

  useEffect(() => {
    const mc = (document as unknown as { modelContext?: { registerTool: (t: unknown, o: unknown) => void } })
      .modelContext;
    if (!mc) return;
    const a = new AbortController();
    try {
      mc.registerTool(
        {
          name: "filter_menu",
          description: "Filter the visible restaurant menu by search text and vegetarian preference.",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string" }, vegetarian: { type: "boolean" } },
            required: ["query", "vegetarian"],
            additionalProperties: false,
          },
          execute: (v: unknown) => {
            const b = v as { query: string; vegetarian: boolean };
            if (typeof b.query !== "string" || typeof b.vegetarian !== "boolean") throw Error("Invalid filters");
            setQuery(b.query);
            setVeg(b.vegetarian);
            setCategory("All dishes");
            return { query: b.query, vegetarian: b.vegetarian };
          },
          annotations: { readOnlyHint: false },
        },
        { signal: a.signal }
      );
    } catch {}
    return () => a.abort();
  }, []);

  if (!menu) {
    return (
      <main className="access">
        {!error && (
          <div className="skeleton-wrap" aria-hidden="true">
            <span className="skeleton sk-title" />
            <span className="skeleton sk-line" />
            <span className="skeleton sk-card" />
            <span className="skeleton sk-card" />
          </div>
        )}
        <h1>{error ? "We’ll be right with you." : "Setting your table…"}</h1>
        <p role="status">{error}</p>
        {error && (
          <button className="primary" onClick={load}>
            Try again
          </button>
        )}
        <PlacedOrders restaurant={restaurant} />
      </main>
    );
  }

  const regular = menu.dishes.filter((d) => !d.secret);
  const secrets = menu.dishes.filter((d) => d.secret && d.available);
  const categories = ["All dishes", ...new Set(regular.map((d) => d.category))];
  const allergenList = [
    ...new Set(
      regular.flatMap((d) =>
        (d.allergens || "")
          .split(/[,/;]/)
          .map((a) => a.trim())
          .filter((a) => a && !/^(none|nil|n\/a)$/i.test(a))
      )
    ),
  ].sort();
  const hasAvoided = (d: Dish) =>
    avoid.some((a) => (d.allergens || "").toLowerCase().split(/[,/;]/).map((x) => x.trim()).includes(a.toLowerCase()));
  const shown = regular.filter(
    (d) =>
      (category === "All dishes" || d.category === category) &&
      (!veg || d.veg) &&
      (!onlySaved || saved.includes(d.id)) &&
      (spice === "any" || d.spice === spice) &&
      !hasAvoided(d) &&
      `${d.name} ${d.description}`.toLowerCase().includes(query.toLowerCase())
  );
  const rate = (id: string) => dishRatings[id]?.averageRating || 0;
  if (sort === "price-low") shown.sort((a, b) => a.price - b.price);
  else if (sort === "price-high") shown.sort((a, b) => b.price - a.price);
  else if (sort === "top-rated") shown.sort((a, b) => rate(b.id) - rate(a.id));

  return (
    <div className={`customer ts-dining ts-editorial${dark ? " ts-dark" : ""}${large ? " ts-large" : ""}`}>
      <header className="brandbar">
        <span className="brand">
          <span className="brandmark" aria-hidden="true" />
          <span className="editorial-wordmark">
            table secret<span className="brand-period">.</span>
            <small className="brand-byline">BY AS 426 STUDIOS</small>
          </span>
        </span>
        <div className="header-actions">
          <button className="header-orders" onClick={toggleTheme} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}
            <span>{t(dark ? "Light" : "Dark")}</span>
          </button>
          <button className="header-orders" onClick={shareMenu} aria-label="Share this menu">
            <Share2 size={17} />
            <span>{t("Share")}</span>
          </button>
          <button className="header-orders" onClick={openOrders}>
            <ReceiptText size={17} />
            <span>{t("My orders")}</span>
          </button>
        </div>
      </header>
      <main>
        <section className="menu-heading">
          <div className="hero-content">
            <p className="eyebrow">
              WELCOME TO YOUR TABLE
            </p>
            <h1>{menu.name}</h1>
            <p className="hero-tagline">{menu.tagline}</p>
            <a className="hero-cta" href="#restaurant-menu">
              {t("View the menu")}
              <ArrowUpRight size={18} />
            </a>
          </div>
        </section>

        <nav className="customer-nav" aria-label="Customer navigation">
          <a href="#table-secret">{t("Secret")}</a>
          <a href="#your-taste">{t("Taste quiz")}</a>
          <a href="#table-games">{t("Table games")}</a>
          <a href="#restaurant-menu">
            {t("Menu")} <ArrowUpRight size={15} />
          </a>
        </nav>

        <div className="customer-prefs">
          <label>
            <Languages size={15} />
            <span className="sr-only">{t("Language")}</span>
            <select aria-label={t("Language")} value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="chip" onClick={downloadMenu} aria-label={t("Save menu offline")}>
            <Download size={14} /> <span>{t("Save menu offline")}</span>
          </button>
          <button type="button" className="chip" aria-pressed={large} onClick={toggleLarge} aria-label={t("Text size")}>
            <span style={{ fontSize: large ? 17 : 13, fontWeight: 700 }}>Aa</span> <span>{t("Text size")}</span>
          </button>
        </div>

        {offline && (
          <p className="offline-banner" role="status">
            <WifiOff size={15} /> No internet. Showing the menu saved on this phone. Ordering needs a connection.
          </p>
        )}

        <PlacedOrders restaurant={restaurant} />

        {error && (
          <p className="error" role="alert">
            {error} · Menu may be out of date. <button onClick={load}>Refresh menu</button>
          </p>
        )}

        <section className="secret-banner" id="table-secret">
          <div className="secret-copy">
            <span className="pill">
              <Sparkles size={14} /> {t("SOMETHING SPECIAL")}
            </span>
            <h2>{t("Your table has a delicious secret.")}</h2>
            <p>{t("A little something you won’t find on the regular menu.")}</p>
            <button className="primary" onClick={() => setUnlocked(!unlocked)}>
              <LockKeyhole size={17} />
              {t(unlocked ? "Hide the secret" : "Unlock the secret")}
            </button>
          </div>
        </section>

        {unlocked && (
          <section className="secret-reveal" aria-live="polite">
            <span className="eyebrow">YOU’RE IN ON THE SECRET</span>
            {secrets.length > 0 ? (
              secrets.map((d) => (
                <div className="reveal-row" key={d.id}>
                  <div>
                    <h2>{d.name}</h2>
                    <p>{d.description}</p>
                    <small>Allergens: {d.allergens || "Ask your server"}</small>
                  </div>
                  <button className="primary" onClick={() => setSelected(d)}>
                    Discover · ₹{d.price}
                  </button>
                </div>
              ))
            ) : (
              <div className="reveal-row">
                <div>
                  <h2>{t("Chef’s Secret Table Tasting")}</h2>
                  <p>{t("A little something off-menu crafted fresh today. Ask your server for table specials.")}</p>
                  <small>{t("Prepared fresh to order")}</small>
                </div>
              </div>
            )}
          </section>
        )}

        <div className="customer-extras">
          <div id="your-taste">
            <TasteQuiz menu={menu} onPick={setSelected} />
          </div>
          <div id="table-games">
            <TableGames />
          </div>
        </div>

        <section className="menu-section" id="restaurant-menu">
          <div className="section-top">
            <div>
              <p className="eyebrow">{t("FRESH PICKS FOR YOUR TABLE")}</p>
              <h2>{t("Find your favourite.")}</h2>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={veg}
              className={`veg-toggle-chip ${veg ? "active" : ""}`}
              onClick={() => setVeg(!veg)}
              aria-label={t("Vegetarian dishes only")}
            >
              <span className="veg-badge-symbol" aria-hidden="true">
                <span className="veg-symbol-border">
                  <span className="veg-symbol-dot" />
                </span>
              </span>
              <span className="veg-label-group">
                <Leaf size={15} className="veg-leaf-icon" />
                <span className="veg-label-text">{t("Veg only")}</span>
              </span>
              <span className={`veg-switch-pill ${veg ? "is-active" : ""}`} aria-hidden="true">
                <span className="veg-switch-slider" />
              </span>
            </button>
          </div>
          <div className="menu-tools">
            <div className="category-list" aria-label="Menu categories">
              {categories.map((c) => (
                <button className={category === c ? "chip selected" : "chip"} key={c} onClick={() => setCategory(c)}>
                  <CategoryIcon name={c} />
                  <span>{c}</span>
                </button>
              ))}
            </div>
            <label className="search">
              <Search size={17} />
              <input
                aria-label="Search dishes"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Find a dish")}
              />
            </label>
          </div>

          <div className="menu-sort">
            <label>
              {t("Sort by")}
              <select aria-label="Sort dishes" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="recommended">{t("Recommended")}</option>
                <option value="top-rated">{t("Top rated")}</option>
                <option value="price-low">{t("Price: low to high")}</option>
                <option value="price-high">{t("Price: high to low")}</option>
              </select>
            </label>
            <label>
              {t("Spice")}
              <select aria-label="Spice level" value={spice} onChange={(e) => setSpice(e.target.value)}>
                <option value="any">{t("Any")}</option>
                <option value="mild">{t("Mild")}</option>
                <option value="medium">{t("Medium")}</option>
                <option value="hot">{t("Hot")}</option>
              </select>
            </label>
            <button
              className="chip"
              disabled={!shown.some((d) => d.available)}
              onClick={() => {
                const pool = shown.filter((d) => d.available);
                if (pool.length) setSelected(pool[Math.floor(Math.random() * pool.length)]);
              }}
            >
              <Shuffle size={16} /> <span>{t("Surprise me")}</span>
            </button>
            <button
              className={onlySaved ? "chip selected" : "chip"}
              aria-pressed={onlySaved}
              onClick={() => setOnlySaved(!onlySaved)}
            >
              <Heart size={16} /> <span>{t("Favourites")}{saved.length ? ` (${saved.length})` : ""}</span>
            </button>
          </div>

          {allergenList.length > 0 && (
            <div className="allergen-filter" aria-label="Avoid allergens">
              <span>{t("Avoid:")}</span>
              {allergenList.map((a) => (
                <button
                  key={a}
                  className={avoid.includes(a) ? "chip selected" : "chip"}
                  aria-pressed={avoid.includes(a)}
                  onClick={() => setAvoid((x) => (x.includes(a) ? x.filter((y) => y !== a) : [...x, a]))}
                >
                  <span>{a}</span>
                </button>
              ))}
            </div>
          )}

          <div className="menu-results" aria-live="polite">
            <span>
              {shown.length} {shown.length === 1 ? "dish" : "dishes"} to discover
            </span>
            <span>{t("Prices in ₹")}</span>
          </div>

          <div className="dishes">
            {shown.map((d) => {
              const ratingInfo = dishRatings[d.id];
              const qty = cart.find((i) => i.id === d.id)?.quantity || 0;
              const isSaved = saved.includes(d.id);
              return (
                <article key={d.id} className={`dish ${!d.available ? "sold-out" : ""}`}>
                  <div className="dish-body">
                    {d.image && <img className="dish-photo" src={d.image} alt={d.name} loading="lazy" />}
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                      {popular.includes(d.id) && (
                        <span className="popular-tag">
                          <Flame size={11} /> {t("Popular")}
                        </span>
                      )}
                      <span className={d.veg ? "diet veg" : "diet"}>
                        {d.veg ? <Leaf size={12} /> : <Flame size={12} />} {t(d.veg ? "VEG" : "NON-VEG")}{" "}
                        <span>· {d.category}</span>
                      </span>
                      {ratingInfo && ratingInfo.ratingCount >= 3 && ratingInfo.averageRating >= 4.5 && (
                        <span className="guest-fav">
                          <Sparkles size={11} /> {t("Guest favourite")}
                        </span>
                      )}
                      {ratingInfo && ratingInfo.ratingCount > 0 ? (
                        <span className="dish-rating-badge">
                          ★ {ratingInfo.averageRating.toFixed(1)} <small>({ratingInfo.ratingCount})</small>
                        </span>
                      ) : (
                        <span className="dish-rating-badge muted">{t("Not rated yet")}</span>
                      )}
                    </div>
                    <button
                      className={`favourite-button ${isSaved ? "is-saved" : ""}`}
                      aria-label={`${isSaved ? "Remove" : "Save"} ${d.name} ${isSaved ? "from" : "to"} favourites`}
                      aria-pressed={isSaved}
                      onClick={() => toggleSaved(d.id)}
                    >
                      <Heart size={18} />
                    </button>
                    <h3>{d.name}</h3>
                    <p>{d.description}</p>
                    <div className="dish-tags">
                      <span>{d.spice} spice</span>
                      <button aria-label={`View ${d.name}`} onClick={() => setSelected(d)}>
                        {t("Dish details")} <ArrowUpRight size={13} />
                      </button>
                    </div>
                    <div className="dish-bottom">
                      <strong>₹{d.price}</strong>
                      {!d.available ? (
                        <span className="unavailable-label">{t("Sold out")}</span>
                      ) : qty > 0 ? (
                        <div className="dish-quantity">
                          <button aria-label={`Remove one ${d.name}`} onClick={() => removeFromCart(d.id)}>
                            <Minus size={16} />
                          </button>
                          <span aria-live="polite">{qty}</span>
                          <button aria-label={`Add one ${d.name}`} onClick={() => addToCart(d.id)}>
                            <Plus size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="add-dish"
                          onClick={() => {
                            justAdded.current = { id: d.id, at: Date.now() };
                            addToCart(d.id);
                          }}
                          aria-label={`Add ${d.name} to cart`}
                        >
                          {t("Add to order")} <Plus size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {!shown.length && (
            <div className="empty">
              {regular.length
                ? "No dishes match. Try another category or search."
                : "The chef is preparing this menu. Please check back soon."}
            </div>
          )}

          {(query || veg || onlySaved || spice !== "any" || avoid.length > 0 || category !== "All dishes") && (
            <button
              className="reset-menu"
              onClick={() => {
                setQuery("");
                setVeg(false);
                setOnlySaved(false);
                setSpice("any");
                setAvoid([]);
                setCategory("All dishes");
              }}
            >
              {t("Clear filters")}
            </button>
          )}
        </section>

        <section className="customer-review-invite">
          <div>
            <h2>{t("How did we do?")}</h2>
            <p>Send your thoughts directly to {menu.name}.</p>
          </div>
          <a className="primary" href={"/r/" + encodeURIComponent(restaurant) + "/review"}>
            {t("Leave a review")}
          </a>
        </section>

        <p className="menu-note">{menu.note}</p>

        {saved.length > 0 && (
          <div className="shortlist">
            <strong>Your favourites · {saved.length}</strong>
            <span>
              {menu.dishes
                .filter((d) => saved.includes(d.id))
                .map((d) => d.name)
                .join(" · ")}
            </span>
            <small>Show your choices to your server. This is not an order.</small>
            <button onClick={() => setSaved([])}>Clear list</button>
          </div>
        )}

        <section className="table-service" id="table-service">
          <h2>{t("Need something at your table?")}</h2>
          <div className="table-service-row">
            <input
              aria-label={t("Table number")}
              value={svcTable}
              maxLength={30}
              onChange={(e) => setSvcTable(e.target.value)}
              placeholder={t("Table number")}
            />
            <button className="secondary" onClick={() => requestService("waiter")}>
              <BellRing size={16} /> {t("Call waiter")}
            </button>
            <button className="secondary" onClick={() => requestService("bill")}>
              <Receipt size={16} /> {t("Ask for the bill")}
            </button>
          </div>
          {svcMsg && (
            <p className="muted" role="status">
              {svcMsg}
            </p>
          )}
        </section>

        <footer>
          <span>
            Good food. Better moments.
            <br />
            Curated by {menu.name}
          </span>
          <span>TABLE SECRET / AS 426 STUDIOS</span>
          <a href="https://www.sahib-nyc.com/" target="_blank" rel="noreferrer">
            Illustrative photo: Sahib
          </a>
        </footer>
      </main>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="dish-modal">
          {selected?.image && <img className="dish-photo-large" src={selected.image} alt={selected.name} />}
          <DialogTitle>{selected?.name}</DialogTitle>
          <DialogDescription>{selected?.description}</DialogDescription>

          {/* Dish Rating in Modal */}
          {selected && dishRatings[selected.id] && dishRatings[selected.id].ratingCount > 0 ? (
            <p style={{ margin: "4px 0 10px 0", fontSize: "0.88rem", color: "#b45309", fontWeight: 600 }}>
              ★ {dishRatings[selected.id].averageRating.toFixed(1)} ({dishRatings[selected.id].ratingCount} guest{" "}
              {dishRatings[selected.id].ratingCount === 1 ? "rating" : "ratings"})
            </p>
          ) : (
            <p className="muted" style={{ margin: "4px 0 10px 0", fontSize: "0.82rem" }}>
              Not rated yet
            </p>
          )}

          <p className="modal-price">₹{selected?.price}</p>
          <p>Allergens: {selected?.allergens || "Please check with your server."}</p>
          <p className="muted">Add this dish to your cart, then review and send your order.</p>

          <button
            className="primary"
            disabled={!selected?.available}
            onClick={() => {
              if (selected) addToCart(selected.id);
              setSelected(null);
            }}
          >
            <Plus size={16} />
            {t("Add to cart")}
          </button>
          <button
            className="secondary"
            onClick={() => {
              if (selected) setSaved((s) => (s.includes(selected.id) ? s : [...s, selected.id]));
              setSelected(null);
            }}
          >
            <Heart size={16} />
            {t("Save to my favourites")}
          </button>
        </DialogContent>
      </Dialog>

      {toast && (
        <div className="ts-toast" role="status">
          {toast}
        </div>
      )}
      {showTop && (
        <button className="back-to-top" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <ArrowUp size={18} />
        </button>
      )}

      <Cart restaurant={restaurant} menu={menu} items={cart} onChange={setCart} onRefresh={load} avoid={avoid} />
    </div>
  );
}
