import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/layout/navigation";
import { SearchForm } from "@/components/document/search-form";
import { DocumentCard } from "@/components/document/document-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { SearchDocuments } from "@shared/schema";

export default function Home() {
  const [searchParams, setSearchParams] = useState<SearchDocuments>({
    page: 1,
    limit: 20,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const { data, isLoading, error } = useQuery({
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
  });

  const totalPages = data ? Math.ceil(data.total / searchParams.limit) : 0;

  const handleSearch = (newParams: Partial<SearchDocuments>) => {
    setSearchParams({ ...searchParams, ...newParams, page: 1 });
  };

  const handlePageChange = (page: number) => {
    setSearchParams({ ...searchParams, page });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Search Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-foreground mb-2">Archivio Digitale</h2>
            <p className="text-muted-foreground">Esplora la collezione di documenti e immagini storiche</p>
          </div>
          
          <SearchForm onSearch={handleSearch} />
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-foreground">
            {data ? `Risultati della ricerca (${data.total} elementi)` : "Caricamento..."}
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

        {isLoading && (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        )}

        {error && (
          <EmptyState
            title="Errore nel caricamento"
            description="Si è verificato un errore durante il caricamento dei documenti."
          />
        )}

        {data && (
          <>
            {data.documents.length === 0 ? (
              <EmptyState
                title="Nessun documento trovato"
                description="Prova a modificare i criteri di ricerca."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {data.documents.map((document) => (
                  <DocumentCard key={document.id} document={document} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-8">
                <nav className="flex items-center space-x-2" data-testid="pagination">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(searchParams.page - 1)}
                    disabled={searchParams.page <= 1}
                    data-testid="prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <Button
                        key={page}
                        variant={searchParams.page === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(page)}
                        data-testid={`page-${page}`}
                      >
                        {page}
                      </Button>
                    );
                  })}
                  
                  {totalPages > 5 && (
                    <>
                      {totalPages > 6 && <span className="px-3 py-2 text-muted-foreground">...</span>}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(totalPages)}
                        data-testid={`page-${totalPages}`}
                      >
                        {totalPages}
                      </Button>
                    </>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(searchParams.page + 1)}
                    disabled={searchParams.page >= totalPages}
                    data-testid="next-page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </nav>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
