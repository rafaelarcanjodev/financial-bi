import { loadMasterData } from "@/lib/loadMasterData";
import { Dashboard } from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await loadMasterData();
  return <Dashboard initialData={data} />;
}
