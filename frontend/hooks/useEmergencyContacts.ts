'use client';

import { useState, useEffect, useCallback } from 'react';

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

const STORAGE_KEY = 'ss_emergency_contacts';
const MAX_CONTACTS = 3;

function load(): EmergencyContact[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useEmergencyContacts() {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setContacts(load());
    setLoaded(true);
  }, []);

  const persist = useCallback((next: EmergencyContact[]) => {
    setContacts(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const addContact = useCallback((name: string, phone: string) => {
    persist([
      ...load(),
      { id: Date.now().toString(), name, phone },
    ].slice(0, MAX_CONTACTS));
  }, [persist]);

  const removeContact = useCallback((id: string) => {
    persist(load().filter(c => c.id !== id));
  }, [persist]);

  return { contacts, loaded, addContact, removeContact, maxContacts: MAX_CONTACTS };
}
