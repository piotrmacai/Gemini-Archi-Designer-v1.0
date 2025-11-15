/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { DesignSession, SerializableDesignSession, SerializableFile } from '../types';
import { dataURLtoFile, fileToDataUrl } from '../utils/fileUtils';

const SESSIONS_STORAGE_KEY = 'archiDesignerSessions';

// --- Serialization / Deserialization ---

async function fileToSerializable(file: File): Promise<SerializableFile> {
  const dataUrl = await fileToDataUrl(file);
  return { name: file.name, type: file.type, dataUrl };
}

function serializableToFile(sFile: SerializableFile): File {
  return dataURLtoFile(sFile.dataUrl, sFile.name);
}

async function sessionToSerializable(session: DesignSession): Promise<SerializableDesignSession> {
    const [sceneImage, ...generations] = await Promise.all([
        fileToSerializable(session.sceneImage),
        ...session.generations.map(fileToSerializable)
    ]);

    return {
        id: session.id,
        name: session.name,
        timestamp: session.timestamp,
        thumbnail: session.thumbnail,
        originalDimensions: session.originalDimensions,
        sceneImage,
        generations
    };
}

function serializableToSession(sSession: SerializableDesignSession): DesignSession {
    return {
        id: sSession.id,
        name: sSession.name,
        timestamp: sSession.timestamp,
        thumbnail: sSession.thumbnail,
        originalDimensions: sSession.originalDimensions,
        sceneImage: serializableToFile(sSession.sceneImage),
        generations: sSession.generations.map(serializableToFile),
    };
}

// --- Public API ---

/**
 * Saves all design sessions to local storage.
 * @param sessions - The array of DesignSession objects to save.
 */
export const saveSessionsToLocalStorage = async (sessions: DesignSession[]): Promise<void> => {
    try {
        const serializableSessions = await Promise.all(sessions.map(sessionToSerializable));
        localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(serializableSessions));
    } catch (error) {
        console.error("Failed to save sessions to local storage:", error);
    }
};

/**
 * Loads all design sessions from local storage.
 * @returns A promise that resolves to an array of DesignSession objects.
 */
export const loadSessionsFromLocalStorage = async (): Promise<DesignSession[]> => {
    try {
        const storedSessions = localStorage.getItem(SESSIONS_STORAGE_KEY);
        if (storedSessions) {
            const parsedSessions: SerializableDesignSession[] = JSON.parse(storedSessions);
            // The sessions are stored newest-first, so we don't need to re-sort here.
            return parsedSessions.map(serializableToSession);
        }
    } catch (error) {
        console.error("Failed to load sessions from local storage:", error);
        // If loading fails, clear the corrupted data to prevent future errors
        localStorage.removeItem(SESSIONS_STORAGE_KEY);
    }
    return [];
};
