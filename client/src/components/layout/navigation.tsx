import { useState } from "react";
import { Moon, Sun, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function Navigation() {
  const [activeTab, setActiveTab] = useState<"public" | "admin">("public");
  const { isAuthenticated } = useAuth();

  return (
    <nav className="bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold text-primary">DigiteKa</h1>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <button
                  onClick={() => setActiveTab("public")}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === "public"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                  data-testid="tab-public"
                >
                  Consultazione Pubblica
                </button>
                {isAuthenticated && (
                  <button
                    onClick={() => window.location.href = "/admin/dashboard"}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeTab === "admin"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    }`}
                    data-testid="tab-admin"
                  >
                    Backoffice Admin
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" data-testid="toggle-theme">
              <Moon className="h-4 w-4" />
            </Button>
            {isAuthenticated ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (window.location.href = "/api/logout")}
                data-testid="logout-button"
              >
                <User className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (window.location.href = "/api/login")}
                data-testid="login-button"
              >
                <User className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
