import React, { useEffect, useState } from "react";
import { tileFor } from "../lib/foodVisual.js";
import { titleFor, cachedPhoto, fetchPhoto } from "../lib/photos.js";
import { Photo } from "./Photo.jsx";

/**
 * The gradient tile renders immediately and unconditionally. If this food maps
 * to a Wikipedia article, the photo fades in on top once it resolves — and if
 * the device is offline, or the request fails, nothing visible happens.
 */
export default function FoodAvatar({ food, size = "", photos = true }) {
  const tile = tileFor(food);
  const title = photos ? titleFor(food) : null;
  const direct = food.photo || null;
  const [src, setSrc] = useState(() => direct || (title ? cachedPhoto(title) : null));
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (direct || !title || src) return;
    let alive = true;
    fetchPhoto(title).then(url => {
      if (alive && url) setSrc(url);
    });
    return () => { alive = false; };
  }, [title, direct, src]);

  return (
    <span className={"fav " + size} style={{ background: tile.background }} aria-hidden="true">
      {src && (
        <img
          src={src} alt="" loading="lazy" decoding="async"
          className={loaded ? "on" : ""}
          onLoad={() => setLoaded(true)}
          onError={() => setSrc(null)}
        />
      )}
      <span className="fav-g" style={loaded ? { opacity: 0 } : undefined}>{tile.glyph}</span>
    </span>
  );
}

/**
 * A meal shows the photo the user took of it. Failing that it borrows the
 * imagery of its first ingredient, so every saved meal has a face either way.
 */
export function MealAvatar({ meal, foodById, size = "" }) {
  if (meal.photo) {
    return (
      <span className={"fav " + size} style={{ background: "var(--surface-high)" }} aria-hidden="true">
        <Photo
          id={meal.photo} alt=""
          className="photo-user"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 1 }}
          fallback={<span className="fav-g">🍽️</span>}
        />
      </span>
    );
  }
  const first = meal.items?.map(i => foodById[i.foodId]).find(Boolean);
  if (!first) {
    return (
      <span className={"fav " + size} style={{ background: "linear-gradient(140deg,#365314,#84cc16)" }} aria-hidden="true">
        <span className="fav-g">🍽️</span>
      </span>
    );
  }
  return <FoodAvatar food={first} size={size} />;
}
