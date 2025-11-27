import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  FileText,
  Upload,
  Tags,
  Search,
  BarChart3,
  Settings,
  BookOpen, // Import BookOpen icon
} from "lucide-react";
import { useLocation } from "wouter";

const navigationItems = [
  {
    name: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Gestione Documenti",
    href: "/admin/documents",
    icon: FileText,
  },
  {
    name: "Categorie",
    href: "/admin/categories",
    icon: Tags,
  },
  {
    name: "Manifest IIIF", // New item for Manifests
    href: "/admin/manifests",
    icon: BookOpen, // Use BookOpen icon
  },
  {
    name: "Ricerca Avanzata",
    href: "/admin/search",
    icon: Search,
  },
  {
    name: "Statistiche",
    href: "/admin/stats",
    icon: BarChart3,
  },
  {
    name: "Impostazioni",
    href: "/admin/settings",
    icon: Settings,
  },
];

export function AdminSidebar() {
  const [location, setLocation] = useLocation();

  return (
    <div className="w-64 bg-card border-r border-border shadow-sm" data-testid="admin-sidebar">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-6">Backoffice Admin</h2>
        <nav className="space-y-2">
          {navigationItems.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Button
                key={item.name}
                variant={isActive ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  isActive && "bg-primary text-primary-foreground"
                )}
                onClick={() => setLocation(item.href)}
                data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <Icon className="mr-3 h-4 w-4" />
                {item.name}
              </Button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}