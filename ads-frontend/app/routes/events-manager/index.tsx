import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Search, Plus, Activity, Code, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";

export default function EventsManagerIndex() {
  const [pixels, setPixels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Create pixel state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newPixelName, setNewPixelName] = useState("");
  const [newPixelDomain, setNewPixelDomain] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchPixels();
  }, []);

  const fetchPixels = () => {
    setLoading(true);
    fetch(`${import.meta.env.VITE_ADS_API_URL}/api/pixels`, {
      headers: { 
        'Accept': 'application/json',
        'X-Advertiser-ID': '1'
      }
    })
      .then(res => res.json())
      .then(result => {
        if (result.status === 'success') {
          setPixels(result.data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch pixels', err);
        setLoading(false);
      });
  };

  const handleCreatePixel = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_ADS_API_URL}/api/pixels`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Advertiser-ID': '1'
        },
        body: JSON.stringify({
          advertiser_id: 1,
          name: newPixelName,
          domain: newPixelDomain
        })
      });
      const result = await res.json();
      if (result.status === 'success') {
        setIsCreateOpen(false);
        setNewPixelName("");
        setNewPixelDomain("");
        fetchPixels();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-0 max-w-[1400px] mx-auto w-full h-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Data Sources</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your tracking pixels and view incoming events.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger render={<Button className="rounded-sm bg-primary hover:bg-primary/90" />}>
            <Plus className="h-4 w-4 mr-2" /> Connect Data Source
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create a New Pixel</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreatePixel} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="pixel-name">Pixel Name</Label>
                <Input 
                  id="pixel-name" 
                  placeholder="e.g. Main Website Pixel" 
                  value={newPixelName}
                  onChange={e => setNewPixelName(e.target.value)}
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pixel-domain">Domain URL</Label>
                <Input 
                  id="pixel-domain" 
                  placeholder="https://example.com" 
                  value={newPixelDomain}
                  onChange={e => setNewPixelDomain(e.target.value)}
                  required 
                />
              </div>
              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating..." : "Create Pixel"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Control Bar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="text" 
            placeholder="Search pixels..." 
            className="pl-8 bg-slate-50 dark:bg-slate-900 border-slate-200"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50 dark:bg-slate-900/20 min-h-[400px]">
        {loading ? (
          <div className="col-span-full text-center text-slate-500 py-12">Loading data sources...</div>
        ) : pixels.length === 0 ? (
          <div className="col-span-full text-center text-slate-500 py-12">
            No data sources connected yet. Click "Connect Data Source" to get started.
          </div>
        ) : (
          pixels.map((pixel) => (
            <div key={pixel.id} className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Code className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-900 dark:text-slate-50">{pixel.name}</h3>
                    <p className="text-xs text-slate-500">ID: {pixel.pixel_uuid}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Active</span>
                </div>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Domain</span>
                  <span className="font-medium">{pixel.domain}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Total Events</span>
                  <span className="font-medium">{pixel.total_events || 0}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" className="w-full" render={<Link to={`/events-manager/${pixel.id}`} />}>
                  <Activity className="h-4 w-4 mr-2" /> View Events
                </Button>
                <Button variant="ghost" size="icon" className="shrink-0 text-slate-400">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
