import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { AppNotification } from "../types";

export const createNotification = async (notif: Omit<AppNotification, "id" | "timestamp" | "read">) => {
  try {
    await addDoc(collection(db, "notifications"), {
      ...notif,
      read: false,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
};
