import React, { useEffect, useState } from "react";
import { Camera, ImagePlus, Trash2, Loader2 } from "lucide-react";
import { imageSrc, imageSrcSync, pickImage, saveImage, deleteImage, SIZES } from "../lib/images.js";

/**
 * Renders a stored photo by id, falling back to whatever the caller wants to
 * show while it resolves or when there is nothing there.
 */
export function Photo({ id, alt = "", className = "", style, fallback = null }) {
  const [src, setSrc] = useState(() => imageSrcSync(id));

  useEffect(() => {
    let alive = true;
    if (!id) { setSrc(null); return; }
    const known = imageSrcSync(id);
    if (known) { setSrc(known); return; }
    imageSrc(id).then(s => { if (alive) setSrc(s); });
    return () => { alive = false; };
  }, [id]);

  if (!src) return fallback;
  return <img src={src} alt={alt} className={className} style={style} loading="lazy" decoding="async" />;
}

/**
 * Add, replace or remove one photo. Handles the picker, the downscale, the write
 * and the cleanup of the photo it replaced — the caller only stores the id.
 */
export function PhotoPicker({
  id, onChange, size = "meal", label = "Add a photo",
  replaceLabel = "Change photo", shape = "square", disabled = false
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function choose() {
    setError("");
    setBusy(true);
    try {
      const dataUrl = await pickImage({ size: SIZES[size] || SIZES.meal });
      if (!dataUrl) { setBusy(false); return; }
      const saved = await saveImage(dataUrl);
      if (!saved) {
        setError("Couldn't save that photo — the device is out of space.");
        setBusy(false);
        return;
      }
      const previous = id;
      onChange(saved);
      if (previous && previous !== saved) deleteImage(previous);
    } catch {
      setError("Couldn't read that image. Try another one.");
    }
    setBusy(false);
  }

  function remove() {
    const previous = id;
    onChange(null);
    if (previous) deleteImage(previous);
  }

  return (
    <div>
      <div className="row" style={{ gap: 12 }}>
        <button
          type="button"
          className={`photo-slot ${shape}`}
          onClick={choose}
          disabled={disabled || busy}
          aria-label={id ? replaceLabel : label}
        >
          <Photo
            id={id} alt=""
            fallback={
              <span className="photo-empty">
                {busy ? <Loader2 size={22} className="spin" /> : <ImagePlus size={22} />}
              </span>
            }
          />
          {id && !busy && <span className="photo-edit"><Camera size={15} /></span>}
        </button>

        <div className="grow">
          <button type="button" className="btn btn-sm btn-quiet" onClick={choose} disabled={disabled || busy}>
            <Camera size={15} /> {busy ? "Opening…" : id ? replaceLabel : label}
          </button>
          {id && (
            <button
              type="button" className="btn btn-sm btn-ghost" style={{ marginLeft: 6 }}
              onClick={remove} disabled={busy}
            >
              <Trash2 size={15} /> Remove
            </button>
          )}
          <p className="dim" style={{ fontSize: 12, margin: "8px 0 0" }}>
            Stored on this phone only. Never uploaded.
          </p>
        </div>
      </div>
      {error && <p className="note danger" style={{ marginTop: 10 }}>{error}</p>}
    </div>
  );
}
