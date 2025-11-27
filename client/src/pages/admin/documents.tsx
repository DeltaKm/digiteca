import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EditDocumentModal } from "@/components/admin/edit-document-modal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Eye, Edit, Trash2, Search, FileImage, BookOpen } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Document, SearchDocuments } from "@shared/schema";

export default function Documents() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useState<SearchDocuments>({
    page: 1,
    limit: 20,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<string | undefined>(undefined);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());

  // Reset selections when search params change
  useEffect(() => {
    setSelectedDocuments(new Set());
  }, [searchParams]);

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

  const { data, isLoading: documentsLoading } = useQuery({
    queryKey: ["/api/admin/documents", searchParams],
    queryFn: async () => {
      const queryString = new URLSearchParams();
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryString.append(key, String(value));
        }
      });
      
      // Fetch documents, categories, and subcategories in parallel
      const [documentsResponse, categoriesResponse, subcategoriesResponse] = await Promise.all([
        apiRequest("GET", `/api/admin/documents?${queryString.toString()}`),
        apiRequest("GET", "/api/categories"),
        apiRequest("GET", "/api/subcategories")
      ]);
      
      const documentsData = await documentsResponse.json();
      const categories = await categoriesResponse.json();
      const subcategories = await subcategoriesResponse.json();
      
      return {
        ...documentsData,
        categories,
        subcategories
      };
    },
    enabled: isAuthenticated,
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/documents/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Documento eliminato",
        description: "Il documento è stato eliminato con successo.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Errore",
        description: "Errore durante l'eliminazione del documento.",
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    setSearchParams({ ...searchParams, query: searchQuery, page: 1 });
  };

  const handleDelete = (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questo documento?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCreateDocument = () => {
    setEditingDocumentId(undefined);
    setIsModalOpen(true);
  };

  const handleTestFTPUpload = async () => {
    try {
      toast({
        title: "🧪 Test FTP in corso...",
        description: "Creazione documento di test con upload FTP",
      });

      // Ottieni CSRF token
      const csrfData = await apiRequest("GET", "/api/csrf-token").then(r => r.json());
      
      // Ottieni le categorie
      const categoriesResponse = await apiRequest("GET", "/api/categories");
      const categories = await categoriesResponse.json();
      const kereCategory = categories.find((c: any) => c.name === "Kere");
      
      // Ottieni le sottocategorie
      const subcategoriesResponse = await apiRequest("GET", "/api/subcategories");
      const subcategories = await subcategoriesResponse.json();
      const praticheSubcategory = subcategories.find((s: any) => s.name === "Pratiche");
      
      // Crea un file di test
      const testContent = `Documento di test creato il ${new Date().toLocaleString()}

Questo è un test automatico per verificare l'upload FTP.

Categoria: Kere
Sottocategoria: Pratiche
Timestamp: ${Date.now()}

Il file dovrebbe essere salvato in:
assets/digiteka/kere/pratiche/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/`;
      
      const blob = new Blob([testContent], { type: 'text/plain' });
      const file = new File([blob], `test-ftp-${Date.now()}.txt`, { type: 'text/plain' });
      
      // Upload file su FTP
      const uploadResponse = await fetch(`/api/ftp/upload?category=Kere&subcategory=Pratiche&filename=${file.name}`, {
        method: "POST",
        body: file,
        headers: {
          "Content-Type": file.type,
          "X-CSRF-Token": csrfData.csrfToken,
        },
        credentials: 'include',
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload FTP fallito");
      }

      const uploadResult = await uploadResponse.json();
      
      // Crea il documento nel database con tutti i metadati del file
      const docResponse = await apiRequest("POST", "/api/admin/documents", {
        title: `Test FTP - ${new Date().toLocaleString()}`,
        description: "Documento di test creato automaticamente per verificare l'upload FTP",
        categoryId: kereCategory?.id || null,
        subcategoryId: praticheSubcategory?.id || null,
        status: "draft",
        isPublic: false,
        // File metadata
        fileName: file.name,
        originalFileName: file.name,
        filePath: uploadResult.path,
        fileSize: file.size,
        mimeType: file.type,
      });

      const document = await docResponse.json();

      toast({
        title: "✅ Test FTP completato!",
        description: `Documento creato: ${uploadResult.path}`,
      });

      // Ricarica la lista documenti
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      
    } catch (error) {
      console.error("Test FTP error:", error);
      toast({
        title: "❌ Test FTP fallito",
        description: error instanceof Error ? error.message : "Errore sconosciuto",
        variant: "destructive",
      });
    }
  };

  const handleEditDocument = (document: Document) => {
    setEditingDocumentId(document.id);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingDocumentId(undefined);
  };

  const toggleSelectDocument = (docId: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (!data?.documents) return;
    
    const currentPageIds = data.documents.map((doc: Document) => doc.id);
    const allCurrentSelected = currentPageIds.every((id: string) => selectedDocuments.has(id));
    
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (allCurrentSelected) {
        // Remove all current page documents
        currentPageIds.forEach((id: string) => newSet.delete(id));
      } else {
        // Add all current page documents
        currentPageIds.forEach((id: string) => newSet.add(id));
      }
      return newSet;
    });
  };
  
  const areAllCurrentPageSelected = () => {
    if (!data?.documents || data.documents.length === 0) return false;
    return data.documents.every((doc: Document) => selectedDocuments.has(doc.id));
  };

  const handleCreateManifestFromSelection = () => {
    if (selectedDocuments.size === 0) {
      toast({
        title: "Nessun documento selezionato",
        description: "Seleziona almeno un documento per creare un manifest IIIF.",
        variant: "destructive",
      });
      return;
    }
    
    // Filter only image documents for IIIF manifest
    const allDocs = data?.documents || [];
    const selectedDocsArray = Array.from(selectedDocuments);
    const imageDocs = allDocs.filter((doc: Document) => 
      selectedDocsArray.includes(doc.id) && doc.mimeType?.startsWith("image/")
    );
    
    if (imageDocs.length === 0) {
      toast({
        title: "Nessuna immagine selezionata",
        description: "I manifest IIIF richiedono immagini. Seleziona almeno un documento immagine.",
        variant: "destructive",
      });
      return;
    }
    
    if (imageDocs.length < selectedDocsArray.length) {
      toast({
        title: `Filtrato: ${imageDocs.length} di ${selectedDocsArray.length} documenti`,
        description: "Solo i documenti immagine sono stati inclusi nel manifest (PDF e altri file sono stati esclusi).",
      });
    }
    
    // Navigate to upload page with only image document IDs
    const docIds = imageDocs.map((doc: Document) => doc.id).join(',');
    window.location.href = `/admin/upload?documents=${docIds}`;
  };

  const columns: Array<{
    id?: string;
    header: string | (({ table }: any) => React.ReactElement);
    accessorKey?: string;
    cell?: ({ row }: { row: { original: Document } }) => React.ReactNode;
  }> = [
    {
      id: "select",
      header: ({ table }: any) => (
        <Checkbox
          checked={areAllCurrentPageSelected()}
          onCheckedChange={toggleSelectAll}
          aria-label="Seleziona tutti"
          data-testid="checkbox-select-all"
        />
      ),
      cell: ({ row }: { row: { original: Document } }) => (
        <Checkbox
          checked={selectedDocuments.has(row.original.id)}
          onCheckedChange={() => toggleSelectDocument(row.original.id)}
          aria-label="Seleziona documento"
          data-testid={`checkbox-select-${row.original.id}`}
        />
      ),
    },
    {
      header: "Documento",
      accessorKey: "title",
      cell: ({ row }: { row: { original: Document } }) => {
        const doc = row.original;
        // Truncate title if too long
        const truncatedTitle = doc.title && doc.title.length > 50 
          ? doc.title.substring(0, 50) + "..." 
          : doc.title;
        
        const getFileIcon = (mimeType: string | undefined) => {
          if (mimeType?.startsWith("image/")) return "🖼️";
          if (mimeType === "application/pdf") return "📄";
          if (mimeType?.startsWith("video/")) return "🎥";
          if (mimeType?.startsWith("audio/")) return "🎵";
          return "📁";
        };
        
        return (
          <div className="flex items-center">
            <div className="flex-shrink-0 h-12 w-12 relative group">
              {doc.mimeType?.startsWith("image/") && doc.filePath ? (
                <>
                  <img
                    className="h-12 w-12 rounded-lg object-cover border border-border"
                    src={`/objects/${doc.filePath.replace("/objects/", "")}`}
                    alt="Document thumbnail"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling!.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden h-12 w-12 rounded-lg bg-muted border border-border flex items-center justify-center">
                    <span className="text-lg">{getFileIcon(doc.mimeType)}</span>
                  </div>
                  {/* Hover preview */}
                  <div className="absolute left-full ml-2 top-0 z-50 hidden group-hover:block">
                    <div className="bg-popover border border-border rounded-lg shadow-lg p-2">
                      <img
                        className="w-48 h-32 object-cover rounded"
                        src={`/objects/${doc.filePath.replace("/objects/", "")}`}
                        alt="Preview"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <div className="text-xs text-muted-foreground mt-1 text-center">
                        Anteprima immagine
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="h-12 w-12 rounded-lg bg-muted border border-border flex items-center justify-center">
                  <span className="text-lg">{getFileIcon(doc.mimeType)}</span>
                </div>
              )}
            </div>
            <div className="ml-4 min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground truncate" title={doc.title}>
                {truncatedTitle}
              </div>
              <div className="text-sm text-muted-foreground">{doc.archiveCode}</div>
              <div className="text-xs text-muted-foreground">
                {doc.mimeType || "Tipo sconosciuto"}
                {doc.fileSize && (
                  <span className="ml-2">
                    • {doc.fileSize > 1024 * 1024 
                      ? `${(doc.fileSize / (1024 * 1024)).toFixed(1)} MB`
                      : `${(doc.fileSize / 1024).toFixed(1)} KB`}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      header: "Categoria",
      accessorKey: "categoryId",
      cell: ({ row }: { row: { original: Document } }) => {
        const doc = row.original;
        
        // Find category data
        const category = (data?.categories || []).find((cat: any) => cat.id === doc.categoryId);
        const categoryName = category?.name || "Non categorizzato";
        const categoryDescription = category?.description;
        
        // Find subcategory data
        const subcategory = (data?.subcategories || []).find((sub: any) => sub.id === doc.subcategoryId);
        const subcategoryName = subcategory?.name;
        const subcategoryDescription = subcategory?.description;
        
        return (
          <div className="space-y-1 max-w-48">
            <div>
              <Badge variant="secondary" className="text-xs">
                {categoryName}
              </Badge>
              {categoryDescription && (
                <p className="text-xs text-muted-foreground mt-1" title={categoryDescription}>
                  {categoryDescription.length > 40 
                    ? `${categoryDescription.substring(0, 40)}...` 
                    : categoryDescription}
                </p>
              )}
            </div>
            {subcategoryName && (
              <div>
                <Badge variant="outline" className="text-xs">
                  {subcategoryName}
                </Badge>
                {subcategoryDescription && (
                  <p className="text-xs text-muted-foreground mt-1" title={subcategoryDescription}>
                    {subcategoryDescription.length > 40 
                      ? `${subcategoryDescription.substring(0, 40)}...` 
                      : subcategoryDescription}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      },
    },
    {
      header: "Data Creazione",
      accessorKey: "createdAt",
      cell: ({ row }: { row: { original: Document } }) => {
        return new Date(row.original.createdAt!).toLocaleDateString("it-IT");
      },
    },
    {
      header: "Dimensione",
      accessorKey: "fileSize",
      cell: ({ row }: { row: { original: Document } }) => {
        const size = row.original.fileSize;
        if (!size) return "N/A";
        return size > 1024 * 1024 
          ? `${(size / (1024 * 1024)).toFixed(1)} MB`
          : `${(size / 1024).toFixed(1)} KB`;
      },
    },
    {
      header: "Stato",
      accessorKey: "status",
      cell: ({ row }: { row: { original: Document } }) => {
        const status = row.original.status;
        const variant = status === "published" ? "default" : 
                      status === "draft" ? "secondary" : "destructive";
        return (
          <Badge variant={variant}>
            {status === "published" ? "Pubblicato" : 
             status === "draft" ? "Bozza" : "Archiviato"}
          </Badge>
        );
      },
    },
    {
      header: "Azioni",
      id: "actions",
      cell: ({ row }: { row: { original: Document } }) => {
        const doc = row.original;
        return (
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => window.open(`/document/${doc.id}`, '_blank')}
              data-testid={`view-document-${doc.id}`}
              title="Visualizza documento"
            >
              <Eye className="h-4 w-4" />
            </Button>
            {doc.iiifManifestUrl && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  // Normalize manifest URL: extract path if absolute URL
                  let manifestUrl = doc.iiifManifestUrl!;
                  try {
                    const url = new URL(manifestUrl, window.location.origin);
                    manifestUrl = url.pathname; // Extract only the path
                  } catch {
                    // If parsing fails, assume it's already a relative path
                  }
                  window.open(`/manifest-viewer?manifest=${encodeURIComponent(manifestUrl)}`, '_blank');
                }}
                data-testid={`view-iiif-${doc.id}`}
                title="Visualizza IIIF Manifest"
              >
                <FileImage className="h-4 w-4" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => handleEditDocument(doc)}
              data-testid={`edit-document-${doc.id}`}
              title="Modifica documento"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => handleDelete(doc.id)}
              disabled={deleteMutation.isPending}
              data-testid={`delete-document-${doc.id}`}
              title="Elimina documento"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

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
              <h1 className="text-2xl font-bold text-foreground">Gestione Documenti</h1>
              <p className="text-muted-foreground">Amministra i documenti dell'archivio</p>
            </div>
            <div className="flex items-center space-x-4">
              {selectedDocuments.size > 0 && (
                <Button 
                  variant="secondary" 
                  onClick={handleCreateManifestFromSelection}
                  data-testid="button-create-manifest-from-selection"
                >
                  <BookOpen className="mr-2 h-4 w-4" />
                  Crea Manifest da Selezione ({selectedDocuments.size})
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={handleTestFTPUpload}
                data-testid="button-test-ftp"
              >
                🧪 Test FTP Upload
              </Button>
              <Button onClick={handleCreateDocument} data-testid="button-new-document">
                <Plus className="mr-2 h-4 w-4" />
                Nuovo Documento
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* Search and Filters */}
          <div className="bg-card rounded-lg border border-border p-6 mb-6">
            <div className="flex items-center space-x-4">
              <Input
                type="text"
                placeholder="Cerca documenti..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
                data-testid="input-search"
              />
              <Button onClick={handleSearch} data-testid="button-search">
                <Search className="h-4 w-4 mr-2" />
                Cerca
              </Button>
            </div>
          </div>

          {/* Documents Table */}
          <div className="bg-card rounded-lg border border-border shadow-sm">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">
                Documenti ({data?.total || 0})
              </h3>
            </div>

            <DataTable
              data={data?.documents || []}
              columns={columns}
              loading={documentsLoading}
            />

            {/* Pagination */}
            {data && data.total > searchParams.limit && (
              <div className="bg-card px-6 py-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <p className="text-sm text-muted-foreground">
                      Mostra{" "}
                      <span className="font-medium">
                        {(searchParams.page - 1) * searchParams.limit + 1}
                      </span>{" "}
                      a{" "}
                      <span className="font-medium">
                        {Math.min(searchParams.page * searchParams.limit, data.total)}
                      </span>{" "}
                      di <span className="font-medium">{data.total}</span> risultati
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setSearchParams({ ...searchParams, page: searchParams.page - 1 })}
                      disabled={searchParams.page <= 1}
                      data-testid="prev-page"
                    >
                      Precedente
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setSearchParams({ ...searchParams, page: searchParams.page + 1 })}
                      disabled={searchParams.page * searchParams.limit >= data.total}
                      data-testid="next-page"
                    >
                      Successivo
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Edit/Create Document Modal */}
      <EditDocumentModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        documentId={editingDocumentId}
      />
    </div>
  );
}
