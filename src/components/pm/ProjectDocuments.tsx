import React, { useState } from 'react';
import { useProjectStore } from '../../store/pm/useProjectStore';
import { FileText, Download, Filter, Search, Plus, File, Image, FileCheck } from 'lucide-react';
import { format } from 'date-fns';
import ProfessionalEmptyState from '../ui/ProfessionalEmptyState';

const ProjectDocuments: React.FC = () => {
    const { documents, addDocument, activeProjectId } = useProjectStore();
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeProjectId) return;

        addDocument({
            id: `doc-${Date.now()}`,
            projectId: activeProjectId,
            name: file.name,
            category: 'report',
            uploader: 'Current User',
            uploadDate: new Date().toISOString(),
            size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
            url: URL.createObjectURL(file)
        });
    };

    const triggerUpload = () => {
        fileInputRef.current?.click();
    };

    const projectDocs = documents.filter(doc => doc.projectId === activeProjectId);
    
    const filteredDocs = projectDocs.filter(doc =>
        doc.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getIcon = (category: string) => {
        switch (category) {
            case 'photo': return <Image size={18} className="text-purple-400" />;
            case 'evidence': return <FileCheck size={18} className="text-emerald-400" />;
            default: return <FileText size={18} className="text-blue-400" />;
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-border/60 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-primary">Documents</h2>
                    <p className="text-sm text-muted">Manage project files and attachments</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <input
                            type="text"
                            placeholder="Search files..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-card border border-border/60 rounded-lg pl-9 pr-3 py-1.5 text-sm text-primary focus:outline-none focus:border-blue-500/50 transition-colors w-64"
                        />
                    </div>
                    <button className="p-2 hover:bg-surface rounded-lg text-muted hover:text-primary transition-colors">
                        <Filter size={18} />
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleUpload} 
                        className="hidden" 
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    />
                    <button
                        onClick={triggerUpload}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Plus size={16} />
                        Upload
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6">
                {projectDocs.length > 0 ? (
                    <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-surface text-xs font-semibold uppercase tracking-wider text-muted">
                                <tr>
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Category</th>
                                    <th className="px-6 py-4">Uploaded By</th>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4 text-right">Size</th>
                                    <th className="px-6 py-4 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.06]">
                                {filteredDocs.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-surface transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center">
                                                    {getIcon(doc.category)}
                                                </div>
                                                <span className="font-medium text-primary">{doc.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-0.5 rounded text-xs bg-surface text-secondary capitalize border border-border/60">
                                                {doc.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-muted">{doc.uploader}</td>
                                        <td className="px-6 py-4 text-muted">
                                            {format(new Date(doc.uploadDate), 'MMM d, yyyy')}
                                        </td>
                                        <td className="px-6 py-4 text-muted text-right tabular-nums">{doc.size}</td>
                                        <td className="px-6 py-4">
                                            <button className="text-muted hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
                                                <Download size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                <div className="h-full flex items-center justify-center py-12">
                    <ProfessionalEmptyState
                        icon={File}
                        title="No Documents Yet"
                        description="Professionalize your project tracking by uploading key files, reports, and evidence."
                        action={{
                            label: "Upload Document",
                            icon: Plus,
                            onClick: triggerUpload
                        }}
                    />
                </div>
                )}
            </div>
        </div>
    );
};

export default ProjectDocuments;




