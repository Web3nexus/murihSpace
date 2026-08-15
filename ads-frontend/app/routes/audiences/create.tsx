import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { ArrowLeft, Users, Filter, Target } from "lucide-react";

export default function CreateAudience() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [type, setType] = useState("custom_list");
  const [sourceAudienceId, setSourceAudienceId] = useState("");
  const [loading, setLoading] = useState(false);
  const [audiences, setAudiences] = useState<any[]>([]);

  useEffect(() => {
    if (type === "lookalike") {
      fetch(`${import.meta.env.VITE_ADS_API_URL}/api/audiences`, {
        headers: { 
          'Accept': 'application/json',
          'X-Advertiser-ID': '1'
        }
      })
      .then(res => res.json())
      .then(result => {
        if (Array.isArray(result)) {
          setAudiences(result);
        } else if (result.status === 'success') {
          setAudiences(result.data);
        }
      })
      .catch(console.error);
    }
  }, [type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload: any = { name, type };
    if (type === "lookalike") {
      payload.source_audience_id = sourceAudienceId;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_ADS_API_URL}/api/audiences`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Advertiser-ID": "1"
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        navigate("/audiences");
      } else {
        alert("Failed to create audience.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[800px] mx-auto w-full pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link to="/audiences" />} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Create Audience</h1>
          <p className="text-sm text-slate-500 mt-1">Define who you want to reach with your ads.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-50">Audience Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Type: Custom List */}
              <label 
                className={`relative flex cursor-pointer rounded-lg border bg-white dark:bg-slate-950 p-4 shadow-sm hover:border-primary ${type === 'custom_list' ? 'border-primary ring-1 ring-primary' : 'border-slate-200 dark:border-slate-800'}`}
              >
                <input type="radio" name="type" value="custom_list" className="sr-only" checked={type === 'custom_list'} onChange={() => setType('custom_list')} />
                <span className="flex flex-1">
                  <span className="flex flex-col">
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-50">
                      <Users className="h-4 w-4 text-primary" /> Custom List
                    </span>
                    <span className="mt-1 flex items-center text-xs text-slate-500">
                      Upload emails or phone numbers.
                    </span>
                  </span>
                </span>
              </label>

              {/* Type: Website Traffic */}
              <label 
                className={`relative flex cursor-pointer rounded-lg border bg-white dark:bg-slate-950 p-4 shadow-sm hover:border-primary ${type === 'website_traffic' ? 'border-primary ring-1 ring-primary' : 'border-slate-200 dark:border-slate-800'}`}
              >
                <input type="radio" name="type" value="website_traffic" className="sr-only" checked={type === 'website_traffic'} onChange={() => setType('website_traffic')} />
                <span className="flex flex-1">
                  <span className="flex flex-col">
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-50">
                      <Filter className="h-4 w-4 text-blue-500" /> Website Traffic
                    </span>
                    <span className="mt-1 flex items-center text-xs text-slate-500">
                      Retarget your website visitors.
                    </span>
                  </span>
                </span>
              </label>

              {/* Type: Lookalike */}
              <label 
                className={`relative flex cursor-pointer rounded-lg border bg-white dark:bg-slate-950 p-4 shadow-sm hover:border-primary ${type === 'lookalike' ? 'border-primary ring-1 ring-primary' : 'border-slate-200 dark:border-slate-800'}`}
              >
                <input type="radio" name="type" value="lookalike" className="sr-only" checked={type === 'lookalike'} onChange={() => setType('lookalike')} />
                <span className="flex flex-1">
                  <span className="flex flex-col">
                    <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-50">
                      <Target className="h-4 w-4 text-emerald-500" /> Lookalike
                    </span>
                    <span className="mt-1 flex items-center text-xs text-slate-500">
                      Reach people similar to your best customers.
                    </span>
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-medium text-slate-900 dark:text-slate-50">Details</h2>
            <div className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="name">Audience Name</Label>
                <Input 
                  id="name" 
                  placeholder="e.g. Q4 Holiday Shoppers" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                />
              </div>

              {type === 'lookalike' && (
                <div className="space-y-2">
                  <Label htmlFor="source">Source Audience</Label>
                  <select 
                    id="source" 
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={sourceAudienceId}
                    onChange={(e) => setSourceAudienceId(e.target.value)}
                    required
                  >
                    <option value="">Select a source audience...</option>
                    {audiences.filter(a => a.type !== 'lookalike').map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.size} users)</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500">The lookalike audience will be created based on these users.</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <Button type="button" variant="ghost" className="mr-4" render={<Link to="/audiences" />}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Audience"}
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
}
