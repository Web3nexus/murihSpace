import { Link, useLocation } from "react-router";
import { 
  Building,
  HelpCircle,
  Bell,
  User,
  ExternalLink
} from "lucide-react";
import { Button } from "./ui/button";

const navItems = [
  { title: "Dashboard", url: "/" },
  { title: "Campaign", url: "/campaigns" },
  { title: "Assets", url: "/creative" }, 
  { title: "Audiences", url: "/audiences" },
  { title: "Events Manager", url: "/events-manager" },
  { title: "Catalogs", url: "/catalogs" },
  { title: "Reporting", url: "/analytics" },
];

export function TopNav() {
  const location = useLocation();

  return (
    <div className="sticky top-0 z-50 w-full border-b bg-background shadow-sm">
      <div className="flex h-14 items-center px-4 md:px-6">
        {/* Logo Area */}
        <div className="mr-8 flex items-center gap-1.5">
          <img src="/logos/member-icon-light.png" alt="MurihSpace" className="h-8 w-8 object-contain dark:hidden shrink-0" />
          <img src="/logos/member-icon-dark.png" alt="MurihSpace" className="h-8 w-8 object-contain hidden dark:block shrink-0" />
          <span className="text-[1.25rem] font-bold tracking-tight text-[#102840] dark:text-[#F7FAFC] mt-0.5">Ads</span>
        </div>

        {/* Main Navigation */}
        <nav className="flex items-center space-x-1 lg:space-x-2">
          {navItems.map((item) => {
            const isActive = item.url === "/" 
                ? location.pathname === "/"
                : location.pathname.startsWith(item.url);
            
            return (
              <Link
                key={item.title}
                to={item.url}
                className={`px-4 py-4 text-sm font-medium transition-colors relative ${
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.title}
                {isActive && (
                  <span className="absolute bottom-0 left-0 h-0.5 w-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="ml-auto flex items-center space-x-4">
          <div className="hidden md:flex items-center gap-4 border-r pr-4 mr-1">
            <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Help and Support">
              <HelpCircle className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Notifications">
              <Bell className="h-5 w-5" />
            </Button>
            <Link to="/business" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              <Building className="h-4 w-4" />
              Business Center
            </Link>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-medium leading-none">Advertiser</div>
              <div className="text-xs text-muted-foreground mt-1">ID: 4892 291 00</div>
            </div>
            <Button variant="outline" size="icon" className="rounded-full h-8 w-8" aria-label="User Profile">
              <User className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" asChild>
              <Link to="/secureads/login" title="Secure Ads Admin" aria-label="Secure Ads Admin">
                <ExternalLink className="h-4 w-4 text-red-500" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
