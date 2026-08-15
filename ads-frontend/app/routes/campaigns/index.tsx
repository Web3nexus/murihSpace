import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Search, Filter, SlidersHorizontal, MoreHorizontal, Plus, Loader2 } from "lucide-react";
import { ListShell } from "../../components/shared/ListShell";

export default function CampaignsIndex() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [adGroups, setAdGroups] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("campaigns");

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_ADS_API_URL}/api/campaigns`, {
        headers: {
          "Accept": "application/json",
          "X-Advertiser-ID": '1',
        }
      });
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
      }
    } catch (error) {
      console.error("Failed to fetch campaigns:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdGroups = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_ADS_API_URL}/api/ad-groups`, {
        headers: {
          "Accept": "application/json",
          "X-Advertiser-ID": '1',
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAdGroups(data);
      }
    } catch (error) {
      console.error("Failed to fetch ad groups:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAds = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_ADS_API_URL}/api/ads`, {
        headers: {
          "Accept": "application/json",
          "X-Advertiser-ID": '1',
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAds(data);
      }
    } catch (error) {
      console.error("Failed to fetch ads:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      if (activeTab === "campaigns") await fetchCampaigns();
      else if (activeTab === "adgroups") await fetchAdGroups();
      else if (activeTab === "ads") await fetchAds();
      if (active) setLoading(false);
    };
    load();
    return () => {
      active = false;
    };
  }, [activeTab]);

  const tabs = [
    { id: "campaigns", label: "Campaigns", active: activeTab === "campaigns" },
    { id: "adgroups", label: "Ad Groups", active: activeTab === "adgroups" },
    { id: "ads", label: "Ads", active: activeTab === "ads" },
  ];

  const toolbarActions = (
    <>
      <div className="flex items-center gap-2">
        <Button render={<Link to="/campaigns/create/objective" />} className="rounded-sm h-8 bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-1" /> Create
        </Button>
        <div className="h-4 w-px bg-slate-300 mx-2" />
        <Button variant="outline" size="sm" className="rounded-sm h-8">
          <Filter className="h-3 w-3 mr-2" /> Filter
        </Button>
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input 
            type="text" 
            placeholder="Search by name or ID" 
            aria-label="Search campaigns by name or ID"
            className="h-8 pl-8 w-[250px] rounded-sm bg-slate-50 dark:bg-slate-900 border-slate-200"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground">
          <SlidersHorizontal className="h-4 w-4 mr-2" /> Default Columns
        </Button>
      </div>
    </>
  );

  return (
    <ListShell 
      tabs={tabs} 
      onTabChange={setActiveTab}
      toolbarActions={toolbarActions} 
      totalItems={activeTab === "campaigns" ? campaigns.length : 0}
    >
      {activeTab === "campaigns" && (
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium w-10">
                <input type="checkbox" aria-label="Select all campaigns" className="rounded-sm border-slate-300 text-primary focus:ring-primary h-3 w-3" />
              </th>
              <th scope="col" className="px-4 py-3 font-medium min-w-[200px]">Campaign Name</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium text-right">Budget</th>
              <th scope="col" className="px-4 py-3 font-medium text-right">Cost</th>
              <th scope="col" className="px-4 py-3 font-medium text-right">Impressions</th>
              <th scope="col" className="px-4 py-3 font-medium text-right">Clicks</th>
              <th scope="col" className="px-4 py-3 font-medium text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading campaigns...
                </td>
              </tr>
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No campaigns found. Create one to get started.
                </td>
              </tr>
            ) : (
              campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <td className="px-4 py-3">
                    <input type="checkbox" aria-label={`Select ${campaign.name}`} className="rounded-sm border-slate-300 text-primary focus:ring-primary h-3 w-3" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-primary">{campaign.name}</div>
                    <div className="text-xs text-muted-foreground">ID: {campaign.id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className={`h-2 w-2 rounded-full ${
                        campaign.status === 'active' ? 'bg-emerald-500' :
                        campaign.status === 'paused' ? 'bg-slate-300' : 'bg-amber-500'
                      }`}></div>
                      <span className={`font-medium text-xs capitalize ${
                        campaign.status === 'active' ? 'text-emerald-700 dark:text-emerald-400' :
                        campaign.status === 'paused' ? 'text-slate-600' : 'text-amber-700 dark:text-amber-400'
                      }`}>
                        {campaign.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800 dark:text-slate-200">
                    ${(campaign.total_budget || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    ${(campaign.spent || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {campaign.impressions || 0}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {campaign.clicks || 0}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button variant="ghost" size="icon" aria-label={`More actions for ${campaign.name}`} className="h-8 w-8 text-slate-400 hover:text-slate-800">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {activeTab === "adgroups" && (
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium min-w-[200px]">Ad Group Name</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium text-right">Daily Budget</th>
              <th scope="col" className="px-4 py-3 font-medium text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading ad groups...</td></tr>
            ) : adGroups.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No ad groups found. Create a campaign to get started.</td></tr>
            ) : (
              adGroups.map((group) => (
                <tr key={group.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-primary">{group.name}</div>
                    <div className="text-xs text-muted-foreground">ID: {group.id}</div>
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600">{group.status}</td>
                  <td className="px-4 py-3 text-right">${(group.daily_budget / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-center"><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400"><MoreHorizontal className="h-4 w-4" /></Button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {activeTab === "ads" && (
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium min-w-[200px]">Ad Name</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
              <th scope="col" className="px-4 py-3 font-medium text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" /> Loading ads...</td></tr>
            ) : ads.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No ads found. Create a campaign to get started.</td></tr>
            ) : (
              ads.map((ad) => (
                <tr key={ad.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-primary">{ad.name}</div>
                    <div className="text-xs text-muted-foreground">ID: {ad.id}</div>
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600">{ad.status}</td>
                  <td className="px-4 py-3 text-center"><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400"><MoreHorizontal className="h-4 w-4" /></Button></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </ListShell>
  );
}
