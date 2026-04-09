import React, { useState } from 'react';
import {
    Building2,
    Globe,
    Users,
    MapPin,
    Tag
} from 'lucide-react';
import { useCompanies } from '../contexts/CompaniesContext';
import { useCrmMultiLookup } from '../services/lookupService';
import {
    FormShell,
    FormHeader,
    FormBody,
    FormSection,
    Field,
    TextInput,
    Select,
    TextArea,
    StickyFooter
} from './FormKit';

interface CompanyFormPageProps {
    readonly isDark: boolean;
    readonly onBack: () => void;
}

const CompanyFormPage: React.FC<CompanyFormPageProps> = ({ isDark, onBack }) => {
    const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500-1000', '1000+'];
    const { createCompany } = useCompanies();
    const { data: lookups, loading: lookupLoading } = useCrmMultiLookup(['industries', 'stages', 'owners']);
    const industryOptions = lookups.industries || [];
    const stageOptions = lookups.stages || [];
    const ownerOptions = lookups.owners || [];

    const [formData, setFormData] = useState({
        name: '',
        domain: '',
        industry: '',
        industryRefId: '',
        size: '',
        stage: '',
        stageRefId: '',
        owner: '',
        ownerUserId: '',
        address: '',
        notes: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'industryRefId') {
            const selected = industryOptions.find((i) => i.id === value);
            setFormData((prev) => ({ ...prev, industryRefId: value, industry: selected?.label || '' }));
            return;
        }
        if (name === 'stageRefId') {
            const selected = stageOptions.find((s) => s.id === value);
            setFormData((prev) => ({ ...prev, stageRefId: value, stage: selected?.label || '' }));
            return;
        }
        if (name === 'ownerUserId') {
            const selected = ownerOptions.find((o) => o.id === value);
            setFormData((prev) => ({ ...prev, ownerUserId: value, owner: selected?.label || '' }));
            return;
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    React.useEffect(() => {
        if (!formData.stageRefId && stageOptions.length > 0) {
            setFormData((prev) => ({ ...prev, stageRefId: stageOptions[0].id, stage: stageOptions[0].label }));
        }
    }, [stageOptions, formData.stageRefId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createCompany({
                name: formData.name.trim(),
                domain: formData.domain.trim() || undefined,
                industry: formData.industry.trim() || undefined,
                industryRefId: formData.industryRefId || undefined,
                ownerUserId: formData.ownerUserId || undefined,
                size: formData.size || undefined,
                address: formData.address.trim() || undefined,
            });
            onBack();
        } catch (error) {
            console.error('Failed to create company:', error);
        }
    };

    const isValid = formData.name.trim().length > 0;

    return (
        <FormShell isDark={isDark} onSubmit={handleSubmit} id="company-form">
            <FormHeader
                isDark={isDark}
                title="Create Company"
                subtitle="Add a new organization to your CRM"
                breadcrumb="Contacts / Companies"
                onBack={onBack}
            />

            <FormBody isDark={isDark}>
                {/* 1. Company Identity */}
                <FormSection
                    isDark={isDark}
                    title="Company Identity"
                    description="Core business details and web presence."
                    icon={<Building2 size={18} />}
                >
                    <Field isDark={isDark} label="Company Name" required>
                        <TextInput
                            isDark={isDark}
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="e.g. Acme Inc."
                            autoFocus
                        />
                    </Field>
                    <Field isDark={isDark} label="Domain / Website">
                        <TextInput
                            isDark={isDark}
                            name="domain"
                            value={formData.domain}
                            onChange={handleChange}
                            placeholder="acme.com"
                            icon={<Globe size={16} />}
                        />
                    </Field>
                </FormSection>

                {/* 2. Demographics */}
                <FormSection
                    isDark={isDark}
                    title="Demographics"
                    description="Size, industry, and location details."
                    icon={<Users size={18} />}
                >
                    <Field isDark={isDark} label="Industry">
                        <Select
                            isDark={isDark}
                            name="industryRefId"
                            value={formData.industryRefId}
                            onChange={handleChange}
                            disabled={lookupLoading}
                        >
                            <option value="">{lookupLoading ? 'Loading industries...' : 'Select industry...'}</option>
                            {industryOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                            ))}
                        </Select>
                    </Field>
                    <Field isDark={isDark} label="Company Size">
                        <Select
                            isDark={isDark}
                            name="size"
                            value={formData.size}
                            onChange={handleChange}
                        >
                            <option value="">Select size...</option>
                            {COMPANY_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                        </Select>
                    </Field>
                    <Field isDark={isDark} label="Headquarters" fullWidth>
                        <TextInput
                            isDark={isDark}
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            placeholder="123 Main St, City, Country"
                            icon={<MapPin size={16} />}
                        />
                    </Field>
                </FormSection>

                {/* 3. CRM Logic */}
                <FormSection
                    isDark={isDark}
                    title="CRM Logic"
                    description="Pipeline position and account ownership."
                    icon={<Tag size={18} />}
                >
                    <Field isDark={isDark} label="Pipeline Stage">
                        <Select
                            isDark={isDark}
                            name="stageRefId"
                            value={formData.stageRefId}
                            onChange={handleChange}
                            disabled={lookupLoading}
                        >
                            <option value="">{lookupLoading ? 'Loading stages...' : 'Select stage...'}</option>
                            {stageOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                        </Select>
                    </Field>
                    <Field isDark={isDark} label="Account Owner">
                        <Select
                            isDark={isDark}
                            name="ownerUserId"
                            value={formData.ownerUserId}
                            onChange={handleChange}
                            icon={<Users size={16} />}
                            disabled={lookupLoading}
                        >
                            <option value="">{lookupLoading ? 'Loading owners...' : 'Select owner...'}</option>
                            {ownerOptions.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                        </Select>
                    </Field>
                    <Field isDark={isDark} label="Internal Notes" fullWidth>
                        <TextArea
                            isDark={isDark}
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            placeholder="Add context..."
                        />
                    </Field>
                </FormSection>

            </FormBody>

            <StickyFooter
                isDark={isDark}
                onCancel={onBack}
                isValid={!!isValid}
                primaryAction="Create Company"
                icon={<Building2 size={16} strokeWidth={2.5} />}
            />
        </FormShell>
    );
};

export default CompanyFormPage;


