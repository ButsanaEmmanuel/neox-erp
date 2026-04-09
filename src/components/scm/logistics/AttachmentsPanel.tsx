import React, { useState } from 'react';
import { Paperclip, FileText, Image as ImageIcon, Download, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Attachment } from '../../../types/logistics';
import { cn } from '../../../utils/cn';

interface AttachmentsPanelProps {
    attachments: Attachment[];
    onAddAttachment?: (file: File) => void;
    onDeleteAttachment?: (id: string) => void;
    className?: string;
    readOnly?: boolean;
}

export const AttachmentsPanel: React.FC<AttachmentsPanelProps> = ({
    attachments,
    onAddAttachment,
    onDeleteAttachment,
    className,
    readOnly = false
}) => {
    const [isHoveringDropzone, setIsHoveringDropzone] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0 && onAddAttachment) {
            onAddAttachment(e.target.files[0]);
        }
    };

    const getIconForType = (type: string) => {
        if (type.startsWith('image/')) return <ImageIcon size={16} className="text-blue-500" />;
        return <FileText size={16} className="text-purple-500" />;
    };

    return (
        <div className={cn("bg-card border border-border rounded-xl shadow-sm flex flex-col h-fit", className)}>
            <div className="p-4 border-b border-border bg-surface/50 rounded-t-xl flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Paperclip size={16} className="text-muted" /> Attachments
                </h3>
                <span className="text-xs font-bold text-muted bg-background px-2 py-0.5 rounded-full border border-border">
                    {attachments.length} files
                </span>
            </div>

            <div className="p-4 flex flex-col gap-4">
                {!readOnly && (
                    <div
                        className={cn(
                            "border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-2 text-center transition-colors cursor-pointer relative",
                            isHoveringDropzone ? "border-blue-500 bg-blue-500/5" : "border-border hover:border-muted hover:bg-surface/50"
                        )}
                        onDragOver={(e) => { e.preventDefault(); setIsHoveringDropzone(true); }}
                        onDragLeave={() => setIsHoveringDropzone(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setIsHoveringDropzone(false);
                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onAddAttachment) {
                                onAddAttachment(e.dataTransfer.files[0]);
                            }
                        }}
                    >
                        <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleFileChange}
                        />
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mb-1">
                            <Plus size={20} />
                        </div>
                        <p className="text-sm font-medium text-foreground">Click or drag file to upload</p>
                        <p className="text-xs text-muted">Supports PDF, JPG, PNG (Max 10MB)</p>
                    </div>
                )}

                <div className="flex flex-col gap-2">
                    {attachments.length === 0 ? (
                        readOnly && <p className="text-sm text-muted text-center py-4">No attachments uploaded.</p>
                    ) : (
                        attachments.map(att => (
                            <div key={att.id} className="group flex items-center gap-3 p-3 rounded-lg border border-border bg-surface hover:border-muted transition-colors">
                                <div className="w-10 h-10 rounded-lg bg-background border border-border flex items-center justify-center flex-none">
                                    {getIconForType(att.type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-medium text-foreground truncate">{att.filename}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10px] text-muted uppercase font-bold tracking-wider">{att.type.split('/')[1] || 'FILE'}</span>
                                        <span className="w-1 h-1 rounded-full bg-border" />
                                        <span className="text-[11px] text-muted">{format(new Date(att.createdAt), 'MMM d, yyyy')}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {/* Download button mocked */}
                                    <button className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:text-foreground hover:bg-muted/30 transition-colors" title="Download">
                                        <Download size={14} />
                                    </button>
                                    {!readOnly && onDeleteAttachment && (
                                        <button
                                            onClick={() => onDeleteAttachment(att.id)}
                                            className="w-8 h-8 rounded-md flex items-center justify-center text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};


