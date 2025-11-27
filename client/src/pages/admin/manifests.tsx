
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Eye, Trash2, ExternalLink, Plus } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useLocation } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Manifest {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  manifestUrl: string;
}

export default function Manifests() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

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

  const loadManifests = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/manifests', {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401 && isUnauthorizedError()) {
          window.location.href = "/api/login";
          return;
        }
        throw new Error('Failed to load manifests');
      }

      const data = await response.json();
      setManifests(data);
    } catch (error) {
      console.error('Error loading manifests:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei manifest",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadManifests();
    }
  }, [isAuthenticated]);

  const handleDelete = async (manifestId: string) => {
    try {
      setDeleteLoading(manifestId);

      const { data: csrfData } = await fetch('/api/csrf-token', {
        credentials: 'include'
      }).then(r => r.json());

      const response = await fetch(`/api/admin/manifests/${manifestId}`, {
        method: 'DELETE',
        headers: {
          'X-CSRF-Token': csrfData.csrfToken,
        },
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete manifest');
      }

      toast({
        title: "Successo",
        description: "Manifest eliminato con successo",
      });

      // Reload manifests
      await loadManifests();
    } catch (error) {
      console.error('Error deleting manifest:', error);
      toast({
        title: "Errore",
        description: "Errore nell'eliminazione del manifest",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(null);
    }
  };

  const openInMirador = (manifestUrl: string) => {
    // Create a simple viewer page with Mirador
    const viewerUrl = `/manifest-viewer?manifest=${encodeURIComponent(manifestUrl)}`;
    window.open(viewerUrl, '_blank');
  };

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
              <h1 className="text-2xl font-bold text-foreground">Manifest IIIF</h1>
              <p className="text-muted-foreground">Gestisci i tuoi manifest IIIF per collezioni di immagini</p>
            </div>
            <Button onClick={() => setLocation("/admin/upload")}>
              <Plus className="w-4 h-4 mr-2" />
              Crea Manifest
            </Button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner className="mr-2" />
              <span>Caricamento manifest...</span>
            </div>
          ) : manifests.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nessun manifest trovato</h3>
              <p className="text-muted-foreground mb-6">
                Non hai ancora creato alcun manifest IIIF. Inizia creando il tuo primo manifest.
              </p>
              <Button onClick={() => setLocation("/admin/upload")}>
                <Plus className="w-4 h-4 mr-2" />
                Crea il tuo primo Manifest
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {manifests.map((manifest) => (
                <Card key={manifest.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2 line-clamp-2">
                          {manifest.title}
                        </CardTitle>
                        <Badge variant="secondary" className="mb-2">
                          <BookOpen className="w-3 h-3 mr-1" />
                          IIIF Manifest
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-4">
                      {manifest.description && (
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {manifest.description}
                        </p>
                      )}
                      
                      <div className="text-xs text-muted-foreground">
                        Creato: {new Date(manifest.createdAt).toLocaleDateString('it-IT')}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openInMirador(manifest.manifestUrl)}
                          className="flex-1"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Visualizza
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(manifest.manifestUrl, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={deleteLoading === manifest.id}
                            >
                              {deleteLoading === manifest.id ? (
                                <LoadingSpinner className="w-4 h-4" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
                              <AlertDialogDescription>
                                Sei sicuro di voler eliminare questo manifest? Questa azione non può essere annullata.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(manifest.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Elimina
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
