import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Search, Filter, MoreHorizontal, Plus, Users } from "lucide-react";

export default function AudiencesIndex() {
  return (
    <div className="flex flex-col gap-0 max-w-[1400px] mx-auto w-full h-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm">
      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-2 pt-2 bg-slate-50 dark:bg-slate-900/50">
        <div className="px-4 py-2 text-sm font-medium text-primary border-b-2 border-primary cursor-pointer">All Audiences</div>
        <div className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-slate-700 cursor-pointer">Custom Audiences</div>
        <div className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-slate-700 cursor-pointer">Lookalike Audiences</div>
        <div className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-slate-700 cursor-pointer">Saved Audiences</div>
      </div>
      
      {/* Control Bar */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Button className="rounded-sm h-8 bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-1" /> Create Audience
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
              className="h-8 pl-8 w-[250px] rounded-sm bg-slate-50 dark:bg-slate-900 border-slate-200"
            />
          </div>
        </div>
      </div>
      
      {/* Dense Data Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium w-10">
                <input type="checkbox" aria-label="Select all audiences" className="rounded-sm border-slate-300 text-primary focus:ring-primary h-3 w-3" />
              </th>
              <th scope="col" className="px-4 py-3 font-medium min-w-[200px]">Audience Name</th>
              <th scope="col" className="px-4 py-3 font-medium">Type</th>
              <th scope="col" className="px-4 py-3 font-medium">Size Estimate</th>
              <th scope="col" className="px-4 py-3 font-medium">Availability</th>
              <th scope="col" className="px-4 py-3 font-medium">Date Created</th>
              <th scope="col" className="px-4 py-3 font-medium text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
              <td className="px-4 py-3">
                <input type="checkbox" aria-label="Select Website Visitors (30 Days)" className="rounded-sm border-slate-300 text-primary focus:ring-primary h-3 w-3" />
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-primary flex items-center">
                  <Users className="h-4 w-4 mr-2 text-slate-400" />
                  Website Visitors (30 Days)
                </div>
                <div className="text-xs text-muted-foreground ml-6">ID: AUD-91283</div>
              </td>
              <td className="px-4 py-3 text-slate-600">Custom Audience</td>
              <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">15,000 - 20,000</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium text-xs">Ready</span>
                </div>
              </td>
              <td className="px-4 py-3 text-slate-500">Aug 10, 2026</td>
              <td className="px-4 py-3 text-center">
                <Button variant="ghost" size="icon" aria-label="More actions for Website Visitors (30 Days)" className="h-8 w-8 text-slate-400 hover:text-slate-800">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </td>
            </tr>
            <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
              <td className="px-4 py-3">
                <input type="checkbox" aria-label="Select 1% LAL - Purchasers" className="rounded-sm border-slate-300 text-primary focus:ring-primary h-3 w-3" />
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-primary flex items-center">
                  <Users className="h-4 w-4 mr-2 text-slate-400" />
                  1% LAL - Purchasers
                </div>
                <div className="text-xs text-muted-foreground ml-6">ID: AUD-74821</div>
              </td>
              <td className="px-4 py-3 text-slate-600">Lookalike Audience</td>
              <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">2,100,000</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                  <span className="text-amber-700 dark:text-amber-400 font-medium text-xs">Populating</span>
                </div>
              </td>
              <td className="px-4 py-3 text-slate-500">Aug 12, 2026</td>
              <td className="px-4 py-3 text-center">
                <Button variant="ghost" size="icon" aria-label="More actions for 1% LAL - Purchasers" className="h-8 w-8 text-slate-400 hover:text-slate-800">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* Pagination Footer */}
      <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-500">
        <div>Total 2 items</div>
        <div className="flex items-center gap-4">
          <span>10 / page</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled>&lt;</Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0 bg-primary text-primary-foreground">1</Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0">&gt;</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
