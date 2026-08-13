import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Search, Filter, MoreHorizontal, UserPlus, Shield, CheckCircle, Mail, Settings } from "lucide-react";

export default function BusinessIndex() {
  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto w-full">
      {/* Header & Controls */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Business Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage your ad account details, permissions, and team members.</p>
        </div>
      </div>
      
      {/* Settings Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Ad Account Info */}
        <Card className="col-span-1 rounded-sm border-slate-200 dark:border-slate-800 shadow-none bg-slate-50 dark:bg-slate-900/50">
          <CardHeader className="pb-4 border-b border-slate-200 dark:border-slate-800">
            <CardTitle className="text-base font-semibold">Ad Account Info</CardTitle>
            <CardDescription>Primary settings for this account.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Account Name</p>
              <p className="font-medium text-slate-800 dark:text-slate-200">Acme Corp Ads</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Account ID</p>
              <p className="font-mono text-sm text-slate-600">ACT-90218412</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Currency & Timezone</p>
              <p className="text-sm text-slate-600">USD (US Dollar) • GMT+1 (London)</p>
            </div>
            <div className="pt-2">
              <Button variant="outline" size="sm" className="w-full rounded-sm bg-white dark:bg-slate-950">
                <Settings className="h-4 w-4 mr-2" /> Edit Details
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Verification Status */}
        <Card className="col-span-2 rounded-sm border-slate-200 dark:border-slate-800 shadow-none">
          <CardHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-semibold flex items-center">
              <Shield className="h-5 w-5 mr-2 text-primary" /> Verification Center
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">Business Verified</h3>
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-sm text-muted-foreground">Your business has completed standard verification.</p>
                <div className="text-xs font-medium text-slate-500 mt-2 bg-slate-100 dark:bg-slate-800 inline-block px-2 py-1 rounded-sm">
                  Daily Spend Limit: $5,000.00
                </div>
              </div>
              <Button variant="outline" className="rounded-sm">
                Request Limit Increase
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Team Members Grid */}
      <div className="flex flex-col gap-0 w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-sm mt-4">
        {/* Control Bar */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mr-4">Team Members</h3>
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input 
                type="text" 
                placeholder="Search by name or email" 
                className="h-8 pl-8 w-[250px] rounded-sm bg-white dark:bg-slate-950 border-slate-200"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button className="rounded-sm h-8 bg-primary hover:bg-primary/90">
              <UserPlus className="h-4 w-4 mr-2" /> Invite Member
            </Button>
          </div>
        </div>
        
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">User</th>
                <th scope="col" className="px-4 py-3 font-medium">Email</th>
                <th scope="col" className="px-4 py-3 font-medium">Role</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center font-semibold text-slate-600">
                      JD
                    </div>
                    <div className="font-medium text-slate-800 dark:text-slate-200">Jane Doe</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">jane.doe@acme.com</td>
                <td className="px-4 py-3">
                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs px-2 py-1 rounded-sm font-medium">
                    Admin
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium text-xs">Active</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-800">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center font-semibold text-slate-600">
                      MS
                    </div>
                    <div className="font-medium text-slate-800 dark:text-slate-200">Mark Smith</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">mark.smith@acme.com</td>
                <td className="px-4 py-3">
                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs px-2 py-1 rounded-sm font-medium">
                    Campaign Manager
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                    <span className="text-amber-700 dark:text-amber-400 font-medium text-xs">Pending Invitation</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-800">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
