import { useState, useRef, useCallback, useEffect } from "react";
import { saveOutfit, updateOutfit } from "./db";

const CANVAS_W = 360;
const CANVAS_H = 480;

const S = {
  root: { display: "flex", flexDirection: "column" },
  canvasWrap: {
    position: "relative", width: "100%", paddingBottom: `${(CANVAS_H / CANVAS_W) * 100}%`,
    background: "#f5f5f0", borderRadius: 16, overflow: "hidden",
    touchAction: "none", userSelect: "none",
  },
  canvasInner: { position: "absolute", inset: 0 },
  canvasEmpty: {
    position: "absolute", inset: 0, display: "flex",
    alignItems: "center", justifyContent: "center",
    flexDirection: "column", gap: 8, pointerEvents: "none",
  },
  canvasEmptyIcon: { fontSize: 40, opacity: 0.2 },
  canvasEmptyText: { color: "#aaa", fontSize: 13 },
  item: (x, y, w, h, zIndex, selected) => ({
    position: "absolute",
    left: `${x}%`, top: `${y}%`,
    width: `${w}%`, height: `${h}%`,
    zIndex, cursor: "grab",
    outline: selected ? "2px solid #d4a0a0" : "none",
    outlineOffset: 2, borderRadius: 4, boxSizing: "border-box",
  }),
  itemImg: { width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" },
  resizeHandle: {
    position: "absolute", bottom: -6, right: -6, width: 16, height: 16,
    borderRadius: "50%", background: "#d4a0a0", cursor: "se-resize",
    border: "2px solid #fff", zIndex: 1,
  },
  deleteHandle: {
    position: "absolute", top: -8, right: -8, width: 20, height: 20,
    borderRadius: "50%", background: "#e07070", border: "none",
    cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 700,
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1,
  },
  toolbar: { display: "flex", gap: 8, padding: "10px 0", alignItems: "center", flexWrap: "wrap" },
  btnIcon: (disabled) => ({
    padding: "7px 12px", borderRadius: 8, background: "#2e2e36",
    color: disabled ? "#555" : "#f0ece4", border: "1px solid #3a3a44",
    fontSize: 12, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1,
  }),
  btnSave: (disabled) => ({
    marginLeft: "auto", padding: "8px 18px", borderRadius: 8,
    background: disabled ? "#8a6060" : "#d4a0a0", color: "#1a1a1e",
    border: "none", fontWeight: 600, fontSize: 13,
    cursor: disabled ? "default" : "pointer",
  }),
  tray: { overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 },
  trayInner: { display: "flex", gap: 10, paddingBottom: 4, width: "max-content" },
  trayItem: {
    width: 64, height: 80, borderRadius: 10, overflow: "hidden",
    background: "#2e2e36", cursor: "pointer", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  trayImg: { width: "100%", height: "100%", objectFit: "contain" },
  trayLabel: { fontSize: 10, color: "#666", textAlign: "center", marginTop: 3, maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  savingOverlay: {
    position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: 16, zIndex: 100,
  },
  spinner: { width: 28, height: 28, border: "3px solid #3a3a44", borderTop: "3px solid #d4a0a0", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  toast: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#2e2e36", color: "#f0ece4", padding: "10px 20px", borderRadius: 20, fontSize: 13, zIndex: 300, whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" },
  sectionLabel: { fontSize: 12, color: "#555", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8, marginTop: 12 },
  nameInput: { background: "none", border: "none", borderBottom: "1px solid #3a3a44", color: "#f0ece4", fontSize: 15, fontWeight: 600, outline: "none", padding: "2px 0", width: 180 },
};

// Generate a small thumbnail from canvas items
async function generateThumbnail(items, clothes) {
  const W = 200, H = Math.round(200 * CANVAS_H / CANVAS_W);
  const off = document.createElement("canvas");
  off.width = W; off.height = H;
  const ctx = off.getContext("2d");
  ctx.fillStyle = "#f5f5f0";
  ctx.fillRect(0, 0, W, H);
  const sorted = [...items].sort((a, b) => a.zIndex - b.zIndex);
  await Promise.all(sorted.map(item => new Promise(resolve => {
    const cloth = clothes.find(c => c.id === item.clothId);
    if (!cloth) return resolve();
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img,
        (item.x / 100) * W, (item.y / 100) * H,
        (item.w / 100) * W, (item.h / 100) * H
      );
      resolve();
    };
    img.onerror = resolve;
    img.src = cloth.imageBase64;
  })));
  return off.toDataURL("image/jpeg", 0.6);
}

export default function BuildTab({ uid, clothes, initialOutfit, onOutfitSaved, onClose }) {
  const isEditing = !!initialOutfit;

  const [items, setItems] = useState(() => {
    if (!initialOutfit) return [];
    return initialOutfit.items.map(item => {
      const cloth = clothes.find(c => c.id === item.clothId);
      return cloth ? { ...item, imageBase64: cloth.imageBase64, name: cloth.name } : null;
    }).filter(Boolean);
  });
  const [outfitName, setOutfitName] = useState(initialOutfit?.name || `Outfit ${new Date().toLocaleDateString("fi-FI")}`);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const canvasRef = useRef();
  const nextZ = useRef(items.length ? Math.max(...items.map(i => i.zIndex)) + 1 : 1);
  const dragRef = useRef({ active: false, didMove: false, type: null, itemId: null, startX: 0, startY: 0, origX: 0, origY: 0, origW: 0, origH: 0 });

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const addToCanvas = (cloth) => {
    const id = `${cloth.id}_${Date.now()}`;
    setItems(prev => [...prev, {
      id, clothId: cloth.id,
      imageBase64: cloth.imageBase64,
      name: cloth.name,
      x: 5 + (prev.length % 5) * 4,
      y: 5 + (prev.length % 5) * 4,
      w: 30, h: 30,
      zIndex: ++nextZ.current,
    }]);
    setSelected(id);
  };

  const removeItem = (e, id) => { e.stopPropagation(); setItems(prev => prev.filter(i => i.id !== id)); setSelected(null); };
  const bringForward = () => { if (!selected) return; setItems(prev => prev.map(i => i.id === selected ? { ...i, zIndex: ++nextZ.current } : i)); };
  const sendBack = () => {
    if (!selected) return;
    const minZ = Math.min(...items.map(i => i.zIndex));
    setItems(prev => prev.map(i => i.id === selected ? { ...i, zIndex: minZ - 1 } : i));
  };

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: ((src.clientX - rect.left) / rect.width) * 100, y: ((src.clientY - rect.top) / rect.height) * 100 };
  };

  const onItemDown = (e, id, type) => {
    e.stopPropagation(); e.preventDefault();
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      const pos = getPos(e);
      dragRef.current = { active: true, didMove: false, type, itemId: id, startX: pos.x, startY: pos.y, origX: item.x, origY: item.y, origW: item.w, origH: item.h };
      return prev.map(i => i.id === id ? { ...i, zIndex: ++nextZ.current } : i);
    });
    setSelected(id);
  };

  const onCanvasClick = () => { if (dragRef.current.didMove) return; setSelected(null); };

  const onMove = useCallback((e) => {
    if (!dragRef.current.active) return;
    e.preventDefault();
    const pos = getPos(e);
    const dx = pos.x - dragRef.current.startX;
    const dy = pos.y - dragRef.current.startY;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) dragRef.current.didMove = true;
    const { type, itemId, origX, origY, origW, origH } = dragRef.current;
    setItems(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      if (type === "move") return { ...i, x: Math.max(0, Math.min(100 - i.w, origX + dx)), y: Math.max(0, Math.min(100 - i.h, origY + dy)) };
      return { ...i, w: Math.max(10, origW + dx), h: Math.max(12, origH + dy) };
    }));
  }, []);

  const onUp = useCallback(() => {
    setTimeout(() => { dragRef.current.active = false; dragRef.current.didMove = false; }, 50);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [onMove, onUp]);

  const handleSave = async () => {
    if (items.length === 0 || saving) return;
    setSaving(true);
    try {
      const layoutItems = items.map(({ id, clothId, x, y, w, h, zIndex }) => ({ id, clothId, x, y, w, h, zIndex }));
      const thumbnailBase64 = await generateThumbnail(items, clothes);
      if (isEditing) {
        await updateOutfit(uid, initialOutfit.id, { name: outfitName, items: layoutItems, thumbnailBase64 });
        showToast("Outfit updated ✓");
      } else {
        await saveOutfit(uid, { name: outfitName, items: layoutItems, thumbnailBase64 });
        showToast("Outfit saved ✓");
      }
      setTimeout(() => { onOutfitSaved(); }, 800);
    } catch (err) {
      console.error(err);
      showToast("Save failed — try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={S.root}>
      {/* Name row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <input
          style={S.nameInput}
          value={outfitName}
          onChange={(e) => setOutfitName(e.target.value)}
          placeholder="Outfit name"
        />
        {onClose && <button style={{ ...S.btnIcon(false), marginLeft: "auto" }} onClick={onClose}>✕ Close</button>}
      </div>

      {/* Canvas */}
      <div style={S.canvasWrap}>
        <div ref={canvasRef} style={S.canvasInner} onClick={onCanvasClick}>
          {items.length === 0 && (
            <div style={S.canvasEmpty}>
              <span style={S.canvasEmptyIcon}>👗</span>
              <span style={S.canvasEmptyText}>Tap items below to add</span>
            </div>
          )}
          {items.map(item => (
            <div
              key={item.id}
              style={S.item(item.x, item.y, item.w, item.h, item.zIndex, selected === item.id)}
              onMouseDown={(e) => onItemDown(e, item.id, "move")}
              onTouchStart={(e) => onItemDown(e, item.id, "move")}
              onClick={(e) => e.stopPropagation()}
            >
              <img src={item.imageBase64} alt={item.name} style={S.itemImg} />
              {selected === item.id && (
                <>
                  <div style={S.resizeHandle}
                    onMouseDown={(e) => { e.stopPropagation(); onItemDown(e, item.id, "resize"); }}
                    onTouchStart={(e) => { e.stopPropagation(); onItemDown(e, item.id, "resize"); }}
                  />
                  <button style={S.deleteHandle} onClick={(e) => removeItem(e, item.id)}>×</button>
                </>
              )}
            </div>
          ))}
          {saving && <div style={S.savingOverlay}><div style={S.spinner} /></div>}
        </div>
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <button style={S.btnIcon(!selected)} onClick={bringForward} disabled={!selected}>↑ Forward</button>
        <button style={S.btnIcon(!selected)} onClick={sendBack} disabled={!selected}>↓ Back</button>
        <button style={S.btnIcon(items.length === 0)} onClick={() => { setItems([]); setSelected(null); }} disabled={items.length === 0}>Clear</button>
        <button style={S.btnSave(items.length === 0 || saving)} onClick={handleSave} disabled={items.length === 0 || saving}>
          {isEditing ? "Update outfit" : "Save outfit"}
        </button>
      </div>

      {/* Tray */}
      <div style={S.sectionLabel}>Your clothes</div>
      {clothes.length === 0 ? (
        <div style={{ color: "#555", fontSize: 13 }}>Add clothes from the Closet tab first</div>
      ) : (
        <div style={S.tray}>
          <div style={S.trayInner}>
            {clothes.map(cloth => (
              <div key={cloth.id}>
                <div style={S.trayItem} onClick={() => addToCanvas(cloth)}>
                  <img src={cloth.imageBase64} alt={cloth.name} style={S.trayImg} />
                </div>
                <div style={S.trayLabel}>{cloth.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && <div style={S.toast}>{toast}</div>}
    </div>
  );
}