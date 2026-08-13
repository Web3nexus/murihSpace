import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Search, Filter, MoreHorizontal, Upload, Image as ImageIcon, Video } from "lucide-react";
import { ListShell } from "../../components/shared/ListShell";

export default function CreativeIndex() {
  const tabs = [
    { id: "media", label: "Media Library", active: true },
    { id: "templates", label: "Video Templates" },
    { id: "pages", label: "Instant Pages" },
  ];

  const toolbarActions = (
    <div className="flex items-center gap-2">
      <Button className="rounded-sm h-8 bg-primary hover:bg-primary/90">
        <Upload className="h-4 w-4 mr-1" /> Upload Media
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
    <ListShell tabs={tabs} toolbarActions={toolbarActions} totalItems={2}>
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
          <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
            <td className="px-4 py-3 align-middle">
              <input type="checkbox" aria-label="Select Summer_Sale_Graphic.jpg" className="rounded-sm border-slate-300 text-primary focus:ring-primary h-3 w-3" />
            </td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-slate-100 rounded-sm border border-slate-200 flex items-center justify-center overflow-hidden">
                  <ImageIcon className="h-5 w-5 text-slate-400" />
                </div>
                <div>
                  <div className="font-medium text-primary">Summer_Sale_Graphic.jpg</div>
                  <div className="text-xs text-muted-foreground">ID: CRV-84920</div>
                </div>
              </div>
            </td>
            <td className="px-4 py-3 text-slate-600">
              <span className="flex items-center gap-1"><ImageIcon className="h-3 w-3" /> Image</span>
            </td>
            <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">1080 x 1080</td>
            <td className="px-4 py-3 text-slate-600">245 KB</td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                <span className="text-emerald-700 dark:text-emerald-400 font-medium text-xs">Approved</span>
              </div>
            </td>
            <td className="px-4 py-3 text-slate-500">Aug 10, 2026</td>
            <td className="px-4 py-3 text-center">
              <Button variant="ghost" size="icon" aria-label="More actions for Summer_Sale_Graphic.jpg" className="h-8 w-8 text-slate-400 hover:text-slate-800">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </td>
          </tr>
          <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
            <td className="px-4 py-3 align-middle">
              <input type="checkbox" aria-label="Select Product_Demo_Vertical.mp4" className="rounded-sm border-slate-300 text-primary focus:ring-primary h-3 w-3" />
            </td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-slate-900 rounded-sm border border-slate-800 flex items-center justify-center relative">
                  <Video className="h-5 w-5 text-white/50" />
                </div>
                <div>
                  <div className="font-medium text-primary">Product_Demo_Vertical.mp4</div>
                  <div className="text-xs text-muted-foreground">ID: CRV-84921</div>
                </div>
              </div>
            </td>
            <td className="px-4 py-3 text-slate-600">
              <span className="flex items-center gap-1"><Video className="h-3 w-3" /> Video</span>
            </td>
            <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">1080 x 1920</td>
            <td className="px-4 py-3 text-slate-600">12.4 MB</td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                <span className="text-amber-700 dark:text-amber-400 font-medium text-xs">Pending Review</span>
              </div>
            </td>
            <td className="px-4 py-3 text-slate-500">Aug 12, 2026</td>
            <td className="px-4 py-3 text-center">
              <Button variant="ghost" size="icon" aria-label="More actions for Product_Demo_Vertical.mp4" className="h-8 w-8 text-slate-400 hover:text-slate-800">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </ListShell>
  );
}
