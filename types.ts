/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Product {
  id: number;
  name: string;
  imageUrl: string;
}

export interface DesignSession {
  id: string;
  name: string;
  timestamp: number;
  thumbnail: string; // Data URL
  sceneImage: File;
  originalDimensions: { width: number; height: number };
  generations: File[];
}
