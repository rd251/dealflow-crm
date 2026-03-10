export type DealStage = "New Lead" | "Contacted" | "Proposal Sent" | "Won" | "Lost";
export type CustomerStatus = "Lead" | "Prospect" | "Not Live" | "Live" | "Cancelled";
export type Priority = "Low" | "Normal" | "High" | "Urgent";
export type Segment = "SMB" | "Enterprise" | "Partner" | "Restaurant" | "Helse" | "Kommune";

export interface Company {
  id: string;
  name: string;
  useCase: string;
  segment: Segment;
  status: CustomerStatus;
  contactCount: number;
  pricePerMonth: number;
  baseMRR: number;
  liveMRR: number;
  arr: number;
  setupFee: number;
  notes: string;
}

export interface Contact {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  source: string;
  notes: NoteEntry[];
}

export interface Deal {
  id: string;
  companyId: string;
  companyName: string;
  useCase: string;
  segment: Segment;
  stage: DealStage;
  probability: number;
  expectedMRR: number;
  weightedMRR: number;
  expectedCloseDate: string;
  status: "Open" | "Won" | "Lost";
  priority: Priority;
  lastUpdated: string;
  notes: string;
}

export interface NoteEntry {
  id: string;
  date: string;
  content: string;
  type: "call" | "email" | "meeting" | "note";
}

export interface Task {
  id: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
  title: string;
  description: string;
  dueDate: string;
  completed: boolean;
  priority: Priority;
  reminder: boolean;
}

