import { useState } from "react";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search, Phone, Mail, MessageSquare, Calendar, FileText, PhoneCall } from "lucide-react";
import { Contact, NoteEntry } from "@/data/crm-data";

const noteTypeIcons = { call: PhoneCall, email: Mail, meeting: Calendar, note: FileText };

export default function Contacts() {
  const { contacts, companies, updateContacts, addNote } = useCrmStore();
  const [search, setSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState<NoteEntry["type"]>("note");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "", source: "", companyId: "" });

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())
  );

  const getCompanyName = (companyId: string) => companies.find(c => c.id === companyId)?.name || "Unknown";

  const handleAddNote = () => {
    if (!selectedContact || !noteText.trim()) return;
    addNote(selectedContact.id, { date: new Date().toISOString().split("T")[0], content: noteText, type: noteType });
    setNoteText("");
    setSelectedContact(contacts.find(c => c.id === selectedContact.id) || selectedContact);
  };

  const addContact = () => {
    const id = `CON-${String(contacts.length + 1).padStart(4, "0")}`;
    updateContacts(prev => [...prev, { id, ...form, notes: [] }]);
    setAddDialogOpen(false);
    setForm({ name: "", email: "", phone: "", role: "", source: "", companyId: "" });
  };

  // Re-fetch selected contact from state
  const currentContact = selectedContact ? contacts.find(c => c.id === selectedContact.id) || selectedContact : null;

  return (
    <PageShell
      title="Contacts"
      subtitle={`${contacts.length} contacts`}
      actions={
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Add Contact</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Contact</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Full name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <Input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              <Input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Role" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
                <Input placeholder="Source" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} />
              </div>
              <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background" value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}>
                <option value="">Select company</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Button onClick={addContact} className="w-full" disabled={!form.name}>Create Contact</Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search contacts..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Company</th>
                <th className="text-left px-4 py-3 font-medium">Role</th>
                <th className="text-left px-4 py-3 font-medium">Source</th>
                <th className="text-left px-4 py-3 font-medium">Contact</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr
                  key={c.id}
                  className={`border-b last:border-0 cursor-pointer transition-colors ${currentContact?.id === c.id ? "bg-primary/5" : "hover:bg-muted/30"}`}
                  onClick={() => setSelectedContact(c)}
                >
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{getCompanyName(c.companyId)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.role}</td>
                  <td className="px-4 py-3"><span className="text-xs bg-secondary px-2 py-0.5 rounded-full">{c.source}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-3.5 h-3.5" />
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-card border rounded-xl p-5">
          {currentContact ? (
            <div>
              <h3 className="font-semibold text-lg">{currentContact.name}</h3>
              <p className="text-sm text-muted-foreground">{currentContact.role} at {getCompanyName(currentContact.companyId)}</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" />{currentContact.email}</div>
                <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" />{currentContact.phone}</div>
              </div>

              <div className="mt-6">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4" />Notes Log</h4>
                <div className="space-y-2 mb-4 max-h-60 overflow-y-auto scrollbar-thin">
                  {currentContact.notes.length === 0 && <p className="text-sm text-muted-foreground italic">No notes yet</p>}
                  {currentContact.notes.map(n => {
                    const Icon = noteTypeIcons[n.type];
                    return (
                      <div key={n.id} className="p-2.5 bg-muted/50 rounded-lg text-sm">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <Icon className="w-3 h-3" />
                          <span className="capitalize">{n.type}</span>
                          <span>·</span>
                          <span>{n.date}</span>
                        </div>
                        <p>{n.content}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    {(["note", "call", "email", "meeting"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setNoteType(t)}
                        className={`text-xs px-2 py-1 rounded-full capitalize transition-colors ${noteType === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <Textarea placeholder="Add a note..." value={noteText} onChange={e => setNoteText(e.target.value)} className="text-sm min-h-[60px]" />
                  <Button size="sm" onClick={handleAddNote} disabled={!noteText.trim()} className="w-full">Add Note</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-10">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Select a contact to view details</p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function Users(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
