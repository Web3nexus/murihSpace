import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Search, Plus, ArrowLeft, Image as ImageIcon, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../../components/ui/dialog";

export default function CatalogProducts() {
  const { id } = useParams();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Add Product State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newProduct, setNewProduct] = useState({
    retailer_product_id: '',
    name: '',
    description: '',
    brand: '',
    price: '',
    currency: 'USD',
    image_url: '',
    url: ''
  });

  useEffect(() => {
    fetchProducts();
  }, [id]);

  const fetchProducts = () => {
    setLoading(true);
    fetch(`${import.meta.env.VITE_ADS_API_URL}/api/catalogs/${id}/products`, {
      headers: { 
        'Accept': 'application/json',
        'X-Advertiser-ID': '1'
      }
    })
      .then(res => res.json())
      .then(result => {
        if (result.status === 'success') {
          setProducts(result.data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch products', err);
        setLoading(false);
      });
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_ADS_API_URL}/api/catalogs/${id}/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Advertiser-ID': '1'
        },
        body: JSON.stringify({
          ...newProduct,
          price: parseFloat(newProduct.price)
        })
      });
      const result = await res.json();
      if (result.status === 'success') {
        setIsAddOpen(false);
        setNewProduct({
          retailer_product_id: '', name: '', description: '', brand: '', price: '', currency: 'USD', image_url: '', url: ''
        });
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_ADS_API_URL}/api/catalogs/${id}/sync`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'X-Advertiser-ID': '1'
        }
      });
      const result = await res.json();
      if (res.ok) {
        // Show success message somehow, e.g. alert or toast. Using alert for simplicity here.
        alert(result.message || 'Successfully synced products.');
        fetchProducts();
      } else {
        alert(result.message || 'Failed to sync products.');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while syncing products.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col gap-0 max-w-[1400px] mx-auto w-full h-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" render={<Link to="/catalogs" />} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Products</h1>
            <p className="text-sm text-slate-500 mt-1">Manage items in Catalog ID: {id}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="rounded-sm" 
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? "Syncing..." : "Sync from MurihSpace"}
          </Button>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger render={<Button className="rounded-sm bg-primary hover:bg-primary/90" />}>
              <Plus className="h-4 w-4 mr-2" /> Add Item
            </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Product to Catalog</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddProduct} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">Retailer ID (SKU)</Label>
                  <Input 
                    id="sku" 
                    placeholder="e.g. SKU-12345" 
                    value={newProduct.retailer_product_id}
                    onChange={e => setNewProduct({...newProduct, retailer_product_id: e.target.value})}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand">Brand</Label>
                  <Input 
                    id="brand" 
                    placeholder="e.g. MurihSpace" 
                    value={newProduct.brand}
                    onChange={e => setNewProduct({...newProduct, brand: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Product Name</Label>
                <Input 
                  id="name" 
                  placeholder="e.g. Classic T-Shirt" 
                  value={newProduct.name}
                  onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price</Label>
                  <Input 
                    id="price" 
                    type="number"
                    step="0.01"
                    placeholder="e.g. 29.99" 
                    value={newProduct.price}
                    onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image_url">Image URL</Label>
                  <Input 
                    id="image_url" 
                    placeholder="https://example.com/image.jpg" 
                    value={newProduct.image_url}
                    onChange={e => setNewProduct({...newProduct, image_url: e.target.value})}
                    required 
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={adding}>
                  {adding ? "Adding..." : "Add Product"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Control Bar */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            type="text" 
            placeholder="Search products..." 
            className="pl-8 bg-slate-50 dark:bg-slate-900 border-slate-200"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3 font-medium w-16">Image</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Brand</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Availability</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">Loading products...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">No products found in this catalog.</td></tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <td className="px-4 py-3">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="h-10 w-10 object-cover rounded border" />
                    ) : (
                      <div className="h-10 w-10 bg-slate-100 flex items-center justify-center rounded border">
                        <ImageIcon className="h-4 w-4 text-slate-400" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-slate-50">{product.name}</div>
                    <div className="text-xs text-slate-500">SKU: {product.retailer_product_id}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{product.brand || '-'}</td>
                  <td className="px-4 py-3 font-medium">{product.price} {product.currency}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                      <span className="text-emerald-700 dark:text-emerald-400 text-xs font-medium">In Stock</span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
