import { ManagePage } from "../../components/ads/manage-page";
import { LEVELS } from "../../lib/ads-levels";

export default function AdsIndex() {
  return <ManagePage config={LEVELS.ads} />;
}
