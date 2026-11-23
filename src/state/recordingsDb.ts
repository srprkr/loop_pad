// The audio of recorded pad sounds, kept in IndexedDB (localStorage is too small for audio).
// Their names live with the rest of the saved state in localStorage (persistence.ts).
// Failures are logged and otherwise ignored: the app keeps working, the recording just won't
// survive a reload.

export interface RecordingAudio {
  samples: Float32Array; // mono
  sampleRate: number;
}

const DB_NAME = "loop-pad";
const STORE = "recordings";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveRecordingAudio(id: string, audio: RecordingAudio): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(audio, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn("Loop Pad: couldn't save the recording.", e);
  }
}

/** Every stored recording, by id. */
export async function loadRecordingAudio(): Promise<Map<string, RecordingAudio>> {
  const found = new Map<string, RecordingAudio>();
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const value = cursor.value as RecordingAudio;
        if (value?.samples instanceof Float32Array && value.sampleRate > 0) found.set(String(cursor.key), value);
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn("Loop Pad: couldn't load recordings.", e);
  }
  return found;
}
