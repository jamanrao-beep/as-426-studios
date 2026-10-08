"use client";

import { useEffect, useState } from "react";
import { Utensils, LockKeyhole, Sparkles, Leaf, Flame, Plus, Check, Search, Star } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import PlacedOrders from "./placed-orders";
import Cart, { type CartItem } from "./cart";
import TableGames from "./table-games";
import TasteQuiz from "./taste-quiz";
import { Switch } from "@/components/ui/switch";
import type { Menu, Dish } from "@/lib/menu";

export default function MenuView({ restaurant = "ember-spice" }: { restaurant?: string }) {
  const [cart, setCart] = useState<CartItem[]>([]);
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
  const [dishRatings, setDishRatings] = useState<Record<string, { averageRating: number; ratingCount: number }>>({});

  async function load() {
    setError("");
    try {
      const r = await fetch(`/api/menu?restaurant=${encodeURIComponent(restaurant)}`);
      const d = (await r.json()) as any;
      if (!r.ok) throw Error(d.error);
      setMenu(d.menu);

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
      setError(e instanceof Error ? e.message : "Couldn’t load menu");
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
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
  const shown = regular.filter(
    (d) =>
      (category === "All dishes" || d.category === category) &&
      (!veg || d.veg) &&
      `${d.name} ${d.description}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="customer">
      <header className="brandbar">
        <span className="brand">
          <span className="brandmark">
            <Utensils size={20} />
          </span>
          TABLE SECRET
        </span>
        <span className="top-label">BY AS 426 STUDIOS</span>
      </header>
      <main>
        <section className="menu-heading">
          <div>
            <p className="eyebrow">
              {restaurant === "ember-spice" ? "SAMPLE RESTAURANT · EXPLORE THE EXPERIENCE" : "WELCOME TO YOUR TABLE"}
            </p>
            <h1>{menu.name}</h1>
            <p>{menu.tagline}</p>
          </div>
          <span className="menu-seal">
            Made to
            <br />
            <em>be discovered.</em>
          </span>
        </section>

        <PlacedOrders restaurant={restaurant} />

        {secrets.length > 0 && (
          <section className="secret-banner">
            <div className="secret-copy">
              <span className="pill">
                <Sparkles size={14} /> THE OFF-MENU EDIT
              </span>
              <h2>
                Your table has
                <br />
                a delicious secret.
              </h2>
              <p>A little something you won’t find on the regular menu.</p>
              <button className="primary" onClick={() => setUnlocked(!unlocked)}>
                <LockKeyhole size={17} />
                {unlocked ? "Hide the secret" : "Unlock the secret"}
              </button>
            </div>
            <div className="food-photo">
              <img src="/food.jpg" alt="Illustrative paneer tikka served on a black plate" />
              <span className="photo-caption">A taste of something unexpected</span>
            </div>
          </section>
        )}

        {unlocked && (
          <section className="secret-reveal" aria-live="polite">
            <span className="eyebrow">YOU’RE IN ON THE SECRET</span>
            {secrets.map((d) => (
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
            ))}
          </section>
        )}

        <TasteQuiz menu={menu} onPick={setSelected} />
        <TableGames />

        <section className="menu-section">
          <div className="section-top">
            <h2>Find your next favourite</h2>
            <label className="switch-label">
              <Leaf size={16} /> Veg only
              <Switch aria-label="Vegetarian dishes only" checked={veg} onCheckedChange={setVeg} />
            </label>
          </div>
          <div className="menu-tools">
            <div className="category-list" aria-label="Menu categories">
              {categories.map((c) => (
                <button
                  className={category === c ? "chip selected" : "chip"}
                  key={c}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <label className="search">
              <Search size={17} />
              <input
                aria-label="Search dishes"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a dish"
              />
            </label>
          </div>

          <div className="dishes">
            {shown.map((d, i) => {
              const ratingInfo = dishRatings[d.id];
              return (
                <article key={d.id} className={`dish ${!d.available ? "sold-out" : ""}`}>
                  <div className="dish-number">{String(i + 1).padStart(2, "0")}</div>
                  <div className="dish-body">
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                      <span className={d.veg ? "diet veg" : "diet"}>
                        {d.veg ? <Leaf size={12} /> : <Flame size={12} />} {d.veg ? "VEG" : "NON-VEG"}{" "}
                        <span>· {d.category}</span>
                      </span>

                      {/* Customer Dish Star Rating Badge */}
                      {ratingInfo && ratingInfo.ratingCount > 0 ? (
                        <span className="dish-rating-badge">
                          ★ {ratingInfo.averageRating.toFixed(1)} <small>({ratingInfo.ratingCount})</small>
                        </span>
                      ) : (
                        <span className="dish-rating-badge muted">Not rated yet</span>
                      )}
                    </div>

                    <h3>{d.name}</h3>
                    <p>{d.description}</p>
                    <div className="dish-bottom">
                      <strong>₹{d.price}</strong>
                      <button
                        disabled={!d.available}
                        onClick={() => addToCart(d.id)}
                        aria-label={`Add ${d.name} to cart`}
                      >
                        Add{" "}
                        {cart.find((item) => item.id === d.id)?.quantity
                          ? `(${cart.find((item) => item.id === d.id)?.quantity})`
                          : ""}
                        <Plus size={16} />
                      </button>
                      <button
                        disabled={!d.available}
                        aria-label={`View ${d.name}`}
                        onClick={() => setSelected(d)}
                      >
                        {!d.available ? (
                          "Sold out"
                        ) : saved.includes(d.id) ? (
                          <>
                            <Check size={16} /> On your list
                          </>
                        ) : (
                          <>
                            Take a look <Plus size={16} />
                          </>
                        )}
                      </button>
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
        </section>

        <section className="customer-review-invite">
          <div>
            <h2>How did we do?</h2>
            <p>Send your thoughts directly to {menu.name}.</p>
          </div>
          <a className="primary" href={"/r/" + encodeURIComponent(restaurant) + "/review"}>
            Leave a review
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

        <footer>
          <span>Curated by {menu.name}</span>
          <span>TABLE SECRET / AS 426 STUDIOS</span>
          <a href="https://www.sahib-nyc.com/" target="_blank" rel="noreferrer">
            Illustrative photo: Sahib
          </a>
        </footer>
      </main>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="dish-modal">
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
            Add to cart
          </button>
          <button
            className="secondary"
            onClick={() => {
              if (selected) setSaved((s) => (s.includes(selected.id) ? s : [...s, selected.id]));
              setSelected(null);
            }}
          >
            <Plus size={16} />
            Save to my favourites
          </button>
        </DialogContent>
      </Dialog>

      <Cart restaurant={restaurant} menu={menu} items={cart} onChange={setCart} onRefresh={load} />
    </div>
  );
}
