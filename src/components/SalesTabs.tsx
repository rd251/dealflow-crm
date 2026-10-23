import { useNavigate } from "react-router-dom";
import { Users2, Handshake } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SalesTabs({ value }: { value: "leads" | "salgsmuligheter" }) {
  const navigate = useNavigate();
  return (
    <Tabs value={value} onValueChange={tab => navigate(`/${tab}`)} className="mb-6">
      <TabsList aria-label="Leads og salg" className="h-auto gap-4 rounded-none border-b bg-transparent p-0 w-full justify-start">
        <TabsTrigger value="leads" className="gap-2 rounded-none border-b-2 border-transparent px-3 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"><Users2 className="h-4 w-4" />Leads</TabsTrigger>
        <TabsTrigger value="salgsmuligheter" className="gap-2 rounded-none border-b-2 border-transparent px-3 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"><Handshake className="h-4 w-4" />Salgsmuligheter</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}