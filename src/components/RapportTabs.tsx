import { useNavigate } from "react-router-dom";
import { BarChart3, Building2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const fane = "gap-2 rounded-none border-b-2 border-transparent px-3 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none";

export default function RapportTabs({ value }: { value: "rapporter" | "portefolje" }) {
  const navigate = useNavigate();
  return (
    <Tabs value={value} onValueChange={tab => navigate(`/${tab}`)} className="mb-6">
      <TabsList aria-label="Rapporter" className="h-auto w-full justify-start gap-4 rounded-none border-b bg-transparent p-0">
        <TabsTrigger value="rapporter" className={fane}><BarChart3 className="h-4 w-4" />Rapporter</TabsTrigger>
        <TabsTrigger value="portefolje" className={fane}><Building2 className="h-4 w-4" />Portefølje</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
