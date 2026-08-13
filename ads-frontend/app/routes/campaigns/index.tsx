import { Link } from "react-router";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Search, Filter, SlidersHorizontal, MoreHorizontal, Plus } from "lucide-react";
import { ListShell } from "../../components/shared/ListShell";

export default function CampaignsIndex() {
  const tabs = [
    { id: "campaigns", label: "Campaigns", active: true },
    { id: "adgroups", label: "Ad Groups" },
    { id: "ads", label: "Ads" },
  ];

  const toolbarActions = (
    <>
      <div className="flex items-center gap-2">
        <Button asChild className="rounded-sm h-8 bg-primary hover:bg-primary/90">
          <Link to="/campaigns/create/objective">
            <Plus className="h-4 w-4 mr-1" /> Create
          </Link>
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
    <ListShell tabs={tabs} toolbarActions={toolbarActions} totalItems={2}>
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium w-10">
              <input type="checkbox" aria-label="Select all campaigns" className="rounded-sm border-slate-300 text-primary focus:ring-primary h-3 w-3" />
            </th>
            <th scope="col" className="px-4 py-3 font-medium min-w-[200px]">Campaign Name</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3 font-medium text-right">Cost</th>
            <th scope="col" className="px-4 py-3 font-medium text-right">CPC</th>
            <th scope="col" className="px-4 py-3 font-medium text-right">CPA</th>
            <th scope="col" className="px-4 py-3 font-medium text-right">Impressions</th>
            <th scope="col" className="px-4 py-3 font-medium text-right">Clicks</th>
            <th scope="col" className="px-4 py-3 font-medium text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
            <td className="px-4 py-3">
              <input type="checkbox" aria-label="Select Summer Collection Launch" className="rounded-sm border-slate-300 text-primary focus:ring-primary h-3 w-3" />
            </td>
            <td className="px-4 py-3">
              <div className="font-medium text-primary">Summer Collection Launch</div>
              <div className="text-xs text-muted-foreground">ID: 19284712</div>
            </td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                <span className="text-emerald-700 dark:text-emerald-400 font-medium text-xs">Active</span>
              </div>
            </td>
            <td className="px-4 py-3 text-right font-medium text-slate-800 dark:text-slate-200">$4,250.00</td>
            <td className="px-4 py-3 text-right">$0.45</td>
            <td className="px-4 py-3 text-right">$12.50</td>
            <td className="px-4 py-3 text-right">342,000</td>
            <td className="px-4 py-3 text-right">9,444</td>
            <td className="px-4 py-3 text-center">
              <Button variant="ghost" size="icon" aria-label="More actions for Summer Collection Launch" className="h-8 w-8 text-slate-400 hover:text-slate-800">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </td>
          </tr>
          <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
            <td className="px-4 py-3">
              <input type="checkbox" aria-label="Select Retargeting 30 Days" className="rounded-sm border-slate-300 text-primary focus:ring-primary h-3 w-3" />
            </td>
            <td className="px-4 py-3">
              <div className="font-medium text-primary">Retargeting 30 Days</div>
              <div className="text-xs text-muted-foreground">ID: 88471923</div>
            </td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-slate-300"></div>
                <span className="text-slate-600 font-medium text-xs">Paused</span>
              </div>
            </td>
            <td className="px-4 py-3 text-right font-medium text-slate-800 dark:text-slate-200">$1,100.50</td>
            <td className="px-4 py-3 text-right">$0.25</td>
            <td className="px-4 py-3 text-right">$8.10</td>
            <td className="px-4 py-3 text-right">85,000</td>
            <td className="px-4 py-3 text-right">4,402</td>
            <td className="px-4 py-3 text-center">
              <Button variant="ghost" size="icon" aria-label="More actions for Retargeting 30 Days" className="h-8 w-8 text-slate-400 hover:text-slate-800">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </ListShell>
  );
}
