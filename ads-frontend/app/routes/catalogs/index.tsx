import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Search, Plus, ShoppingBag, Store, MoreHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";

export default function CatalogsIndex() {
  const [catalogs, setCatalogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Create catalog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCatalogName, setNewCatalogName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchCatalogs();
  }, []);

  const fetchCatalogs = () => {
    setLoading(true);
    fetch(`${import.meta.env.VITE_ADS_API_URL}/api/catalogs`, {
      headers: { 
        'Accept': 'application/json',
        'X-Advertiser-ID': '1'
      }
    })
      .then(res => res.json())
      .then(result => {
        if (result.status === 'success') {
          setCatalogs(result.data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch catalogs', err);
        setLoading(false);
      });
  };

  const handleCreateCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_ADS_API_URL}/api/catalogs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Advertiser-ID': '1'
        },
        body: JSON.stringify({
          advertiser_id: 1,
          name: newCatalogName
        })
      });
      const result = await res.json();
      if (result.status === 'success') {
        setIsCreateOpen(false);
        setNewCatalogName("");
        fetchCatalogs();
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
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Commerce Manager</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your product catalogs for dynamic ads.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger render={<Button className="rounded-sm bg-primary hover:bg-primary/90" />}>
            <Plus className="h-4 w-4 mr-2" /> Add Catalog
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create Product Catalog</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateCatalog} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="catalog-name">Catalog Name</Label>
                <Input 
                  id="catalog-name" 
                  placeholder="e.g. Summer Collection 2026" 
                  value={newCatalogName}
                  onChange={e => setNewCatalogName(e.target.value)}
                  required 
                />
              </div>
              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating..." : "Create Catalog"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Control Bar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="text" 
            placeholder="Search catalogs..." 
            className="pl-8 bg-slate-50 dark:bg-slate-900 border-slate-200"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50 dark:bg-slate-900/20 min-h-[400px]">
        {loading ? (
          <div className="col-span-full text-center text-slate-500 py-12">Loading catalogs...</div>
        ) : catalogs.length === 0 ? (
          <div className="col-span-full text-center text-slate-500 py-12">
            No product catalogs found. Click "Add Catalog" to get started.
          </div>
        ) : (
          catalogs.map((catalog) => (
            <div key={catalog.id} className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 dark:text-orange-400">
                      <Store className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-slate-900 dark:text-slate-50">{catalog.name}</h3>
                      <p className="text-xs text-slate-500">ID: {catalog.id}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 -mr-2 -mt-2">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 flex items-center justify-between">
                <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  <span>{catalog.products_count || 0} Products</span>
                </div>
                <Button size="sm" render={<Link to={`/catalogs/${catalog.id}/products`} />}>
                  Manage Items
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
