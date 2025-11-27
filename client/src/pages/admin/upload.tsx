import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { UploadModal } from "@/components/admin/upload-modal";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useLocation } from "wouter";

export default function Upload() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [preselectedDocumentIds, setPreselectedDocumentIds] = useState<string[]>([]);

  // Read preselected documents from query string
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const documentsParam = params.get('documents');
    if (documentsParam) {
      const ids = documentsParam.split(',').filter(id => id.trim());
      setPreselectedDocumentIds(ids);
    }
  }, []);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-background">
      <AdminSidebar />
      
      <div className="flex-1 overflow-hidden">
        {/* Header */}
        <div className="bg-card border-b border-border p-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Carica Documenti</h1>
              <p className="text-muted-foreground">Aggiungi nuovi documenti all'archivio</p>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          <UploadModal 
            isOpen={true} 
            onClose={() => setLocation("/admin/dashboard")}
            preselectedDocumentIds={preselectedDocumentIds.length > 0 ? preselectedDocumentIds : undefined}
          />
        </div>
      </div>
    </div>
  );
}
