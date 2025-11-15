/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Product } from '../types';

interface ObjectCardProps {
    product: Product;
    onDragStart: (e: React.DragEvent, product: Product) => void;
    onDragEnd: (e: React.DragEvent) => void;
    onTouchStart: (e: React.TouchEvent, product: Product) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
}

const ObjectCard: React.FC<ObjectCardProps> = ({ product, onDragStart, onDragEnd, onTouchStart, onTouchMove, onTouchEnd }) => {
    const cardClasses = `
        bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-all duration-300
        cursor-grab active:cursor-grabbing hover:shadow-xl hover:scale-105
        border border-zinc-200 dark:border-gray-700
    `;

    return (
        <div 
            className={cardClasses}
            draggable="true"
            onDragStart={(e) => onDragStart(e, product)}
            onDragEnd={onDragEnd}
            onTouchStart={(e) => onTouchStart(e, product)}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            <div className="aspect-square w-full bg-zinc-100 dark:bg-gray-700 flex items-center justify-center pointer-events-none">
                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain" />
            </div>
            <div className="p-3 text-center pointer-events-none">
                <h4 className="text-sm font-semibold text-zinc-700 dark:text-gray-300 truncate">{product.name}</h4>
            </div>
        </div>
    );
};

export default ObjectCard;
