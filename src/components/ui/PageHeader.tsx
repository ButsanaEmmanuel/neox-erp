import React from 'react';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => (
    <div className="flex-none px-8 py-6 border-b border-border/60 flex items-center justify-between bg-card">
        <div>
            <h1 className="text-[24px] font-bold text-primary tracking-tight">{title}</h1>
            {subtitle && <p className="text-[13px] text-muted mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
);

export default PageHeader;
