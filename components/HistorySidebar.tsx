/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { DesignSession } from '../types';

interface HistorySidebarProps {
  isOpen: boolean;
  sessions: DesignSession[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
}

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
);


const HistorySidebar: React.FC<HistorySidebarProps> = ({ isOpen, sessions, activeSessionId, onSelectSession, onNewSession, onDeleteSession }) => {
  const timeAgo = (timestamp: number) => {
    const seconds = Math.floor((new Date().getTime() - timestamp) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return "Just now";
  }

  const isNewProjectMode = activeSessionId === null;

  return (
    <aside className={`absolute md:fixed top-0 left-0 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-transform duration-300 ease-in-out z-30 w-72 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <button 
          onClick={onNewSession}
          className={`w-full flex items-center justify-center px-4 py-2 font-bold rounded-lg transition-colors ${
            isNewProjectMode
              ? 'bg-indigo-600 dark:bg-indigo-500 text-white cursor-default'
              : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300'
          }`}
        >
          <PlusIcon />
          New Project
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {sessions.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <p>Your design projects will appear here.</p>
            </div>
        ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {sessions.map(session => (
                    <li key={session.id} className={`p-2 group ${activeSessionId === session.id ? 'bg-gray-100 dark:bg-gray-900/50' : ''}`}>
                        <div
                            onClick={() => onSelectSession(session.id)}
                            className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50 cursor-pointer"
                        >
                            <img src={session.thumbnail} alt={session.name} className="w-16 h-12 object-cover rounded-md bg-gray-200 dark:bg-gray-700" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{session.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{timeAgo(session.timestamp)}</p>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm("Are you sure you want to delete this project?")) {
                                        onDeleteSession(session.id);
                                    }
                                }}
                                className="p-2 rounded-full text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="Delete project"
                            >
                                <TrashIcon />
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        )}
      </div>
    </aside>
  );
};

export default HistorySidebar;