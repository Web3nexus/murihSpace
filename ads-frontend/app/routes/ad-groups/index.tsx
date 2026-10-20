import { ManagePage } from "../../components/ads/manage-page";
import { LEVELS } from "../../lib/ads-levels";

export default function AdGroupsIndex() {
  return <ManagePage config={LEVELS["ad-groups"]} />;
}
