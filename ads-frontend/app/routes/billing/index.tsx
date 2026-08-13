import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Search, Filter, SlidersHorizontal, Download, Plus, CreditCard, Receipt } from "lucide-react";

export default function BillingIndex() {
  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto w-full">
      {/* Header & Controls */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Billing & Payments</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage your ad account balance, payment methods, and transaction history.</p>
        </div>
      </div>
      
      {/* Balances Section */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="col-span-2 rounded-sm border-slate-200 dark:border-slate-800 shadow-none">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <CardTitle className="text-base font-semibold">Account Balance</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Prepaid Balance</p>
              <div className="text-4xl font-bold tracking-tight text-slate-800 dark:text-slate-100">$1,450.00</div>
              <p className="text-xs text-muted-foreground mt-2">Funds are automatically deducted as your ads deliver.</p>
            </div>
            <div className="flex flex-col gap-3">
              <Button className="rounded-sm bg-primary hover:bg-primary/90 px-8">
                <Plus className="h-4 w-4 mr-2" /> Add Funds
              </Button>
              <Button variant="outline" className="rounded-sm">
                <CreditCard className="h-4 w-4 mr-2" /> Payment Methods
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 rounded-sm border-slate-200 dark:border-slate-800 shadow-none bg-slate-50 dark:bg-slate-900/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Invoice</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="font-medium">INV-2026-08</p>
                <p className="text-xs text-muted-foreground">Aug 1, 2026</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">$500.00</p>
                <div className="flex items-center gap-1.5 justify-end">
                  <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium text-xs">Paid</span>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full rounded-sm h-8 bg-white dark:bg-slate-950">
              <Receipt className="h-3 w-3 mr-2" /> Download PDF
            </Button>
          </CardContent>
        </Card>
      </div>
      
      {/* Transactions Grid */}
      <div className="flex flex-col gap-0 w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm mt-4">
        {/* Control Bar */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mr-4">Transaction History</h3>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input 
                type="text" 
                placeholder="Search ID..." 
                className="h-8 pl-8 w-[200px] rounded-sm bg-white dark:bg-slate-950 border-slate-200"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-sm h-8 bg-white dark:bg-slate-950">
              <Filter className="h-3 w-3 mr-2" /> Filter
            </Button>
            <Button variant="outline" size="sm" className="rounded-sm h-8 bg-white dark:bg-slate-950">
              <Download className="h-3 w-3 mr-2" /> Export
            </Button>
          </div>
        </div>
        
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Date</th>
                <th scope="col" className="px-4 py-3 font-medium min-w-[200px]">Description</th>
                <th scope="col" className="px-4 py-3 font-medium">Transaction ID</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Amount</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                <td className="px-4 py-3 text-slate-500">Aug 12, 2026</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-primary">Ad Spend Deduction</div>
                  <div className="text-xs text-muted-foreground">Campaign: Summer Collection Launch</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">TRX-998271A</td>
                <td className="px-4 py-3 text-right font-medium text-red-600 dark:text-red-400">-$45.50</td>
                <td className="px-4 py-3 text-right text-slate-600">$1,450.00</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                <td className="px-4 py-3 text-slate-500">Aug 11, 2026</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-primary">Ad Spend Deduction</div>
                  <div className="text-xs text-muted-foreground">Campaign: Retargeting 30 Days</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">TRX-998104B</td>
                <td className="px-4 py-3 text-right font-medium text-red-600 dark:text-red-400">-$12.20</td>
                <td className="px-4 py-3 text-right text-slate-600">$1,495.50</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                <td className="px-4 py-3 text-slate-500">Aug 01, 2026</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-emerald-600 dark:text-emerald-500">Account Funding (Card ending in 4242)</div>
                  <div className="text-xs text-muted-foreground">Manual Deposit</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">TRX-991001C</td>
                <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">+$500.00</td>
                <td className="px-4 py-3 text-right text-slate-600">$1,507.70</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
