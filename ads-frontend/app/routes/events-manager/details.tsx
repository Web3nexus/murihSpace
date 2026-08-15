import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Button } from "../../components/ui/button";
import { ArrowLeft, Code, Activity, Search, Copy, CheckCircle } from "lucide-react";
import { Input } from "../../components/ui/input";

export default function PixelDetails() {
  const { id } = useParams();
  const [pixel, setPixel] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Fetch pixel details
    fetch(`${import.meta.env.VITE_ADS_API_URL}/api/pixels/${id}`, {
      headers: { 
        'Accept': 'application/json',
        'X-Advertiser-ID': '1'
      }
    })
      .then(res => res.json())
      .then(result => {
        if (result.status === 'success' || result.id) {
          setPixel(result.data || result);
        }
      })
      .catch(err => {
        console.error('Failed to fetch pixel', err);
      });

    // Fetch pixel events
    fetch(`${import.meta.env.VITE_ADS_API_URL}/api/pixels/${id}/events`, {
      headers: { 
        'Accept': 'application/json',
        'X-Advertiser-ID': '1'
      }
    })
      .then(res => res.json())
      .then(result => {
        if (result.data) {
          setEvents(result.data);
        }
      })
      .catch(err => {
        console.error('Failed to fetch events', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const copyToClipboard = () => {
    if (pixel?.pixel_uuid) {
      navigator.clipboard.writeText(pixel.pixel_uuid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Loading pixel data...</div>;
  }

  if (!pixel) {
    return <div className="p-12 text-center text-red-500">Pixel not found.</div>;
  }

  const snippet = `<!-- MurihSpace Pixel Code -->
<script>
  !function(m,u,r,i,h){if(m.MurihSpacePixel)return;var p=m.MurihSpacePixel=function(){
  p.callMethod?p.callMethod.apply(p,arguments):p.queue.push(arguments)};
  if(!m._mspq)m._mspq=p;p.push=p;p.loaded=!0;p.version='1.0';p.queue=[];
  var e=u.createElement(r),s=u.getElementsByTagName(r)[0];
  e.async=1;e.src=i;s.parentNode.insertBefore(e,s)}(window,document,'script',
  'https://murihspace.com/static/pixel.js');
  
  MurihSpacePixel('init', '${pixel.pixel_uuid}');
  MurihSpacePixel('track', 'PageView');
</script>
<!-- End MurihSpace Pixel Code -->`;

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto w-full pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link to="/events-manager">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">{pixel.name}</h1>
          <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
            <span>ID: {pixel.pixel_uuid}</span>
            <span className="text-slate-300">•</span>
            <span>Domain: {pixel.domain}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Events */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-semibold">Recent Events</h2>
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                <Input type="text" placeholder="Search events..." className="h-8 pl-8 w-[200px]" />
              </div>
            </div>
            <div className="p-0">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">Event Name</th>
                    <th className="px-4 py-3 font-medium text-right">Total Count</th>
                    <th className="px-4 py-3 font-medium text-right">Last Received</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length > 0 ? (
                    events.map((event) => (
                      <tr key={event.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="px-4 py-3 font-medium text-primary">{event.event_name}</td>
                        <td className="px-4 py-3 text-right">1</td>
                        <td className="px-4 py-3 text-right text-slate-500">{new Date(event.created_at).toLocaleString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                        <Activity className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        No events received yet. Install the pixel code to start tracking.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Setup */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-400">
                <Code className="h-5 w-5" />
              </div>
              <h2 className="font-semibold">Install Pixel</h2>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Paste this code into the <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">&lt;head&gt;</code> section of your website.
            </p>
            <div className="relative group">
              <pre className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 text-xs overflow-x-auto text-slate-700 dark:text-slate-300">
                {snippet}
              </pre>
              <Button 
                variant="secondary" 
                size="sm" 
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={copyToClipboard}
              >
                {copied ? <CheckCircle className="h-4 w-4 mr-1 text-emerald-500" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? 'Copied' : 'Copy Code'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
