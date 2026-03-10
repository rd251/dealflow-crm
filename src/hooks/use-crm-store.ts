import { useState, useCallback } from "react";
import {
  Company, Contact, Deal, Task, NoteEntry,
  initialCompanies, initialContacts, initialDeals, initialTasks,
} from "@/data/crm-data";

function load<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch { return fallback; }
}

function save<T>(key: string, data: T) {
  localStorage.setItem(key, JSON.stringify(data));
}

export function useCrmStore() {
  const [companies, setCompanies] = useState<Company[]>(() => load("crm_companies", initialCompanies));
  const [contacts, setContacts] = useState<Contact[]>(() => load("crm_contacts", initialContacts));
  const [deals, setDeals] = useState<Deal[]>(() => load("crm_deals", initialDeals));
  const [tasks, setTasks] = useState<Task[]>(() => load("crm_tasks", initialTasks));

  const updateCompanies = useCallback((fn: (prev: Company[]) => Company[]) => {
    setCompanies(prev => { const next = fn(prev); save("crm_companies", next); return next; });
  }, []);

  const updateContacts = useCallback((fn: (prev: Contact[]) => Contact[]) => {
    setContacts(prev => { const next = fn(prev); save("crm_contacts", next); return next; });
  }, []);

  const updateDeals = useCallback((fn: (prev: Deal[]) => Deal[]) => {
    setDeals(prev => { const next = fn(prev); save("crm_deals", next); return next; });
  }, []);

  const updateTasks = useCallback((fn: (prev: Task[]) => Task[]) => {
    setTasks(prev => { const next = fn(prev); save("crm_tasks", next); return next; });
  }, []);

  const addNote = useCallback((contactId: string, note: Omit<NoteEntry, "id">) => {
    updateContacts(prev => prev.map(c =>
      c.id === contactId
        ? { ...c, notes: [...c.notes, { ...note, id: `NOTE-${Date.now()}` }] }
        : c
    ));
  }, [updateContacts]);

  const moveDealStage = useCallback((dealId: string, stage: Deal["stage"]) => {
    updateDeals(prev => prev.map(d =>
      d.id === dealId ? { ...d, stage, status: stage === "Won" ? "Won" : stage === "Lost" ? "Lost" : "Open", lastUpdated: new Date().toISOString().split("T")[0] } : d
    ));
  }, [updateDeals]);

  const toggleTask = useCallback((taskId: string) => {
    updateTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t));
  }, [updateTasks]);

  return {
    companies, contacts, deals, tasks,
    updateCompanies, updateContacts, updateDeals, updateTasks,
    addNote, moveDealStage, toggleTask,
  };
}
