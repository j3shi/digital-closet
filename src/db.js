import {
  collection,
  addDoc,
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

// ─── Outfits (saved as image snapshots) ──────────────────────────────────────

export async function addOutfitImage(uid, { name, imageBase64 }) {
  await addDoc(collection(db, "users", uid, "outfits"), {
    name, imageBase64, createdAt: Date.now(),
  });
}

export async function deleteOutfit(uid, outfitId) {
  await deleteDoc(doc(db, "users", uid, "outfits", outfitId));
}

export function subscribeOutfits(uid, callback) {
  const q = query(collection(db, "users", uid, "outfits"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}