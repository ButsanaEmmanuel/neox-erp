import React from 'react';

interface SkeletonProps {
    className?: string;
    rows?: number;
}

const SkeletonRow: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`h-4 bg-slate-800/60 rounded animate-pulse ${className}`} />
);

const Skeleton: React.FC<SkeletonProps> = ({ className = '', rows = 5 }) => (
    <div className={`space-y-4 p-6 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
                <div className="h-9 w-9 rounded-full bg-slate-800/60 animate-pulse flex-none" />
                <div className="flex-1 space-y-2">
                    <SkeletonRow className="w-1/3" />
                    <SkeletonRow className="w-1/5 h-3" />
                </div>
                <SkeletonRow className="w-16 h-5" />
            </div>
        ))}
    </div>
);

export default Skeleton;
