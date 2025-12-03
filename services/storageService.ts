/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { DesignSession } from '../types';

const DB_NAME = 'ArchiDesignerDB';
const DB_VERSION = 1;
const SESSIONS_STORE_NAME = 'sessions';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
        return reject(new Error("IndexedDB is not supported by this browser."));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => {
      console.error("IndexedDB error:", request.error);
      reject(request.error);
    };
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SESSIONS_STORE_NAME)) {
        db.createObjectStore(SESSIONS_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Saves all design sessions to IndexedDB.
 * This function overwrites all existing data with the provided sessions.
 * @param sessions - The array of DesignSession objects to save.
 */
export const saveSessionsToDB = async (sessions: DesignSession[]): Promise<void> => {
    try {
        const db = await openDB();
        const transaction = db.transaction(SESSIONS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SESSIONS_STORE_NAME);

        // A single transaction for both clearing and adding is more atomic.
        store.clear(); 
        sessions.forEach(session => {
            store.put(session);
        });

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => {
                resolve();
            };
            transaction.onerror = () => {
                console.error("Save transaction error:", transaction.error);
                reject(transaction.error);
            };
        });

    } catch (error) {
        console.error("Failed to save sessions to IndexedDB:", error);
    }
};

/**
 * Loads all design sessions from IndexedDB.
 * @returns A promise that resolves to an array of DesignSession objects.
 */
export const loadSessionsFromDB = async (): Promise<DesignSession[]> => {
    try {
        const db = await openDB();
        const transaction = db.transaction(SESSIONS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(SESSIONS_STORE_NAME);
        const request = store.getAll();

        return new Promise<DesignSession[]>((resolve, reject) => {
            request.onsuccess = () => {
                if (request.result) {
                    // Sort sessions by timestamp, newest first, to maintain previous behavior.
                    const sessions: DesignSession[] = request.result.sort((a, b) => b.timestamp - a.timestamp);
                    resolve(sessions);
                } else {
                    resolve([]);
                }
            };
            request.onerror = () => {
                console.error("Failed to get all sessions:", request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error("Failed to load sessions from IndexedDB:", error);
        return [];
    }
};