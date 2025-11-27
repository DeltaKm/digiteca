import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Login from "@/pages/login";
import DocumentViewer from "@/pages/document-viewer";
import Dashboard from "@/pages/admin/dashboard";
import Documents from "@/pages/admin/documents";
import Upload from "@/pages/admin/upload";
import Categories from "@/pages/admin/categories";
import Search from "@/pages/admin/search";
import AdminManifests from "@/pages/admin/manifests";
import ManifestViewer from "@/pages/manifest-viewer";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/document/:id" component={DocumentViewer} />
      <Route path="/manifest-viewer" component={ManifestViewer} />

      {/* Protected admin routes - always registered but components handle auth */}
      <Route path="/admin" component={Dashboard} />
      <Route path="/admin/dashboard" component={Dashboard} />
      <Route path="/admin/documents" component={Documents} />
      <Route path="/admin/upload" component={Upload} />
      <Route path="/admin/categories" component={Categories} />
      <Route path="/admin/search" component={Search} />
      <Route path="/admin/manifests" component={AdminManifests} />
      <Route path="/manifest/:manifestId" component={ManifestViewer} />

      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;