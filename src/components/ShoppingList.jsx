import React, { useMemo, useState } from "react";
import { X, ShoppingCart, Check, Share2, ChevronLeft, Info } from "lucide-react";
import { shoppingList, parseKey, addDays } from "../lib/store.js";

const shortDate = k => parseKey(k).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** Grams read badly past a kilo, and nobody buys 1400 g of anything. */
function amount(grams) {
  if (grams >= 1000) return `${(grams / 1000).toFixed(grams >= 10000 ? 0 : 1)} kg`;
  return `${Math.round(grams)} g`;
}

/**
 * What a planned stretch of days actually requires from a shop.
 *
 * Recipes are expanded to their ingredients, because you buy rice and chicken,
 * not "rice plate", and quantities are summed across the whole range so one line
 * reads "1.4 kg chicken breast" instead of seven lines of 200 g.
 */
export default function ShoppingList({ fromKey, onClose }) {
  const [days, setDays] = useState(7);
  const [ticked, setTicked] = useState(() => new Set());

  const list = useMemo(() => shoppingList(fromKey, days), [fromKey, days]);

  function toggle(id) {
    setTicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function asText() {
    const lines = [`Shopping list · ${shortDate(fromKey)} – ${shortDate(addDays(fromKey, days - 1))}`, ""];
    for (const group of list.categories) {
      lines.push(group.cat.toUpperCase());
      for (const item of group.items) lines.push(`  ${amount(item.grams)}  ${item.name}`);
      lines.push("");
    }
    return lines.join("\n");
  }

  async function share() {
    const text = asText();
    try {
      if (navigator.share) {
        await navigator.share({ title: "Shopping list", text });
        return;
      }
    } catch {
      /* dismissed */
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard blocked — nothing else to try */
    }
  }

  const total = list.categories.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grabber" />

        <div className="sheet-h">
          <button className="btn-ghost" onClick={onClose} aria-label="Back"><ChevronLeft size={22} /></button>
          <ShoppingCart size={20} style={{ color: "var(--accent-text)" }} />
          <h3 className="h4 grow" style={{ margin: 0 }}>Shopping list</h3>
        </div>

        <p className="note" style={{ marginBottom: 14 }}>
          Everything your plan needs from <b>{shortDate(fromKey)}</b> to{" "}
          <b>{shortDate(addDays(fromKey, days - 1))}</b>, with recipes broken down into ingredients.
        </p>

        <div className="chips" style={{ marginBottom: 18 }}>
          {[3, 5, 7, 14].map(d => (
            <button key={d} className="chip" aria-pressed={days === d} onClick={() => setDays(d)}>
              {d} days
            </button>
          ))}
        </div>

        {total === 0 ? (
          <div className="empty">
            <span className="empty-ico"><ShoppingCart size={24} /></span>
            Nothing planned in this range yet. Plan some meals and the list writes itself.
          </div>
        ) : (
          <>
            {list.categories.map(group => (
              <div key={group.cat} style={{ marginBottom: 18 }}>
                <div className="sect-h" style={{ marginBottom: 8 }}>
                  <h2 className="h4">{group.cat}</h2>
                  <span className="caps faint">{group.items.length}</span>
                </div>
                {group.items.map(item => {
                  const done = ticked.has(item.foodId);
                  return (
                    <button
                      className="checkrow" data-state={done ? "yes" : ""} key={item.foodId}
                      onClick={() => toggle(item.foodId)}
                      style={{ width: "100%", textAlign: "left" }}
                      aria-pressed={done}
                    >
                      <span className="tick"><Check size={17} strokeWidth={3} /></span>
                      <span className="grow" style={{ minWidth: 0 }}>
                        <span
                          style={{
                            display: "block", fontWeight: 600, fontSize: 15,
                            textDecoration: done ? "line-through" : "none",
                            opacity: done ? 0.6 : 1
                          }}
                        >
                          {item.name}
                        </span>
                      </span>
                      <span className="stat-sm tnum" style={{ flex: "0 0 auto" }}>{amount(item.grams)}</span>
                    </button>
                  );
                })}
              </div>
            ))}

            <button className="btn btn-secondary btn-wide" onClick={share}>
              <Share2 size={17} /> Share the list
            </button>
          </>
        )}

        <p className="note" style={{ marginTop: 14 }}>
          <Info size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
          Quantities are what the recipes call for — buy the packet size above them. Ticks are just
          for this shop and aren't saved.
        </p>
      </div>
    </div>
  );
}
