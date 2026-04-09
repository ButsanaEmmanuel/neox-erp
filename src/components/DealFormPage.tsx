import React, { useState, useMemo } from 'react';
import { FormShell, FormHeader, FormBody, FormSection, Field, TextInput, Select, TextArea, StickyFooter, CurrencyInput, MultiSelect } from './FormKit';
import { CreateDealPayload } from '../types/deal';
import { useDeals } from '../contexts/DealsContext';
import { useCompanies } from '../contexts/CompaniesContext';
import { usePeople } from '../contexts/PeopleContext';
import { useCrmMultiLookup } from '../services/lookupService';

interface DealFormPageProps {
    isDark: boolean;
    onBack: () => void;
}

const DealFormPage: React.FC<DealFormPageProps> = ({ isDark, onBack }) => {
    const { createDeal } = useDeals();
    const { companies } = useCompanies();
    const { people, getPeopleByCompany } = usePeople();

    const { data: lookups, loading: lookupLoading } = useCrmMultiLookup(['stages', 'owners']);
    const stageOptions = lookups.stages || [];
    const ownerOptions = lookups.owners || [];

    const [formData, setFormData] = useState({
        name: '',
        companyId: '',
        primaryContactId: '',
        stakeholderIds: [] as string[],
        stakeholderRoles: {} as Record<string, string>,
        stage: '' as string,
        stageRefId: '' as string,
        value: '',
        currency: 'USD',
        owner: '',
        ownerUserId: '' as string,
        closeDate: '',
        notes: ''
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const peopleInSelectedCompany = useMemo(() => {
        if (!formData.companyId) return [];
        return getPeopleByCompany(formData.companyId);
    }, [formData.companyId, getPeopleByCompany]);

    const availableStakeholders = useMemo(() => {
        return peopleInSelectedCompany
            .filter((p) => p.id !== formData.primaryContactId)
            .map((p) => ({
                id: p.id,
                name: p.name,
                subtitle: p.email
            }));
    }, [peopleInSelectedCompany, formData.primaryContactId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;

        if (name === 'companyId') {
            setFormData((prev) => ({
                ...prev,
                [name]: value,
                primaryContactId: '',
                stakeholderIds: [],
                stakeholderRoles: {}
            }));
        } else if (name === 'ownerUserId') {
            const selectedOwner = ownerOptions.find((owner) => owner.id === value);
            setFormData((prev) => ({
                ...prev,
                ownerUserId: value,
                owner: selectedOwner?.label || '',
            }));
        } else if (name === 'stageRefId') {
            const selectedStage = stageOptions.find((stage) => stage.id === value);
            setFormData((prev) => ({
                ...prev,
                stageRefId: value,
                stage: selectedStage?.label || prev.stage,
            }));
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }

        if (errors[name]) {
            setErrors((prev) => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
    };

    const handleStakeholdersChange = (value: string[]) => {
        setFormData((prev) => {
            const newRoles = { ...prev.stakeholderRoles };
            Object.keys(newRoles).forEach((personId) => {
                if (!value.includes(personId)) delete newRoles[personId];
            });
            return {
                ...prev,
                stakeholderIds: value,
                stakeholderRoles: newRoles
            };
        });
    };

    const handleRoleChange = (personId: string, role: string) => {
        setFormData((prev) => ({
            ...prev,
            stakeholderRoles: {
                ...prev.stakeholderRoles,
                [personId]: role
            }
        }));
    };

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) newErrors.name = 'Deal name is required';
        if (!formData.companyId) newErrors.companyId = 'Company is required';
        if (!formData.stageRefId) newErrors.stage = 'Stage is required';

        if (!formData.value.trim()) {
            newErrors.value = 'Deal value is required';
        } else {
            const numericValue = parseFloat(formData.value.replace(/[^0-9.]/g, ''));
            if (isNaN(numericValue) || numericValue <= 0) {
                newErrors.value = 'Value must be greater than 0';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    React.useEffect(() => {
        if (!formData.stageRefId && stageOptions.length > 0) {
            setFormData((prev) => ({
                ...prev,
                stageRefId: stageOptions[0].id,
                stage: stageOptions[0].label,
            }));
        }
    }, [stageOptions, formData.stageRefId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        try {
            const numericValue = parseFloat(formData.value.replace(/[^0-9.]/g, ''));
            const payload: CreateDealPayload = {
                name: formData.name.trim(),
                companyId: formData.companyId,
                primaryContactId: formData.primaryContactId || undefined,
                stakeholderIds: formData.stakeholderIds,
                stakeholderRoles: formData.stakeholderRoles,
                stage: formData.stage as any,
                stageRefId: formData.stageRefId || undefined,
                value: numericValue,
                currency: formData.currency,
                owner: formData.owner || undefined,
                ownerUserId: formData.ownerUserId || undefined,
                closeDate: formData.closeDate || undefined,
                notes: formData.notes || undefined
            };

            await createDeal(payload, companies, people);
            onBack();
        } catch (error) {
            console.error('Failed to create deal:', error);
            setErrors({ submit: 'Failed to create deal. Please try again.' });
        }
    };

    const isValid = Boolean(formData.name.trim() && formData.companyId && formData.stageRefId && formData.value.trim());

    return (
        <FormShell isDark={isDark} onSubmit={handleSubmit}>
            <FormHeader
                isDark={isDark}
                breadcrumb="Pipeline / Deals"
                title="New Deal"
                subtitle="Create a new deal and track it through your pipeline"
                onBack={onBack}
            />

            <FormBody isDark={isDark}>
                <FormSection isDark={isDark} title="Company & Contact" description="Select the company and primary contact for this deal">
                    <Field isDark={isDark} label="Company" required error={errors.companyId}>
                        <Select isDark={isDark} name="companyId" value={formData.companyId} onChange={handleChange}>
                            <option value="">Select a company...</option>
                            {companies.map((company) => (
                                <option key={company.id} value={company.id}>
                                    {company.name}{company.industry ? ` - ${company.industry}` : ''}
                                </option>
                            ))}
                        </Select>
                    </Field>

                    <Field isDark={isDark} label="Primary Contact">
                        <Select isDark={isDark} name="primaryContactId" value={formData.primaryContactId} onChange={handleChange} disabled={!formData.companyId}>
                            <option value="">None (optional)</option>
                            {peopleInSelectedCompany.map((person) => (
                                <option key={person.id} value={person.id}>
                                    {person.name} - {person.email}
                                </option>
                            ))}
                        </Select>
                    </Field>
                </FormSection>

                <FormSection isDark={isDark} title="Deal Information" description="Basic details about this opportunity">
                    <Field isDark={isDark} label="Deal Name" required error={errors.name}>
                        <TextInput isDark={isDark} name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Enterprise SaaS Deal, Q2 Expansion" />
                    </Field>

                    <Field isDark={isDark} label="Stage" required error={errors.stage}>
                        <Select isDark={isDark} name="stageRefId" value={formData.stageRefId} onChange={handleChange} disabled={lookupLoading}>
                            <option value="">{lookupLoading ? 'Loading stages...' : 'Select stage...'}</option>
                            {stageOptions.map((stage) => (
                                <option key={stage.id} value={stage.id}>{stage.label}</option>
                            ))}
                        </Select>
                    </Field>
                </FormSection>

                <FormSection isDark={isDark} title="Financial Details" description="Deal value and currency information">
                    <div className="grid grid-cols-2 gap-4">
                        <Field isDark={isDark} label="Deal Value" required error={errors.value}>
                            <CurrencyInput
                                isDark={isDark}
                                name="value"
                                value={formData.value}
                                onChange={handleChange}
                                placeholder="250000"
                                currencySymbol={formData.currency === 'EUR' ? 'EUR' : '$'}
                            />
                        </Field>

                        <Field isDark={isDark} label="Currency">
                            <Select isDark={isDark} name="currency" value={formData.currency} onChange={handleChange}>
                                <option value="USD">USD ($)</option>
                                <option value="EUR">EUR (EUR)</option>
                            </Select>
                        </Field>
                    </div>

                    <Field isDark={isDark} label="Expected Close Date">
                        <TextInput isDark={isDark} type="date" name="closeDate" value={formData.closeDate} onChange={handleChange} />
                    </Field>

                    <Field isDark={isDark} label="Deal Owner">
                        <Select isDark={isDark} name="ownerUserId" value={formData.ownerUserId} onChange={handleChange} disabled={lookupLoading}>
                            <option value="">{lookupLoading ? 'Loading owners...' : 'Select owner...'}</option>
                            {ownerOptions.map((owner) => (
                                <option key={owner.id} value={owner.id}>{owner.label}</option>
                            ))}
                        </Select>
                    </Field>
                </FormSection>

                {formData.companyId && peopleInSelectedCompany.length > 0 && (
                    <FormSection isDark={isDark} title="Additional Stakeholders" description="Add other people involved in this deal and their roles">
                        <Field isDark={isDark} label="Stakeholders">
                            <MultiSelect
                                isDark={isDark}
                                name="stakeholderIds"
                                value={formData.stakeholderIds}
                                onChange={handleStakeholdersChange}
                                options={availableStakeholders}
                                placeholder="Select stakeholders..."
                                disabled={!formData.companyId}
                            />
                        </Field>

                        {formData.stakeholderIds.map((personId) => {
                            const person = people.find((p) => p.id === personId);
                            if (!person) return null;
                            return (
                                <Field key={personId} isDark={isDark} label={`Role for ${person.name}`}>
                                    <TextInput
                                        isDark={isDark}
                                        name={`role-${personId}`}
                                        value={formData.stakeholderRoles[personId] || ''}
                                        onChange={(e) => handleRoleChange(personId, e.target.value)}
                                        placeholder="Stakeholder"
                                    />
                                </Field>
                            );
                        })}
                    </FormSection>
                )}

                <FormSection isDark={isDark} title="Additional Details" description="Internal notes and context about this deal">
                    <Field isDark={isDark} label="Internal Notes">
                        <TextArea isDark={isDark} name="notes" value={formData.notes} onChange={handleChange} placeholder="Add any relevant notes..." rows={4} />
                    </Field>
                </FormSection>

                {errors.submit && (
                    <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                        {errors.submit}
                    </div>
                )}
            </FormBody>

            <StickyFooter isDark={isDark} primaryAction="Create Deal" onCancel={onBack} isValid={isValid} />
        </FormShell>
    );
};

export default DealFormPage;

