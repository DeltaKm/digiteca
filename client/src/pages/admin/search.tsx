import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { SearchForm } from "@/components/document/search-form";
import { DocumentCard } from "@/components/document/document-card";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Eye, Edit, Trash2, Search as SearchIcon } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Document, SearchDocuments } from "@shared/schema";

export default function Search() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [searchParams, setSearchParams] = useState<SearchDocuments>({
    page: 1,
    limit: 20,
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const [hasSearched, setHasSearched] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

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

  // Fetch categories and subcategories for enriching document data
  const { data: categoriesData } = useQuery({
    queryKey: ["/api/categories"],
    enabled: isAuthenticated,
  });

  const { data: subcategoriesData } = useQuery({
    queryKey: ["/api/subcategories"],
    enabled: isAuthenticated,
  });

  const { data, isLoading: searchLoading, error } = useQuery({
    queryKey: ["/api/documents", searchParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.append(key, value.toString());
        }
      });
      
      const response = await fetch(`/api/documents?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch documents");
      }
      return response.json();
    },
    enabled: isAuthenticated && hasSearched,
    retry: false,
  });

  const handleSearch = (newParams: Partial<SearchDocuments>) => {
    setSearchParams({ ...searchParams, ...newParams, page: 1 });
    setHasSearched(true);
  };

  const handlePageChange = (page: number) => {
    setSearchParams({ ...searchParams, page });
  };

  const totalPages = data ? Math.ceil(data.total / searchParams.limit) : 0;

  const columns = [
    {
      header: "Documento",
      accessorKey: "title" as const,
      cell: ({ row }: { row: { original: Document } }) => {
        const doc = row.original;
        return (
          <div className="flex items-center">
            <div className="flex-shrink-0 h-10 w-10">
              {doc.mimeType?.startsWith("image/") ? (
                <img
                  className="h-10 w-10 rounded-lg object-cover"
                  src={doc.filePath ? `/objects/${doc.filePath.replace("/objects/", "")}` : "/placeholder-image.jpg"}
                  alt="Document thumbnail"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder-image.jpg";
                  }}
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <span className="text-xs font-medium">DOC</span>
                </div>
              )}
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-foreground">{doc.title}</div>
              <div className="text-sm text-muted-foreground">{doc.archiveCode}</div>
            </div>
          </div>
        );
      },
    },
    {
      header: "Categoria", 
      accessorKey: "categoryId" as const,
      cell: ({ row }: { row: { original: Document } }) => {
        const doc = row.original;
        
        // Find category data
        const category = (categoriesData || []).find((cat: any) => cat.id === doc.categoryId);
        const categoryName = category?.name || "Non categorizzato";
        const categoryDescription = category?.description;
        
        // Find subcategory data
        const subcategory = (subcategoriesData || []).find((sub: any) => sub.id === doc.subcategoryId);
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
                  {categoryDescription.length > 50 
                    ? `${categoryDescription.substring(0, 50)}...` 
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
                    {subcategoryDescription.length > 50 
                      ? `${subcategoryDescription.substring(0, 50)}...` 
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
      accessorKey: "createdAt" as const,
      cell: ({ row }: { row: { original: Document } }) => {
        return new Date(row.original.createdAt!).toLocaleDateString("it-IT");
      },
    },
    {
      header: "Dimensione",
      accessorKey: "fileSize" as const,
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
      accessorKey: "status" as const,
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
        return (
          <div className="flex items-center space-x-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => window.open(`/document/${row.original.id}`, '_blank')}
              data-testid="view-document"
            >
              <Eye className="h-4 w-4" />
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
              <h1 className="text-2xl font-bold text-foreground">Ricerca Avanzata</h1>
              <p className="text-muted-foreground">Strumenti di ricerca avanzata per amministratori</p>
            </div>
            <div className="flex items-center space-x-4">
              <SearchIcon className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* Search Form */}
          <div className="bg-card rounded-lg border border-border shadow-sm mb-8">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Filtri di Ricerca</h3>
              <p className="text-muted-foreground">Utilizza i filtri per trovare documenti specifici</p>
            </div>
            <div className="p-6">
              <SearchForm onSearch={handleSearch} />
            </div>
          </div>

          {/* Results */}
          {hasSearched && (
            <div className="bg-card rounded-lg border border-border shadow-sm">
              <div className="p-6 border-b border-border">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-foreground">
                    {data ? `Risultati della ricerca (${data.total} elementi)` : "Ricerca in corso..."}
                  </h3>
                  <div className="flex items-center space-x-4">
                    <select 
                      className="px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                      value={`${searchParams.sortBy}-${searchParams.sortOrder}`}
                      onChange={(e) => {
                        const [sortBy, sortOrder] = e.target.value.split("-");
                        handleSearch({ sortBy: sortBy as any, sortOrder: sortOrder as any });
                      }}
                      data-testid="sort-select"
                    >
                      <option value="createdAt-desc">Ordina per: Più recenti</option>
                      <option value="createdAt-asc">Data di creazione (più vecchi)</option>
                      <option value="title-asc">Titolo A-Z</option>
                      <option value="title-desc">Titolo Z-A</option>
                      <option value="updatedAt-desc">Ultimo aggiornamento</option>
                    </select>
                  </div>
                </div>
              </div>

              {searchLoading && (
                <div className="p-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Ricerca in corso...</p>
                </div>
              )}

              {error && (
                <div className="p-12 text-center">
                  <p className="text-red-600">Errore durante la ricerca</p>
                </div>
              )}

              {data && !searchLoading && (
                <div className="p-6">
                  {/* View Toggle */}
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => setViewMode("grid")}
                        data-testid="grid-view"
                      >
                        <div className="grid grid-cols-2 gap-1 w-4 h-4">
                          <div className="bg-current rounded-sm"></div>
                          <div className="bg-current rounded-sm"></div>
                          <div className="bg-current rounded-sm"></div>
                          <div className="bg-current rounded-sm"></div>
                        </div>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => setViewMode("table")}
                        data-testid="table-view"
                      >
                        <div className="space-y-1 w-4 h-4">
                          <div className="bg-current h-0.5 w-full rounded"></div>
                          <div className="bg-current h-0.5 w-full rounded"></div>
                          <div className="bg-current h-0.5 w-full rounded"></div>
                        </div>
                      </Button>
                    </div>
                  </div>

                  {viewMode === "grid" ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {(data.documents || []).map((document: Document) => (
                        <DocumentCard key={document.id} document={document} />
                      ))}
                    </div>
                  ) : (
                    <DataTable
                      data={data.documents || []}
                      columns={columns}
                      loading={searchLoading}
                      emptyMessage="Nessun documento trovato con i criteri di ricerca specificati"
                    />
                  )}
                </div>
              )}

              {/* Pagination */}
              {data && totalPages > 1 && (
                <div className="p-6 border-t border-border">
                  <div className="flex justify-center">
                    <nav className="flex items-center space-x-2" data-testid="pagination">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(searchParams.page - 1)}
                        disabled={searchParams.page <= 1}
                        data-testid="previous-page"
                      >
                        Precedente
                      </Button>
                      <span className="px-4 py-2 text-sm">
                        Pagina {searchParams.page} di {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(searchParams.page + 1)}
                        disabled={searchParams.page >= totalPages}
                        data-testid="next-page"
                      >
                        Successiva
                      </Button>
                    </nav>
                  </div>
                </div>
              )}
            </div>
          )}

          {!hasSearched && (
            <div className="bg-card rounded-lg border border-border shadow-sm p-12 text-center">
              <SearchIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Inizia una ricerca</h3>
              <p className="text-muted-foreground">
                Utilizza i filtri sopra per cercare documenti specifici nell'archivio
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}