export const initialCompanies: Company[] = [
  { id: "ACC-0001", name: "Jobbkort AS", useCase: "Outbound Info agent", segment: "SMB", status: "Not Live", contactCount: 1, pricePerMonth: 990, baseMRR: 990, liveMRR: 0, arr: 0, setupFee: 0, notes: "" },
  { id: "ACC-0002", name: "Sporty Norge AS", useCase: "Support agent", segment: "SMB", status: "Live", contactCount: 1, pricePerMonth: 12990, baseMRR: 12990, liveMRR: 12990, arr: 155880, setupFee: 15000, notes: "" },
  { id: "ACC-0003", name: "Protect Vakthold og Sikkerhet Sande AS", useCase: "Support agent", segment: "SMB", status: "Live", contactCount: 1, pricePerMonth: 2999, baseMRR: 2999, liveMRR: 2999, arr: 35988, setupFee: 5000, notes: "" },
  { id: "ACC-0004", name: "Uni Micro AS", useCase: "Support agent", segment: "Enterprise", status: "Live", contactCount: 1, pricePerMonth: 12900, baseMRR: 12900, liveMRR: 12900, arr: 154800, setupFee: 43700, notes: "" },
  { id: "ACC-0005", name: "Gastro Planner AS", useCase: "Restaurant agenter", segment: "Partner", status: "Not Live", contactCount: 1, pricePerMonth: 0, baseMRR: 0, liveMRR: 0, arr: 0, setupFee: 0, notes: "" },
  { id: "ACC-0006", name: "RSA", useCase: "Internt system rapportering", segment: "Enterprise", status: "Not Live", contactCount: 1, pricePerMonth: 12900, baseMRR: 12900, liveMRR: 0, arr: 0, setupFee: 4999, notes: "" },
  { id: "ACC-0007", name: "Trenogmat AS", useCase: "Support agent", segment: "SMB", status: "Not Live", contactCount: 1, pricePerMonth: 2999, baseMRR: 2999, liveMRR: 0, arr: 0, setupFee: 13997, notes: "" },
  { id: "ACC-0008", name: "Innlandet Legesenter AS", useCase: "Resepsjonist", segment: "Helse", status: "Not Live", contactCount: 1, pricePerMonth: 12900, baseMRR: 12900, liveMRR: 0, arr: 0, setupFee: 10300, notes: "" },
  { id: "ACC-0009", name: "Drifti AS", useCase: "Support og salgs agent", segment: "SMB", status: "Not Live", contactCount: 1, pricePerMonth: 12900, baseMRR: 12900, liveMRR: 0, arr: 0, setupFee: 5000, notes: "" },
  { id: "ACC-0010", name: "LP RESTAURANTDRIFT AS", useCase: "Matbestilling", segment: "Restaurant", status: "Not Live", contactCount: 1, pricePerMonth: 2999, baseMRR: 2999, liveMRR: 0, arr: 0, setupFee: 8997, notes: "" },
  { id: "ACC-0011", name: "Belron Solutions AS", useCase: "Booking system", segment: "Enterprise", status: "Not Live", contactCount: 1, pricePerMonth: 5990, baseMRR: 5990, liveMRR: 0, arr: 0, setupFee: 0, notes: "" },
  { id: "ACC-0012", name: "Outwork AS", useCase: "Møte booking", segment: "SMB", status: "Not Live", contactCount: 1, pricePerMonth: 12900, baseMRR: 12900, liveMRR: 0, arr: 0, setupFee: 12900, notes: "" },
  { id: "ACC-0013", name: "Nimbus Direct AS", useCase: "Outbound Info agent", segment: "Enterprise", status: "Live", contactCount: 1, pricePerMonth: 12900, baseMRR: 12900, liveMRR: 12900, arr: 154800, setupFee: 24500, notes: "" },
  { id: "ACC-0014", name: "Vanylven Kommune", useCase: "Resepsjonist", segment: "Kommune", status: "Live", contactCount: 1, pricePerMonth: 12900, baseMRR: 12900, liveMRR: 12900, arr: 154800, setupFee: 0, notes: "" },
  { id: "ACC-0015", name: "Nordic BIM Group", useCase: "Support agent", segment: "Enterprise", status: "Live", contactCount: 1, pricePerMonth: 12900, baseMRR: 12900, liveMRR: 12900, arr: 154800, setupFee: 49000, notes: "" },
  { id: "ACC-0016", name: "USA kunde (navn mangler)", useCase: "Support agent", segment: "SMB", status: "Live", contactCount: 1, pricePerMonth: 990, baseMRR: 990, liveMRR: 990, arr: 11880, setupFee: 0, notes: "" },
  { id: "ACC-0017", name: "Defigo AS", useCase: "Support agent", segment: "SMB", status: "Live", contactCount: 1, pricePerMonth: 10000, baseMRR: 10000, liveMRR: 10000, arr: 120000, setupFee: 98000, notes: "" },
  { id: "ACC-0018", name: "Fair Collection AS", useCase: "Support agent", segment: "Enterprise", status: "Not Live", contactCount: 1, pricePerMonth: 80000, baseMRR: 80000, liveMRR: 0, arr: 0, setupFee: 80000, notes: "" },
  { id: "ACC-0019", name: "BOB Trafikkskole AS", useCase: "Chatbot", segment: "SMB", status: "Not Live", contactCount: 1, pricePerMonth: 990, baseMRR: 990, liveMRR: 0, arr: 0, setupFee: 5000, notes: "" },
  { id: "ACC-0020", name: "Zen Finans AS", useCase: "Support agent og salg", segment: "Enterprise", status: "Not Live", contactCount: 1, pricePerMonth: 92900, baseMRR: 92900, liveMRR: 0, arr: 0, setupFee: 60000, notes: "" },
  { id: "ACC-0021", name: "Eger Group", useCase: "Support agent", segment: "SMB", status: "Not Live", contactCount: 0, pricePerMonth: 0, baseMRR: 0, liveMRR: 0, arr: 0, setupFee: 0, notes: "" },
  { id: "ACC-0022", name: "FF Rollerskis AS", useCase: "Support agent og chatbot", segment: "SMB", status: "Live", contactCount: 1, pricePerMonth: 990, baseMRR: 990, liveMRR: 990, arr: 11880, setupFee: 0, notes: "" },
];

