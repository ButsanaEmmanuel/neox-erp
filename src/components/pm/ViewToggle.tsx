import React from 'react';
import { LayoutList, TableProperties } from 'lucide-react';

export type ViewMode = 'list' | 'table';

interface ViewToggleProps {
    mode: ViewMode;
    onChange: (mode: ViewMode) => void;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ mode, onChange }) => {
    return (
        <div className="flex items-center bg-app border border-input rounded-lg p-0.5">
            <button
                onClick={() => onChange('list')}
                className={`p-1.5 rounded-md transition-all ${mode === 'list'
                        ? 'bg-blue-600/20 text-blue-400 shadow-sm'
                        : 'text-muted hover:text-secondary hover:bg-surface'
                    }`}
                title="List View"
            >
                <LayoutList size={16} />
            </button>
            <div className="w-px h-4 bg-border mx-0.5" />
            <button
                onClick={() => onChange('table')}
                className={`p-1.5 rounded-md transition-all ${mode === 'table'
                        ? 'bg-blue-600/20 text-blue-400 shadow-sm'
                        : 'text-muted hover:text-secondary hover:bg-surface'
                    }`}
                title="Table View"
            >
                <TableProperties size={16} />
            </button>
        </div>
    );
};

export default ViewToggle;




