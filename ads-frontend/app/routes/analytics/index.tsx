import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Calendar, Download, HelpCircle, Activity } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [data, setData] = useState({
    summary: {
      spend_usd: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      roas: 0
    }
  });
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const advertiserId = typeof window !== 'undefined' ? (localStorage.getItem('active_advertiser_id') || '1') : '1';
    fetch(`${import.meta.env.VITE_ADS_API_URL}/api/analytics/report`, {
      headers: {
        'Accept': 'application/json',
        'X-Advertiser-ID': advertiserId
      }
    })
      .then(res => {
        if (!res.ok) throw new Error("API Error");
        return res.json();
      })
      .then(result => {
        if(result && result.summary) {
          setData({ summary: {
            spend_usd: result.summary.spend_usd || 0,
            impressions: result.summary.impressions || 0,
            clicks: result.summary.clicks || 0,
            ctr: result.summary.ctr || 0,
            roas: result.summary.roas || 0,
          } });
          setChartData(result.chart_data || []);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch analytics', err);
        setError(true);
        setLoading(false);
      });
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground w-full">
        <Activity className="h-12 w-12 mb-4 text-slate-300" />
        <p>Failed to load analytics data. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto w-full">
      {/* Header & Controls */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Analytics & Reports</h2>
          <p className="text-sm text-muted-foreground mt-1">Deep dive into your ad performance and spend.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center border rounded-md px-3 py-2 bg-white dark:bg-slate-900 shadow-sm cursor-pointer text-sm font-medium hover:bg-slate-50 transition-colors">
            <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
            <span>Lifetime</span>
          </div>
          <Button variant="outline" size="sm" className="h-9">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>
      
      {/* Core Metrics */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Overall Performance</h3>
          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-pointer" />
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {/* Spend */}
          <Card className="rounded-sm border-t-4 border-t-cyan-500 border-x-slate-200 border-b-slate-200 dark:border-x-slate-800 dark:border-b-slate-800 shadow-none hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Spend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">${data.summary.spend_usd.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            </CardContent>
          </Card>
          
          {/* Impressions */}
          <Card className="rounded-sm border-t-4 border-t-violet-500 border-x-slate-200 border-b-slate-200 dark:border-x-slate-800 dark:border-b-slate-800 shadow-none hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Impressions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{data.summary.impressions.toLocaleString()}</div>
            </CardContent>
          </Card>
          
          {/* Clicks */}
          <Card className="rounded-sm border-t-4 border-t-teal-500 border-x-slate-200 border-b-slate-200 dark:border-x-slate-800 dark:border-b-slate-800 shadow-none hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clicks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{data.summary.clicks.toLocaleString()}</div>
            </CardContent>
          </Card>
          
          {/* CTR */}
          <Card className="rounded-sm border-t-4 border-t-indigo-500 border-x-slate-200 border-b-slate-200 dark:border-x-slate-800 dark:border-b-slate-800 shadow-none hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Avg CTR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{data.summary.ctr}%</div>
            </CardContent>
          </Card>

          {/* ROAS */}
          <Card className="rounded-sm border-t-4 border-t-fuchsia-500 border-x-slate-200 border-b-slate-200 dark:border-x-slate-800 dark:border-b-slate-800 shadow-none hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">ROAS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{data.summary.roas}x</div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Detailed Analytics Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-2 rounded-sm border-slate-200 dark:border-slate-800 shadow-none">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <CardTitle className="text-base font-semibold">Performance Trends</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00F2FE" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00F2FE" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#64748b' }} 
                    dy={10} 
                  />
                  <YAxis 
                    yAxisId="left" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#64748b' }} 
                    tickFormatter={(val) => `$${val / 100}`} 
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#64748b' }} 
                    tickFormatter={(val) => `${val / 1000}k`} 
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                  />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                  <Area 
                    yAxisId="left" 
                    type="monotone" 
                    dataKey="spend" 
                    name="Spend" 
                    stroke="#00F2FE" 
                    strokeWidth={2} 
                    fillOpacity={1} 
                    fill="url(#colorSpend)" 
                  />
                  <Area 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="impressions" 
                    name="Impressions" 
                    stroke="#8B5CF6" 
                    strokeWidth={2} 
                    fillOpacity={1} 
                    fill="url(#colorImpressions)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <div className="flex flex-col gap-6">
          <Card className="rounded-sm border-slate-200 dark:border-slate-800 shadow-none">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <CardTitle className="text-base font-semibold">Top Campaigns</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-0">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                <div className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <div>
                    <p className="text-sm font-medium text-primary">Summer Collection</p>
                    <p className="text-xs text-muted-foreground">Conv: 124</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">$14.50</p>
                    <p className="text-xs text-muted-foreground">CPA</p>
                  </div>
                </div>
                <div className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <div>
                    <p className="text-sm font-medium text-primary">Retargeting</p>
                    <p className="text-xs text-muted-foreground">Conv: 89</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">$8.10</p>
                    <p className="text-xs text-muted-foreground">CPA</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="rounded-sm border-slate-200 dark:border-slate-800 shadow-none">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <CardTitle className="text-base font-semibold">Demographics</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 pb-6">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-600">18-24</span>
                    <span className="font-semibold">45%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-cyan-500 h-full" style={{ width: '45%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-600">25-34</span>
                    <span className="font-semibold">35%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-violet-500 h-full" style={{ width: '35%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-600">35-44</span>
                    <span className="font-semibold">15%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full" style={{ width: '15%' }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
