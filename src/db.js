import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";

// ─── Clothes ──────────────────────────────────────────────────────────────────

export async function addCloth(uid, { name, category, imageBase64 }) {
  await addDoc(collection(db, "users", uid, "clothes"), {
    name, category, imageBase64, createdAt: Date.now(),
  });
}

export async function deleteCloth(uid, clothId) {
  await deleteDoc(doc(db, "users", uid, "clothes", clothId));
}

export function subscribeClothes(uid, callback) {
  const q = query(collection(db, "users", uid, "clothes"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

// ─── Outfits ──────────────────────────────────────────────────────────────────
// Each outfit stores:
//   name, createdAt, thumbnailBase64 (small preview),
//   items: [{ id, clothId, x, y, w, h, zIndex }]

export async function saveOutfit(uid, { name, items, thumbnailBase64 }) {
  return await addDoc(collection(db, "users", uid, "outfits"), {
    name, items, thumbnailBase64, createdAt: Date.now(),
  });
}

export async function updateOutfit(uid, outfitId, { name, items, thumbnailBase64 }) {
  await updateDoc(doc(db, "users", uid, "outfits", outfitId), {
    name, items, thumbnailBase64,
  });
}

export async function deleteOutfit(uid, outfitId) {
  await deleteDoc(doc(db, "users", uid, "outfits", outfitId));
}

export function subscribeOutfits(uid, callback) {
  const q = query(collection(db, "users", uid, "outfits"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}