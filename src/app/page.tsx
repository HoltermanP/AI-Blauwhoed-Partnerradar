import seed from "@/data/houtbouwers-seed.json";
import PartnerApp from "@/components/PartnerApp";
import type { PartnerDataset } from "@/lib/types";

export default function Home() {
  return <PartnerApp initialDataset={seed as PartnerDataset} />;
}
