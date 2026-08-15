import { useState, useEffect, useRef } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Search, Filter, MoreHorizontal, Upload, Image as ImageIcon, Video, Loader2 } from "lucide-react";
import { ListShell } from "../../components/shared/ListShell";

export default function CreativeIndex() {
  const [creatives, setCreatives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("media");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCreatives = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_ADS_API_URL}/api/creatives`, {
        headers: {
          "Accept": "application/json",
          "X-Advertiser-ID": '1',
        }
      });
      if (res.ok) {
        const data = await res.json();
        setCreatives(data);
      }
    } catch (error) {
      console.error("Failed to fetch creatives:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCreatives();
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${import.meta.env.VITE_ADS_API_URL}/api/creatives`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "X-Advertiser-ID": '1',
        },
        body: formData,
      });

      if (res.ok) {
        await fetchCreatives();
      } else {
        alert("Upload failed.");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload error.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const tabs = [
    { id: "media", label: "Media Library", active: activeTab === "media" },
    { id: "templates", label: "Video Templates", active: activeTab === "templates" },
    { id: "pages", label: "Instant Pages", active: activeTab === "pages" },
  ];

  const toolbarActions = (
    <div className="flex items-center gap-2">
      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*,video/*" 
      />
      <Button 
        onClick={handleUploadClick}
        disabled={uploading}
        className="rounded-sm h-8 bg-primary hover:bg-primary/90"
      >
        {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
        {uploading ? "Uploading..." : "Upload Media"}
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
          aria-label="Search creatives by name or ID"
          className="h-8 pl-8 w-[250px] rounded-sm bg-slate-50 dark:bg-slate-900 border-slate-200"
        />
      </div>
    </div>
  );

  return (
    <ListShell 
      tabs={tabs} 
      onTabChange={setActiveTab}
      toolbarActions={toolbarActions} 
      totalItems={activeTab === "media" ? creatives.length : 0}
    >
      {activeTab === "media" && (
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium w-10">
                <input type="checkbox" aria-label="Select all creatives" className="rounded-sm border-slate-300 text-primary focus:ring-primary h-3 w-3" />
              </th>
              <th scope="col" className="px-4 py-3 font-medium min-w-[250px]">Creative Asset</th>
              <th scope="col" className="px-4 py-3 font-medium">Type</th>
              <th scope="col" className="px-4 py-3 font-medium">Dimensions</th>
              <th scope="col" className="px-4 py-3 font-medium">File Size</th>
              <th scope="col" className="px-4 py-3 font-medium">Moderation Status</th>
              <th scope="col" className="px-4 py-3 font-medium">Date Uploaded</th>
              <th scope="col" className="px-4 py-3 font-medium text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading creatives...
                </td>
              </tr>
            ) : creatives.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No creatives found. Upload media to get started.
                </td>
              </tr>
            ) : (
              creatives.map((creative) => (
                <tr key={creative.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <td className="px-4 py-3 align-middle">
                    <input type="checkbox" className="rounded-sm border-slate-300 text-primary focus:ring-primary h-3 w-3" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 bg-slate-100 dark:bg-slate-800 rounded-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden relative">
                        {creative.type === "video" ? (
                          <video src={creative.assets?.url} className="w-full h-full object-cover" muted />
                        ) : (
                          <img src={creative.assets?.url} className="w-full h-full object-cover" alt="Creative preview" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-primary line-clamp-1 max-w-[200px]" title={creative.assets?.original_name}>
                          {creative.assets?.original_name || `Creative ${creative.id}`}
                        </div>
                        <div className="text-xs text-muted-foreground">ID: CRV-{creative.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 capitalize">
                    <span className="flex items-center gap-1">
                      {creative.type === "video" ? <Video className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />} 
                      {creative.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                    -
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {creative.assets?.size ? (creative.assets.size / 1024).toFixed(1) + " KB" : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className={`h-2 w-2 rounded-full ${
                        creative.status === 'approved' ? 'bg-emerald-500' :
                        creative.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500'
                      }`}></div>
                      <span className={`font-medium text-xs capitalize ${
                        creative.status === 'approved' ? 'text-emerald-700 dark:text-emerald-400' :
                        creative.status === 'rejected' ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'
                      }`}>
                        {creative.status.replace('_', ' ')}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(creative.created_at).toLocaleDateString()}
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
      )}

      {activeTab === "templates" && (
        <div className="p-12 text-center text-muted-foreground">
          <Video className="h-12 w-12 mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-2">Video Templates</h3>
          <p>Create engaging video ads in minutes with our ready-to-use templates.</p>
          <Button className="mt-4" variant="outline">Browse Templates (Coming Soon)</Button>
        </div>
      )}

      {activeTab === "pages" && (
        <div className="p-12 text-center text-muted-foreground">
          <ImageIcon className="h-12 w-12 mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-medium text-slate-800 dark:text-slate-200 mb-2">Instant Pages</h3>
          <p>Build fast-loading native landing pages optimized for conversions.</p>
          <Button className="mt-4" variant="outline">Create Page (Coming Soon)</Button>
        </div>
      )}
    </ListShell>
  );
}
