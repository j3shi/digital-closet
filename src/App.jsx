import { useState, useRef, useEffect, useCallback } from "react";
import { initAuth } from "./firebase";
import { addCloth, deleteCloth, subscribeClothes, subscribeOutfits, deleteOutfit } from "./db";
import { removeBg } from "./bgRemoval";
import BuildTab from "./BuildTab";

const CATEGORIES = ["Tops", "Bottoms", "Outerwear", "Shoes", "Accessories", "Dresses"];

function compressToBase64(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const MAX = 800;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
        else { width = Math.round((width * MAX) / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png", 0.7));
    };
    img.onerror = reject;
    img.src = url;
  });
}

const S = {
  app: { minHeight: "100vh", background: "#1a1a1e", color: "#f0ece4", fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 80 },
  header: { padding: "20px 20px 0", borderBottom: "1px solid #2e2e36", position: "sticky", top: 0, background: "#1a1a1e", zIndex: 100 },
  headerTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  logo: { fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px", color: "#f0ece4" },
  logoAccent: { color: "#d4a0a0" },
  tabs: { display: "flex" },
  tab: (active) => ({ padding: "10px 18px", background: "none", border: "none", borderBottom: active ? "2px solid #d4a0a0" : "2px solid transparent", color: active ? "#d4a0a0" : "#888", fontWeight: active ? 600 : 400, fontSize: 14, cursor: "pointer", transition: "all 0.15s" }),
  body: { padding: "20px 16px", maxWidth: 480, margin: "0 auto" },
  uploadZone: (drag) => ({ border: `2px dashed ${drag ? "#d4a0a0" : "#3a3a44"}`, borderRadius: 16, padding: "32px 20px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", background: drag ? "#2a2228" : "transparent", marginBottom: 24 }),
  uploadIcon: { fontSize: 36, marginBottom: 8, display: "block" },
  uploadText: { color: "#888", fontSize: 14 },
  uploadHint: { color: "#555", fontSize: 12, marginTop: 4 },
  pillRow: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 16, scrollbarWidth: "none" },
  pill: (active) => ({ padding: "6px 14px", borderRadius: 20, border: `1px solid ${active ? "#d4a0a0" : "#3a3a44"}`, background: active ? "#2a1e1e" : "transparent", color: active ? "#d4a0a0" : "#888", fontSize: 13, whiteSpace: "nowrap", cursor: "pointer", transition: "all 0.15s", flexShrink: 0 }),
  clothesGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 },
  clothCard: { position: "relative", borderRadius: 12, overflow: "hidden", aspectRatio: "3/4", cursor: "pointer", border: "2px solid transparent", background: "#2e2e36" },
  clothImg: { width: "100%", height: "100%", objectFit: "contain", display: "block" },
  clothLabel: { position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 6px 6px", background: "linear-gradient(transparent, rgba(0,0,0,0.75))", fontSize: 11, color: "#f0ece4", textAlign: "center" },
  deleteBtn: { position: "absolute", top: 6, left: 6, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#aaa", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  outfitActions: { display: "flex", gap: 10, marginTop: 14 },
  btnPrimary: { flex: 1, padding: "12px 0", borderRadius: 10, background: "#d4a0a0", color: "#1a1a1e", border: "none", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  btnSecondary: { flex: 1, padding: "12px 0", borderRadius: 10, background: "#2e2e36", color: "#f0ece4", border: "none", fontSize: 14, cursor: "pointer" },

  // Outfits grid
  outfitsGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 },
  outfitCard: { background: "#22222a", borderRadius: 14, overflow: "hidden", cursor: "pointer", position: "relative" },
  outfitThumb: { width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block", background: "#2e2e36" },
  outfitCardFooter: { padding: "8px 10px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  outfitCardName: { fontWeight: 600, fontSize: 13, color: "#f0ece4" },
  outfitCardDate: { color: "#555", fontSize: 11 },
  outfitDeleteBtn: { background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 15, padding: "2px 4px" },

  // Full screen modal
  modalFull: { position: "fixed", inset: 0, background: "#1a1a1e", zIndex: 200, overflowY: "auto", padding: "16px 16px 40px" },

  // Add cloth modal
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "flex-end" },
  modal: { background: "#22222a", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "85vh", padding: 24, overflowY: "auto" },
  modalTitle: { fontSize: 17, fontWeight: 600, marginBottom: 18 },
  label: { display: "block", fontSize: 13, color: "#888", marginBottom: 6, marginTop: 14 },
  input: { width: "100%", background: "#2e2e36", border: "1px solid #3a3a44", borderRadius: 10, padding: "10px 12px", color: "#f0ece4", fontSize: 14, boxSizing: "border-box", outline: "none" },
  catGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 6 },
  catBtn: (active) => ({ padding: "10px 4px", borderRadius: 10, border: `1px solid ${active ? "#d4a0a0" : "#3a3a44"}`, background: active ? "#2a1e1e" : "#2e2e36", color: active ? "#d4a0a0" : "#888", fontSize: 13, cursor: "pointer", textAlign: "center" }),
  previewWrap: { width: "100%", background: "#2e2e36", borderRadius: 12, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, overflow: "hidden" },
  previewImg: { maxWidth: "100%", maxHeight: 240, objectFit: "contain", borderRadius: 12 },
  processingOverlay: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  progressBar: { width: "100%", height: 4, background: "#3a3a44", borderRadius: 2, overflow: "hidden", marginTop: 4 },
  progressFill: (pct) => ({ height: "100%", width: `${pct}%`, background: "#d4a0a0", transition: "width 0.3s" }),
  spinner: { width: 28, height: 28, border: "3px solid #3a3a44", borderTop: "3px solid #d4a0a0", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  emptyState: { textAlign: "center", padding: "48px 20px", color: "#555" },
  emptyIcon: { fontSize: 48, marginBottom: 12, display: "block", opacity: 0.4 },
  emptyText: { fontSize: 14, marginBottom: 4 },
  emptyHint: { fontSize: 13, color: "#444" },
  loadingScreen: { minHeight: "100vh", background: "#1a1a1e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 },
  toast: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#2e2e36", color: "#f0ece4", padding: "10px 20px", borderRadius: 20, fontSize: 13, zIndex: 300, whiteSpace: "nowrap", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" },
};

function Toast({ message }) { return <div style={S.toast}>{message}</div>; }

function AddClothModal({ previewUrl, processing, progress, onSave, onClose }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  return (
    <div style={S.overlay} onClick={!processing ? onClose : undefined}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalTitle}>Add to Closet</div>
        <div style={S.previewWrap}>
          {processing ? (
            <div style={S.processingOverlay}>
              <div style={S.spinner} />
              <div style={{ color: "#888", fontSize: 13 }}>Removing background…</div>
              <div style={S.progressBar}><div style={S.progressFill(progress)} /></div>
              <div style={{ color: "#555", fontSize: 12 }}>{progress}%</div>
            </div>
          ) : previewUrl ? <img src={previewUrl} alt="preview" style={S.previewImg} /> : null}
        </div>
        {!processing && (
          <>
            <label style={S.label}>Name (optional)</label>
            <input style={S.input} placeholder="e.g. White linen shirt" value={name} onChange={(e) => setName(e.target.value)} />
            <label style={S.label}>Category</label>
            <div style={S.catGrid}>
              {CATEGORIES.map((c) => <button key={c} style={S.catBtn(category === c)} onClick={() => setCategory(c)}>{c}</button>)}
            </div>
            <div style={{ ...S.outfitActions, marginTop: 24 }}>
              <button style={S.btnSecondary} onClick={onClose}>Cancel</button>
              <button style={S.btnPrimary} onClick={() => onSave({ name: name.trim() || category, category })}>Save</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ClosetTab({ uid, clothes, onDelete }) {
  const [activeFilter, setActiveFilter] = useState("All");
  const [drag, setDrag] = useState(false);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const fileRef = useRef();

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const originalUrl = URL.createObjectURL(file);
    setModal({ blob: file, previewUrl: originalUrl, processing: true, progress: 0 });
    try {
      const resultBlob = await removeBg(file, (pct) => setModal((m) => m ? { ...m, progress: pct } : m));
      setModal({ blob: resultBlob, previewUrl: URL.createObjectURL(resultBlob), processing: false, progress: 100 });
    } catch {
      setModal({ blob: file, previewUrl: originalUrl, processing: false, progress: 100 });
      showToast("BG removal failed — using original");
    }
  };

  const handleSave = async ({ name, category }) => {
    if (!modal?.blob || saving) return;
    setSaving(true);
    try {
      const imageBase64 = await compressToBase64(modal.blob);
      await addCloth(uid, { name, category, imageBase64 });
      setModal(null);
      showToast("Item added ✓");
    } catch { showToast("Failed to save — try again"); }
    finally { setSaving(false); }
  };

  const filtered = activeFilter === "All" ? clothes : clothes.filter((c) => c.category === activeFilter);

  return (
    <div>
      <div style={S.uploadZone(drag)} onClick={() => fileRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}>
        <span style={S.uploadIcon}>📷</span>
        <div style={S.uploadText}>Tap to add a clothing item</div>
        <div style={S.uploadHint}>Background will be removed automatically</div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
      </div>
      <div style={S.pillRow}>
        {["All", ...CATEGORIES].map((cat) => <button key={cat} style={S.pill(activeFilter === cat)} onClick={() => setActiveFilter(cat)}>{cat}</button>)}
      </div>
      {filtered.length === 0 ? (
        <div style={S.emptyState}><span style={S.emptyIcon}>👗</span><div style={S.emptyText}>Nothing here yet</div><div style={S.emptyHint}>Add your first item above</div></div>
      ) : (
        <div style={S.clothesGrid}>
          {filtered.map((item) => (
            <div key={item.id} style={S.clothCard}>
              <img src={item.imageBase64} alt={item.name} style={S.clothImg} />
              <div style={S.clothLabel}>{item.name}</div>
              <button style={S.deleteBtn} onClick={() => onDelete(item.id)}>×</button>
            </div>
          ))}
        </div>
      )}
      {modal && <AddClothModal previewUrl={modal.previewUrl} processing={modal.processing} progress={modal.progress} onSave={handleSave} onClose={() => !modal.processing && !saving && setModal(null)} />}
      {toast && <Toast message={toast} />}
    </div>
  );
}

function OutfitsTab({ uid, outfits, clothes, onEdit, onDelete }) {
  if (outfits.length === 0) {
    return <div style={S.emptyState}><span style={S.emptyIcon}>✨</span><div style={S.emptyText}>No saved outfits yet</div><div style={S.emptyHint}>Build one from the Build tab</div></div>;
  }
  return (
    <div style={S.outfitsGrid}>
      {outfits.map((outfit) => (
        <div key={outfit.id} style={S.outfitCard} onClick={() => onEdit(outfit)}>
          {outfit.thumbnailBase64
            ? <img src={outfit.thumbnailBase64} alt={outfit.name} style={S.outfitThumb} />
            : <div style={{ ...S.outfitThumb, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 32, opacity: 0.2 }}>👗</span></div>
          }
          <div style={S.outfitCardFooter}>
            <div>
              <div style={S.outfitCardName}>{outfit.name}</div>
              <div style={S.outfitCardDate}>{new Date(outfit.createdAt).toLocaleDateString("fi-FI")}</div>
            </div>
            <button style={S.outfitDeleteBtn} onClick={(e) => { e.stopPropagation(); onDelete(outfit.id); }}>🗑</button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [uid, setUid] = useState(null);
  const [tab, setTab] = useState("closet");
  const [clothes, setClothes] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [editingOutfit, setEditingOutfit] = useState(null); // null | outfit object | "new"

  useEffect(() => { initAuth((user) => setUid(user.uid)); }, []);

  useEffect(() => {
    if (!uid) return;
    const unsubC = subscribeClothes(uid, setClothes);
    const unsubO = subscribeOutfits(uid, setOutfits);
    return () => { unsubC(); unsubO(); };
  }, [uid]);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; }`;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const handleDeleteCloth = useCallback(async (id) => { if (uid) await deleteCloth(uid, id); }, [uid]);
  const handleDeleteOutfit = useCallback(async (id) => { if (uid) await deleteOutfit(uid, id); }, [uid]);

  if (!uid) {
    return <div style={S.loadingScreen}><div style={S.spinner} /><div style={{ color: "#555", fontSize: 14 }}>Loading your closet…</div></div>;
  }

  // Full screen canvas modal (new or edit)
  if (editingOutfit !== null) {
    return (
      <div style={S.modalFull}>
        <BuildTab
          uid={uid}
          clothes={clothes}
          initialOutfit={editingOutfit === "new" ? null : editingOutfit}
          onOutfitSaved={() => { setEditingOutfit(null); setTab("outfits"); }}
          onClose={() => setEditingOutfit(null)}
        />
      </div>
    );
  }

  return (
    <div style={S.app}>
      <div style={S.header}>
        <div style={S.headerTop}>
          <div style={S.logo}>digital<span style={S.logoAccent}>closet</span></div>
          <div style={{ fontSize: 13, color: "#555" }}>{clothes.length} item{clothes.length !== 1 ? "s" : ""}</div>
        </div>
        <div style={S.tabs}>
          {[
            { id: "closet", label: "Closet" },
            { id: "build", label: "Build" },
            { id: "outfits", label: `Outfits${outfits.length ? ` (${outfits.length})` : ""}` },
          ].map(({ id, label }) => <button key={id} style={S.tab(tab === id)} onClick={() => setTab(id)}>{label}</button>)}
        </div>
      </div>
      <div style={S.body}>
        {tab === "closet" && <ClosetTab uid={uid} clothes={clothes} onDelete={handleDeleteCloth} />}
        {tab === "build" && (
          <BuildTab
            uid={uid}
            clothes={clothes}
            initialOutfit={null}
            onOutfitSaved={() => setTab("outfits")}
            onClose={null}
          />
        )}
        {tab === "outfits" && (
          <>
            <button style={{ ...S.btnPrimary, marginBottom: 16 }} onClick={() => setEditingOutfit("new")}>
              + New outfit
            </button>
            <OutfitsTab
              uid={uid}
              outfits={outfits}
              clothes={clothes}
              onEdit={(outfit) => setEditingOutfit(outfit)}
              onDelete={handleDeleteOutfit}
            />
          </>
        )}
      </div>
    </div>
  );
}