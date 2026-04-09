import React, { createContext, useContext, useState, ReactNode } from 'react';
import { EmploymentProfile, Department, CreateEmploymentPayload } from '../types/hrm';

interface HRMContextType {
    employmentProfiles: EmploymentProfile[];
    departments: Department[];
    getEmploymentByPersonId: (personId: string) => EmploymentProfile | undefined;
    getEmploymentProfile: (id: string) => EmploymentProfile | undefined;
    getDepartment: (id: string) => Department | undefined;
    createEmploymentProfile: (payload: CreateEmploymentPayload) => EmploymentProfile;
    updateEmploymentProfile: (id: string, payload: Partial<EmploymentProfile>) => void;
    deactivateEmploymentProfile: (id: string) => void;
}

const HRMContext = createContext<HRMContextType | undefined>(undefined);

export const HRMProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const initialDepartments: Department[] = [];
    const initialProfiles: EmploymentProfile[] = [];

    const [departments] = useState<Department[]>(initialDepartments);
    const [employmentProfiles, setEmploymentProfiles] = useState<EmploymentProfile[]>(initialProfiles);

    const getEmploymentByPersonId = (personId: string) => {
        return employmentProfiles.find(p => p.personId === personId);
    };

    const getEmploymentProfile = (id: string) => {
        return employmentProfiles.find(p => p.id === id);
    };

    const getDepartment = (id: string) => {
        return departments.find(d => d.id === id);
    };

    const createEmploymentProfile = (payload: CreateEmploymentPayload): EmploymentProfile => {
        const newProfile: EmploymentProfile = {
            id: `emp-${Date.now()}`,
            personId: payload.personId,
            employeeCode: payload.employeeCode,
            employmentType: payload.employmentType,
            status: payload.status || 'active',
            roleTitle: payload.roleTitle,
            departmentId: payload.departmentId,
            managerPersonId: payload.managerPersonId,
            startDate: payload.startDate,
            workLocation: payload.workLocation,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            authorityLevel: payload.authorityLevel || 'OBSERVER'
        };

        setEmploymentProfiles(prev => [...prev, newProfile]);
        return newProfile;
    };

    const updateEmploymentProfile = (id: string, payload: Partial<EmploymentProfile>) => {
        setEmploymentProfiles(prev => prev.map(profile => {
            if (profile.id === id) {
                return {
                    ...profile,
                    ...payload,
                    updatedAt: new Date().toISOString(),
                    authorityLevel: payload.authorityLevel ?? profile.authorityLevel ?? 'OBSERVER'
                };
            }
            return profile;
        }));
    };

    const deactivateEmploymentProfile = (id: string) => {
        setEmploymentProfiles(prev => prev.map(profile => {
            if (profile.id === id) {
                return {
                    ...profile,
                    status: 'inactive',
                    updatedAt: new Date().toISOString(),
                    authorityLevel: profile.authorityLevel ?? 'OBSERVER'
                };
            }
            return profile;
        }));
    };

    return (
        <HRMContext.Provider value={{
            employmentProfiles,
            departments,
            getEmploymentByPersonId,
            getEmploymentProfile,
            getDepartment,
            createEmploymentProfile,
            updateEmploymentProfile,
            deactivateEmploymentProfile
        }}>
            {children}
        </HRMContext.Provider>
    );
};

export const useHRM = () => {
    const context = useContext(HRMContext);
    if (!context) {
        throw new Error('useHRM must be used within an HRMProvider');
    }
    return context;
};

