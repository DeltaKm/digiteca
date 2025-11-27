import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Document } from "@shared/schema";

interface DocumentCardProps {
  document: Document;
}

export function DocumentCard({ document }: DocumentCardProps) {
  const [, setLocation] = useLocation();

  // Fetch categories and subcategories for enriching document data
  const { data: categoriesData } = useQuery({
    queryKey: ["/api/categories"],
  });

  const { data: subcategoriesData } = useQuery({
    queryKey: ["/api/subcategories"],
  });

  const getCategoryDisplay = () => {
    if (!document.categoryId) return { name: "Non categorizzato", description: null };
    
    const category = (categoriesData || []).find((cat: any) => cat.id === document.categoryId);
    return {
      name: category?.name || "Non categorizzato",
      description: category?.description || null
    };
  };

  const getSubcategoryDisplay = () => {
    if (!document.subcategoryId) return null;
    
    const subcategory = (subcategoriesData || []).find((sub: any) => sub.id === document.subcategoryId);
    return {
      name: subcategory?.name || null,
      description: subcategory?.description || null
    };
  };

  const getImageUrl = () => {
    if (document.filePath && document.mimeType?.startsWith("image/")) {
      return `/objects/${document.filePath.replace("/objects/", "")}`;
    }
    return null;
  };

  const handleView = () => {
    setLocation(`/document/${document.id}`);
  };

  const imageUrl = getImageUrl();

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={handleView}
      data-testid={`document-card-${document.id}`}
    >
      <div className="w-full h-48 bg-muted rounded-t-lg overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={document.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
              target.parentElement!.innerHTML = `
                <div class="w-full h-full flex items-center justify-center bg-muted">
                  <div class="text-center">
                    <div class="text-4xl mb-2">🖼️</div>
                    <p class="text-sm text-muted-foreground">Immagine</p>
                  </div>
                </div>
              `;
            }}
          />
        ) : document.mimeType === "application/pdf" && document.filePath ? (
          <div className="w-full h-full flex items-center justify-center bg-slate-100 relative">
            <iframe
              src={`/objects/${document.filePath.replace("/objects/", "")}#page=1&view=FitH&zoom=50`}
              className="w-full h-full border-0 pointer-events-none"
              title={`PDF Preview - ${document.title}`}
              style={{ 
                transform: 'scale(0.8)', 
                transformOrigin: 'top left',
                width: '125%',
                height: '125%'
              }}
              onError={() => {
                const fallback = document.createElement('div');
                fallback.className = 'w-full h-full flex items-center justify-center bg-muted';
                fallback.innerHTML = `
                  <div class="text-center">
                    <div class="text-4xl mb-2">📄</div>
                    <p class="text-sm text-muted-foreground">PDF</p>
                  </div>
                `;
              }}
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-2">
                {document.mimeType?.startsWith("video/") ? "🎥" :
                 document.mimeType?.startsWith("audio/") ? "🎵" :
                 document.mimeType?.includes("text") ? "📝" : "📄"}
              </div>
              <p className="text-sm text-muted-foreground">
                {document.mimeType?.startsWith("video/") ? "Video" :
                 document.mimeType?.startsWith("audio/") ? "Audio" :
                 document.mimeType?.includes("text") ? "Testo" : "Documento"}
              </p>
            </div>
          </div>
        )}
      </div>
      
      <CardContent className="p-4">
        <div className="space-y-1 mb-2">
          <div className="flex items-center flex-wrap gap-1">
            <Badge 
              variant="secondary" 
              className="text-xs"
              data-testid={`category-badge-${document.id}`}
              title={getCategoryDisplay().description || getCategoryDisplay().name}
            >
              {getCategoryDisplay().name}
            </Badge>
            {getSubcategoryDisplay() && (
              <Badge 
                variant="outline" 
                className="text-xs"
                title={getSubcategoryDisplay()?.description || getSubcategoryDisplay()?.name}
              >
                {getSubcategoryDisplay()?.name}
              </Badge>
            )}
            {document.century && (
              <span className="text-muted-foreground text-xs ml-auto">{document.century}</span>
            )}
          </div>
        </div>
        
        <h4 className="font-semibold text-foreground mb-1 line-clamp-2">
          {document.title}
        </h4>
        
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {document.description || "Nessuna descrizione disponibile"}
        </p>
        
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            ID: {document.archiveCode}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-1"
            onClick={(e) => {
              e.stopPropagation();
              handleView();
            }}
            data-testid={`view-document-${document.id}`}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
