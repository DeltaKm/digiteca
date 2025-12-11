import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { StatsCards } from "@/components/admin/stats-cards";
import { DataTable } from "@/components/ui/data-table";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Edit, Trash2 } from "lucide-react";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Document } from "@shared/schema";
import type { Category } from "@shared/schema";
import type { Subcategory } from "@shared/schema";

interface DocumentsResponse {
  documents: Document[];
  total: number;
}

interface CategoriesResponse {
  categories: Category[];
}

interface SubCategoriesResponse {
  subcategories: Subcategory[];
}

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

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

  const { data: documentsResponse, isLoading: documentsLoading } = useQuery<DocumentsResponse>({
    queryKey: ["/api/admin/documents", { limit: 10, sortBy: "createdAt", sortOrder: "desc" }],
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch categories and subcategories for enriching document data
  const { data: categoriesData } = useQuery<CategoriesResponse>({
    queryKey: ["/api/categories"],
    enabled: isAuthenticated,
  });

  const { data: subcategoriesData } = useQuery<SubCategoriesResponse>({
    queryKey: ["/api/subcategories"],
    enabled: isAuthenticated,
  });

  const getCategoryName = (categoryId: string | null | undefined) => {
    return categoriesData?.categories.find((cat) => cat.id === categoryId)?.name || "Non categorizzato";
  };

  const getSubcategoryName = (subcategoryId: string | null | undefined) => {
    return subcategoriesData?.subcategories.find((subcat) => subcat.id === subcategoryId)?.name || "Non sottocategorizzato";
  };

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
        const categoryName = getCategoryName(row.original.categoryId);
        const subcategoryName = getSubcategoryName(row.original.subcategoryId);
        return (
          <div className="flex flex-col">
            <Badge variant="secondary">{categoryName}</Badge>
            <Badge variant="outline" className="mt-1">{subcategoryName}</Badge>
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
            <Button variant="ghost" size="sm" data-testid="view-document">
              <Eye className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" data-testid="edit-document">
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" data-testid="delete-document">
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
              <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground">Gestione archivio digitale Digiteca</p>
            </div>
            <div className="flex items-center space-x-4">
              <Button data-testid="button-new-document">
                <Plus className="mr-2 h-4 w-4" />
                Nuovo Documento
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* Stats Cards */}
          <StatsCards />

          {/* Recent Documents Table */}
          <div className="bg-card rounded-lg border border-border shadow-sm mt-8">
            <div className="p-6 border-b border-border">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-foreground">Documenti Recenti</h3>
                <div className="flex items-center space-x-3">
                  <Input
                    type="text"
                    placeholder="Cerca documenti..."
                    className="w-64"
                    data-testid="input-search"
                  />
                  <Button data-testid="button-search">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <DataTable
              data={documentsResponse?.documents || []}
              columns={columns}
              loading={documentsLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}