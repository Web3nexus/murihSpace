import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Search, Filter, MoreHorizontal, Plus, Users } from "lucide-react";

export default function AudiencesIndex() {
  const [audiences, setAudiences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const advertiserId = typeof window !== 'undefined' ? localStorage.getItem('advertiser_id') || '1' : '1';

    fetch(`${import.meta.env.VITE_ADS_API_URL}/api/audiences`, {
      headers: {
        'Accept': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        'X-Advertiser-ID': String(advertiserId),
      }
    })
      .then(res => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then(result => {
        if (result.status === 'success') {
          setAudiences(result.data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch audiences', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-col gap-0 max-w-[1400px] mx-auto w-full h-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm">
      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-2 pt-2 bg-slate-50 dark:bg-slate-900/50">
        <div className="px-4 py-2 text-sm font-medium text-primary border-b-2 border-primary cursor-pointer">All Audiences</div>
        <div className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-slate-700 cursor-pointer">Custom Audiences</div>
        <div className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-slate-700 cursor-pointer">Lookalike Audiences</div>
      </div>
      
      {/* Control Bar */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Button render={<Link to="/audiences/create" />} className="rounded-sm h-8 bg-primary hover:bg-primary/90">
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
      <div className="overflow-x-auto min-h-[300px]">
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
              <th scope="col" className="px-4 py-3 font-medium text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading audiences...</td></tr>
            ) : audiences.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No audiences found.</td></tr>
            ) : (
              audiences.map((audience) => (
                <tr key={audience.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <td className="px-4 py-3">
                    <input type="checkbox" className="rounded-sm border-slate-300 text-primary focus:ring-primary h-3 w-3" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-primary flex items-center">
                      <Users className="h-4 w-4 mr-2 text-slate-400" />
                      {audience.name}
                    </div>
                    <div className="text-xs text-muted-foreground ml-6">ID: AUD-{audience.id}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{audience.type?.replaceAll('_', ' ') ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{audience.estimated_size?.toLocaleString() || 'Calculating...'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className={`h-2 w-2 rounded-full ${audience.status === 'ready' ? 'bg-emerald-500' : audience.status === 'failed' ? 'bg-rose-500' : 'bg-amber-500'}`}></div>
                      <span className={`font-medium text-xs capitalize ${audience.status === 'ready' ? 'text-emerald-700 dark:text-emerald-400' : audience.status === 'failed' ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>
                        {audience.status || 'Ready'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-800">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Footer */}
      <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-800 text-sm text-slate-500">
        <div>Total {audiences.length} items</div>
        <div className="flex items-center gap-4">
          <span>10 / page</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled>&lt;</Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0 bg-primary text-primary-foreground">1</Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled>&gt;</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
