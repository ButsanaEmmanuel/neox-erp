import React, { useState } from 'react';
import {
    User,
    Mail,
    Phone,
    Building2,
    Briefcase,
    Tag,
    Users,
    Plus
} from 'lucide-react';
import { useCrmMultiLookup } from '../services/lookupService';
import { apiRequest } from '../lib/apiClient';
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

interface PersonFormPageProps {
    readonly isDark: boolean;
    readonly onBack: () => void;
}

const PersonFormPage: React.FC<PersonFormPageProps> = ({ isDark, onBack }) => {
    const { data: lookups, loading: lookupLoading, refetch } = useCrmMultiLookup(['companies', 'stages', 'owners', 'organizations']);
    const companyOptions = lookups.companies || [];
    const stageOptions = lookups.stages || [];
    const ownerOptions = lookups.owners || [];
    const organizationOptions = lookups.organizations || [];

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        company: '',
        organizationId: '',
        jobTitle: '',
        stage: '',
        stageRefId: '',
        owner: '',
        ownerUserId: '',
        notes: ''
    });
    const [creatingOrganization, setCreatingOrganization] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'company') {
            setFormData((prev) => ({ ...prev, company: value, organizationId: value || prev.organizationId }));
            return;
        }
        if (name === 'organizationId') {
            setFormData((prev) => ({ ...prev, organizationId: value, company: value || prev.company }));
            return;
        }
        if (name === 'ownerUserId') {
            const selectedOwner = ownerOptions.find((owner) => owner.id === value);
            setFormData((prev) => ({ ...prev, ownerUserId: value, owner: selectedOwner?.label || '' }));
            return;
        }
        if (name === 'stageRefId') {
            const selectedStage = stageOptions.find((stage) => stage.id === value);
            setFormData((prev) => ({ ...prev, stageRefId: value, stage: selectedStage?.label || '' }));
            return;
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    React.useEffect(() => {
        if (!formData.stageRefId && stageOptions.length > 0) {
            setFormData((prev) => ({ ...prev, stageRefId: stageOptions[0].id, stage: stageOptions[0].label }));
        }
    }, [stageOptions, formData.stageRefId]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Here we would typically make an API call
        console.log('Submitting Person:', formData);
        onBack(); // Navigate back on success
    };

    const isValid = formData.firstName && formData.lastName && formData.email;

    const handleCreateOrganizationInline = async () => {
        const name = window.prompt('Organization name');
        const trimmed = String(name || '').trim();
        if (!trimmed) return;

        setCreatingOrganization(true);
        try {
            const created = await apiRequest<{ client: { id: string; name: string } }>(
                '/api/v1/crm/clients',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        name: trimmed,
                        profileStatus: 'needs_completion',
                    }),
                },
            );
            await refetch(true);
            setFormData((prev) => ({
                ...prev,
                organizationId: created.client.id,
                company: created.client.id,
            }));
        } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Failed to create organization');
        } finally {
            setCreatingOrganization(false);
        }
    };

    return (
        <FormShell isDark={isDark} onSubmit={handleSubmit} id="person-form">
            <FormHeader
                isDark={isDark}
                title="Create Person"
                subtitle="Add a new contact to your CRM"
                breadcrumb="Contacts / People"
                onBack={onBack}
            />

            <FormBody isDark={isDark}>
                {/* 1. Identity */}
                <FormSection
                    isDark={isDark}
                    title="Identity"
                    description="Core personal information used for identification and addressing."
                    icon={<User size={18} />}
                >
                    <Field isDark={isDark} label="First Name" required>
                        <TextInput
                            isDark={isDark}
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            placeholder="e.g. Jane"
                            autoFocus
                        />
                    </Field>
                    <Field isDark={isDark} label="Last Name" required>
                        <TextInput
                            isDark={isDark}
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            placeholder="e.g. Doe"
                        />
                    </Field>
                </FormSection>

                {/* 2. Contact Methods */}
                <FormSection
                    isDark={isDark}
                    title="Contact Methods"
                    description="Primary channels for communication."
                    icon={<Mail size={18} />}
                >
                    <Field isDark={isDark} label="Email Address" required>
                        <TextInput
                            isDark={isDark}
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="jane.doe@company.com"
                            icon={<Mail size={16} />}
                        />
                    </Field>
                    <Field isDark={isDark} label="Phone Number">
                        <TextInput
                            isDark={isDark}
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="+1 (555) 000-0000"
                            icon={<Phone size={16} />}
                        />
                    </Field>
                </FormSection>

                {/* 3. Professional Context */}
                <FormSection
                    isDark={isDark}
                    title="Professional Context"
                    description="Current role and organizational affiliation."
                    icon={<Briefcase size={18} />}
                >
                    <Field isDark={isDark} label="Organization">
                        <Select
                            isDark={isDark}
                            name="company"
                            value={formData.company}
                            onChange={handleChange}
                            icon={<Building2 size={16} />}
                            disabled={lookupLoading}
                        >
                            <option value="">{lookupLoading ? 'Loading companies...' : 'Select company...'}</option>
                            {companyOptions.map(c => <option key={c.id} value={c.value}>{c.label}</option>)}
                        </Select>
                    </Field>
                    <Field isDark={isDark} label="Department / Organization Scope">
                        <div className="flex items-center gap-2">
                            <Select
                                isDark={isDark}
                                name="organizationId"
                                value={formData.organizationId}
                                onChange={handleChange}
                                disabled={lookupLoading || creatingOrganization}
                            >
                                <option value="">{lookupLoading ? 'Loading organizations...' : 'Select organization scope...'}</option>
                                {organizationOptions.map(org => <option key={org.id} value={org.value}>{org.label}</option>)}
                            </Select>
                            <button
                                type="button"
                                onClick={handleCreateOrganizationInline}
                                disabled={creatingOrganization}
                                className="h-11 px-3 rounded-xl border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 hover:border-emerald-400 transition-colors disabled:opacity-60"
                            >
                                {creatingOrganization ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </Field>
                    <Field isDark={isDark} label="Job Title">
                        <TextInput
                            isDark={isDark}
                            name="jobTitle"
                            value={formData.jobTitle}
                            onChange={handleChange}
                            placeholder="e.g. VP of Sales"
                        />
                    </Field>
                </FormSection>

                {/* 4. CRM Properties */}
                <FormSection
                    isDark={isDark}
                    title="CRM Logic"
                    description="Pipeline configuration and ownership."
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
                            {stageOptions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </Select>
                    </Field>
                    <Field isDark={isDark} label="Deal Owner">
                        <Select
                            isDark={isDark}
                            name="ownerUserId"
                            value={formData.ownerUserId}
                            onChange={handleChange}
                            icon={<Users size={16} />}
                            disabled={lookupLoading}
                        >
                            <option value="">{lookupLoading ? 'Loading owners...' : 'Select owner...'}</option>
                            {ownerOptions.map(o => <option key={o.id} value={o.value}>{o.label}</option>)}
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
                primaryAction="Create Person"
                icon={<Plus size={16} strokeWidth={2.5} />}
            />
        </FormShell>
    );
};

export default PersonFormPage;
