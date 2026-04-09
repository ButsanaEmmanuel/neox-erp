import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Person, CreatePersonPayload, UpdatePersonPayload } from '../types/person';

interface PeopleContextType {
  people: Person[];
  getPerson: (id: string) => Person | undefined;
  getPeopleByCompany: (companyId: string) => Person[];
  createPerson: (payload: CreatePersonPayload) => Person;
  updatePerson: (payload: UpdatePersonPayload) => void;
  deletePerson: (id: string) => void;
}

const PeopleContext = createContext<PeopleContextType | undefined>(undefined);

const getPersonInitials = (name: string): string => {
  const names = name.trim().split(/\s+/).filter(Boolean);
  if (names.length === 0) return 'NA';
  return names.map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export const PeopleProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [people, setPeople] = useState<Person[]>([]);

  const getPerson = (id: string): Person | undefined => people.find(p => p.id === id);

  const getPeopleByCompany = (companyId: string): Person[] => people.filter(p => p.primaryCompanyId === companyId);

  const createPerson = (payload: CreatePersonPayload): Person => {
    const newPerson: Person = {
      id: `person_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      initials: getPersonInitials(payload.name),
      primaryCompanyId: payload.primaryCompanyId,
      primaryCompany: payload.primaryCompanyId ? { id: payload.primaryCompanyId, name: '', initials: '' } : undefined,
      stage: payload.stage || 'Discovery',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setPeople(prev => [...prev, newPerson]);
    return newPerson;
  };

  const updatePerson = (payload: UpdatePersonPayload): void => {
    setPeople(prev =>
      prev.map(person => {
        if (person.id !== payload.id) return person;
        return {
          ...person,
          ...(payload.name && { name: payload.name, initials: getPersonInitials(payload.name) }),
          ...(payload.email !== undefined && { email: payload.email }),
          ...(payload.phone !== undefined && { phone: payload.phone }),
          ...(payload.primaryCompanyId !== undefined && { primaryCompanyId: payload.primaryCompanyId }),
          ...(payload.stage !== undefined && { stage: payload.stage }),
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const deletePerson = (id: string): void => {
    setPeople(prev => prev.filter(person => person.id !== id));
  };

  return (
    <PeopleContext.Provider value={{ people, getPerson, getPeopleByCompany, createPerson, updatePerson, deletePerson }}>
      {children}
    </PeopleContext.Provider>
  );
};

export const usePeople = (): PeopleContextType => {
  const context = useContext(PeopleContext);
  if (!context) {
    throw new Error('usePeople must be used within a PeopleProvider');
  }
  return context;
};
