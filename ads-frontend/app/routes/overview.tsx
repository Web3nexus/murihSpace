import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Calendar, ChevronDown, Download, HelpCircle } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useEffect, useState } from "react";

export default function Overview() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    spend: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    roas: 0
  });
  const [trendData, setTrendData] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_ADS_API_URL}/api/analytics/report`, {
      headers: {
        'Accept': 'application/json',
        'X-Advertiser-ID': '1'
      }
    })
      .then(res => res.json())
      .then(data => {
        if(data && data.summary) {
          setMetrics({
            spend: data.summary.spend_usd || 0,
            impressions: data.summary.impressions || 0,
            clicks: data.summary.clicks || 0,
            conversions: data.summary.conversions || 0,
            roas: data.summary.roas || 0
          });
          setTrendData(data.chart_data || []);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch analytics', err);
        setLoading(false);
      });
  }, []);
  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto w-full">
      {/* Header & Controls */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-1">Overview of your advertising performance.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center border rounded-md px-3 py-2 bg-white dark:bg-slate-900 shadow-sm cursor-pointer text-sm font-medium hover:bg-slate-50 transition-colors">
            <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
            <span>Today: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <ChevronDown className="h-4 w-4 ml-2 text-muted-foreground" />
          </div>
          <Button variant="outline" size="sm" className="h-9">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>
      
      {/* Metrics Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Account Snapshot</h3>
          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-pointer" />
        </div>
        
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-sm border-slate-200 dark:border-slate-800 shadow-none hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">${metrics.spend.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            </CardContent>
          </Card>
          
          <Card className="rounded-sm border-slate-200 dark:border-slate-800 shadow-none hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Impressions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{metrics.impressions.toLocaleString()}</div>
            </CardContent>
          </Card>
          
          <Card className="rounded-sm border-slate-200 dark:border-slate-800 shadow-none hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Clicks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{metrics.clicks.toLocaleString()}</div>
            </CardContent>
          </Card>
          
          <Card className="rounded-sm border-slate-200 dark:border-slate-800 shadow-none hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conversions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{metrics.conversions.toLocaleString()}</div>
            </CardContent>
          </Card>
          
          <Card className="rounded-sm border-slate-200 dark:border-slate-800 shadow-none hover:shadow-sm transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">ROAS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{metrics.roas}x</div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Chart */}
      <Card className="rounded-sm border-slate-200 dark:border-slate-800 shadow-none">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <CardTitle className="text-base font-semibold">Trend Analysis</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00F2FE" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00F2FE" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
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
                  tickFormatter={(val) => `$${val / 1000}k`} 
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#64748b' }} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '4px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Area 
                  yAxisId="left" 
                  type="monotone" 
                  dataKey="spend" 
                  name="Cost" 
                  stroke="#00F2FE" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#colorCost)" 
                />
                <Area 
                  yAxisId="right" 
                  type="monotone" 
                  dataKey="conversions" 
                  name="Conversions" 
                  stroke="#8B5CF6" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#colorConversions)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