export const initialDeals: Deal[] = [
  { id: "DEAL-0001", companyId: "ACC-0001", companyName: "Jobbkort AS", useCase: "Outbound Info agent", segment: "SMB", stage: "Proposal Sent", probability: 100, expectedMRR: 990, weightedMRR: 990, expectedCloseDate: "2026-04-15", status: "Open", priority: "Normal", lastUpdated: "2026-03-09", notes: "Importert fra Pipeline" },
  { id: "DEAL-0002", companyId: "ACC-0005", companyName: "Gastro Planner AS", useCase: "Restaurant agenter", segment: "Partner", stage: "Contacted", probability: 50, expectedMRR: 0, weightedMRR: 0, expectedCloseDate: "2026-05-01", status: "Open", priority: "Normal", lastUpdated: "2026-03-09", notes: "Importert fra Pipeline" },
  { id: "DEAL-0003", companyId: "ACC-0006", companyName: "RSA", useCase: "Internt system rapportering", segment: "Enterprise", stage: "Contacted", probability: 50, expectedMRR: 12900, weightedMRR: 6450, expectedCloseDate: "2026-04-30", status: "Open", priority: "Normal", lastUpdated: "2026-03-09", notes: "Importert fra Pipeline" },
  { id: "DEAL-0004", companyId: "ACC-0007", companyName: "Trenogmat AS", useCase: "Support agent", segment: "SMB", stage: "Contacted", probability: 50, expectedMRR: 2999, weightedMRR: 1500, expectedCloseDate: "2026-04-20", status: "Open", priority: "Normal", lastUpdated: "2026-03-09", notes: "Importert fra Pipeline" },
  { id: "DEAL-0005", companyId: "ACC-0008", companyName: "Innlandet Legesenter AS", useCase: "Resepsjonist", segment: "Helse", stage: "Contacted", probability: 50, expectedMRR: 12900, weightedMRR: 6450, expectedCloseDate: "2026-04-25", status: "Open", priority: "Normal", lastUpdated: "2026-03-09", notes: "Importert fra Pipeline" },
  { id: "DEAL-0006", companyId: "ACC-0009", companyName: "Drifti AS", useCase: "Support og salgs agent", segment: "SMB", stage: "Proposal Sent", probability: 100, expectedMRR: 12900, weightedMRR: 12900, expectedCloseDate: "2026-04-10", status: "Open", priority: "High", lastUpdated: "2026-03-09", notes: "Importert fra Pipeline" },
  { id: "DEAL-0007", companyId: "ACC-0010", companyName: "LP RESTAURANTDRIFT AS", useCase: "Matbestilling", segment: "Restaurant", stage: "Contacted", probability: 50, expectedMRR: 2999, weightedMRR: 1500, expectedCloseDate: "2026-05-15", status: "Open", priority: "Normal", lastUpdated: "2026-03-09", notes: "Normalisert ved import" },
  { id: "DEAL-0008", companyId: "ACC-0011", companyName: "Belron Solutions AS", useCase: "Booking system", segment: "Enterprise", stage: "Contacted", probability: 50, expectedMRR: 5990, weightedMRR: 2995, expectedCloseDate: "2026-05-01", status: "Open", priority: "Normal", lastUpdated: "2026-03-09", notes: "Importert fra Pipeline" },
  { id: "DEAL-0009", companyId: "ACC-0012", companyName: "Outwork AS", useCase: "Møte booking", segment: "SMB", stage: "Proposal Sent", probability: 100, expectedMRR: 12900, weightedMRR: 12900, expectedCloseDate: "2026-04-05", status: "Open", priority: "High", lastUpdated: "2026-03-09", notes: "Importert fra Pipeline" },
  { id: "DEAL-0010", companyId: "ACC-0018", companyName: "Fair Collection AS", useCase: "Support agent", segment: "Enterprise", stage: "Contacted", probability: 50, expectedMRR: 80000, weightedMRR: 40000, expectedCloseDate: "2026-06-01", status: "Open", priority: "High", lastUpdated: "2026-03-09", notes: "Importert fra Pipeline" },
  { id: "DEAL-0011", companyId: "ACC-0019", companyName: "BOB Trafikkskole AS", useCase: "Chatbot", segment: "SMB", stage: "New Lead", probability: 50, expectedMRR: 990, weightedMRR: 495, expectedCloseDate: "2026-05-20", status: "Open", priority: "Low", lastUpdated: "2026-03-09", notes: "Importert fra Pipeline" },
  { id: "DEAL-0012", companyId: "ACC-0020", companyName: "Zen Finans AS", useCase: "Support agent og salg", segment: "Enterprise", stage: "Contacted", probability: 50, expectedMRR: 92900, weightedMRR: 46450, expectedCloseDate: "2026-06-15", status: "Open", priority: "High", lastUpdated: "2026-03-09", notes: "Importert fra Pipeline" },
];

