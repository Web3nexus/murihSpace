import { ManagePage } from "../../components/ads/manage-page";
import { LEVELS } from "../../lib/ads-levels";

export default function CampaignsIndex() {
  return <ManagePage config={LEVELS.campaigns} />;
}