export const initialContacts: Contact[] = [
  { id: "CON-0001", companyId: "ACC-0002", name: "Lars Hansen", email: "lars@sportynorge.no", phone: "+47 900 11 222", role: "CEO", source: "Referral", notes: [] },
  { id: "CON-0002", companyId: "ACC-0004", name: "Maria Olsen", email: "maria@unimicro.no", phone: "+47 900 33 444", role: "CTO", source: "Website", notes: [] },
  { id: "CON-0003", companyId: "ACC-0013", name: "Erik Johansen", email: "erik@nimbusdirect.no", phone: "+47 900 55 666", role: "Head of Sales", source: "LinkedIn", notes: [] },
  { id: "CON-0004", companyId: "ACC-0015", name: "Kari Nordmann", email: "kari@nordicbim.no", phone: "+47 900 77 888", role: "IT Manager", source: "Conference", notes: [] },
  { id: "CON-0005", companyId: "ACC-0017", name: "Thomas Berg", email: "thomas@defigo.no", phone: "+47 900 99 000", role: "CEO", source: "Cold Outreach", notes: [] },
  { id: "CON-0006", companyId: "ACC-0018", name: "Anne Kristiansen", email: "anne@faircollection.no", phone: "+47 901 11 222", role: "COO", source: "Referral", notes: [] },
  { id: "CON-0007", companyId: "ACC-0020", name: "Petter Svendsen", email: "petter@zenfinans.no", phone: "+47 901 33 444", role: "CTO", source: "LinkedIn", notes: [] },
  { id: "CON-0008", companyId: "ACC-0009", name: "Silje Dahl", email: "silje@drifti.no", phone: "+47 901 55 666", role: "Founder", source: "Website", notes: [] },
  { id: "CON-0009", companyId: "ACC-0014", name: "Olav Moen", email: "olav@vanylven.kommune.no", phone: "+47 901 77 888", role: "IT Lead", source: "Referral", notes: [] },
  { id: "CON-0010", companyId: "ACC-0001", name: "Henrik Lie", email: "henrik@jobbkort.no", phone: "+47 901 99 000", role: "CEO", source: "Cold Outreach", notes: [] },
];

export const initialTasks: Task[] = [
  { id: "TASK-0001", companyId: "ACC-0009", dealId: "DEAL-0006", title: "Follow up Drifti AS proposal", description: "Check if they reviewed the proposal and schedule a meeting", dueDate: "2026-03-12", completed: false, priority: "High", reminder: true },
  { id: "TASK-0002", companyId: "ACC-0012", dealId: "DEAL-0009", title: "Send contract to Outwork AS", description: "Prepare and send final contract draft", dueDate: "2026-03-14", completed: false, priority: "High", reminder: true },
  { id: "TASK-0003", companyId: "ACC-0018", dealId: "DEAL-0010", title: "Demo for Fair Collection", description: "Prepare custom demo for enterprise support agent use case", dueDate: "2026-03-18", completed: false, priority: "Urgent", reminder: true },
  { id: "TASK-0004", companyId: "ACC-0020", dealId: "DEAL-0012", title: "Follow up Zen Finans meeting", description: "Send meeting notes and next steps", dueDate: "2026-03-15", completed: false, priority: "High", reminder: true },
  { id: "TASK-0005", companyId: "ACC-0001", dealId: "DEAL-0001", title: "Jobbkort onboarding prep", description: "Prepare onboarding materials for Jobbkort integration", dueDate: "2026-03-20", completed: false, priority: "Normal", reminder: false },
];
