import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MiradorViewer } from "@/components/MiradorViewer";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Download, Share2, Calendar, MapPin, User, Folder, Info, FileText, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import type { Document } from "@shared/schema";
import { useState } from "react";

interface DocumentViewerProps {
  params: { id: string };
}

export default function DocumentViewer({ params }: DocumentViewerProps) {
  const [, setLocation] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (!isFullscreen) {
      // Quando si entra in fullscreen, nascondi automaticamente la sidebar
      setIsSidebarOpen(false);
    }
  };

  const { data: documentData, isLoading, error } = useQuery({
    queryKey: ["/api/documents", params.id],
    queryFn: async () => {
      const response = await fetch(`/api/documents/${params.id}`);
      if (!response.ok) {
        throw new Error("Document not found");
      }
      return response.json() as Promise<Document>;
    },
  });

  // Fetch categories and subcategories for enriching document data
  const { data: categoriesData } = useQuery({
    queryKey: ["/api/categories"],
  });

  const { data: subcategoriesData } = useQuery({
    queryKey: ["/api/subcategories"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !documentData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <EmptyState
          title="Documento non trovato"
          description="Il documento richiesto non esiste o non è disponibile."
        />
      </div>
    );
  }

  const getCategoryDetails = () => {
    if (!documentData?.categoryId) return { name: "Non categorizzato", description: null };

    const category = (categoriesData || []).find((cat: any) => cat.id === documentData.categoryId);
    return {
      name: category?.name || "Non categorizzato",
      description: category?.description || null
    };
  };

  const getSubcategoryDetails = () => {
    if (!documentData?.subcategoryId) return null;

    const subcategory = (subcategoriesData || []).find((sub: any) => sub.id === documentData.subcategoryId);
    return {
      name: subcategory?.name || null,
      description: subcategory?.description || null
    };
  };

  const isImage = documentData?.mimeType?.startsWith("image/");
  const imageUrl = documentData?.filePath ? `/objects/${documentData.filePath.replace("/objects/", "")}` : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => setLocation("/")}
                data-testid="button-back"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Torna alla ricerca
              </Button>
              <div className="h-6 w-px bg-border" />
              <h1 className="text-xl font-semibold text-foreground">Visualizzazione Documento</h1>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" data-testid="button-share">
                <Share2 className="mr-2 h-4 w-4" />
                Condividi
              </Button>
              {documentData.filePath && (
                <Button variant="outline" size="sm" data-testid="button-download">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={`grid grid-cols-1 ${isSidebarOpen && !isFullscreen ? 'lg:grid-cols-[1fr,380px]' : ''} gap-8 transition-all duration-300`}>
          {/* Main Content - Viewer */}
          <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-background p-4' : 'relative'}`}>
            <Card className={isFullscreen ? 'h-full rounded-lg border shadow-2xl' : ''}>
              <CardHeader className={isFullscreen ? 'py-3 px-6' : ''}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className={`mb-2 ${isFullscreen ? 'text-lg' : 'text-2xl'}`}>{documentData.title}</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">
                        {getCategoryDetails().name}
                      </Badge>
                      {getSubcategoryDetails() && (
                        <Badge variant="outline">
                          {getSubcategoryDetails()?.name}
                        </Badge>
                      )}
                      {documentData.period && (
                        <Badge variant="outline">{documentData.period}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {documentData.mimeType === "application/pdf" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={toggleFullscreen}
                          title={isFullscreen ? "Esci da schermo intero" : "Schermo intero componente"}
                        >
                          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const iframe = window.document.querySelector('iframe[title*="PDF Viewer"]') as HTMLIFrameElement;
                            if (iframe?.requestFullscreen) {
                              iframe.requestFullscreen();
                            }
                          }}
                          title="Schermo intero browser"
                        >
                          <Maximize2 className="h-4 w-4 mr-1" />
                          Browser
                        </Button>
                      </>
                    )}
                    {!isFullscreen && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="lg:flex hidden"
                        title={isSidebarOpen ? "Nascondi dettagli" : "Mostra dettagli"}
                      >
                        {isSidebarOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                      </Button>
                    )}
                    {!isFullscreen && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">ID Archivio</p>
                        <p className="font-mono text-xs">{documentData.archiveCode}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className={isFullscreen ? 'h-[calc(100%-80px)]' : ''}>
                {/* Document Viewer */}
                <div className={`w-full bg-background border border-border rounded-lg overflow-hidden ${
                  isFullscreen ? 'h-full' : 'h-[600px] lg:h-[700px] xl:h-[800px]'
                }`}>
                  {documentData.mimeType === "application/json" && documentData.iiifManifestUrl ? (
                    // Display IIIF Manifest with Mirador - this is a multi-page book/document
                    <div className="w-full h-full relative">
                      <iframe
                        src={`/manifest-viewer?manifest=${encodeURIComponent(documentData.iiifManifestUrl)}`}
                        className="w-full h-full border-0"
                        title={`Manifest IIIF: ${documentData.title}`}
                        allow="fullscreen"
                        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                        onLoad={() => console.log("Manifest viewer iframe loaded")}
                        onError={(e) => {
                          console.error("Manifest viewer iframe error:", e);
                          // Show fallback message
                          const iframe = e.target as HTMLIFrameElement;
                          if (iframe.parentElement) {
                            iframe.style.display = 'none';
                            const errorDiv = document.createElement('div');
                            errorDiv.className = 'w-full h-full flex items-center justify-center bg-muted';
                            errorDiv.innerHTML = `
                              <div class="text-center">
                                <p class="text-lg font-medium">Errore nel caricamento del manifest</p>
                                <p class="text-sm text-muted-foreground mt-2">Impossibile visualizzare il documento IIIF</p>
                                <a href="${documentData.iiifManifestUrl}" target="_blank" class="mt-4 inline-block px-4 py-2 bg-primary text-primary-foreground rounded">
                                  Visualizza JSON
                                </a>
                              </div>
                            `;
                            iframe.parentElement.appendChild(errorDiv);
                          }
                        }}
                      />
                    </div>
                  ) : isImage && (documentData.iiifInfoUrl || documentData.iiifImageUrl || imageUrl) ? (
                    // Display single image with IIIF or fallback
                    <MiradorViewer
                      iiifInfoUrl={documentData.iiifInfoUrl}
                      iiifImageUrl={documentData.iiifImageUrl}
                      imageUrl={imageUrl}
                      title={documentData.title}
                      className="w-full h-full"
                      onError={(error) => {
                        console.error("Mirador Viewer error:", error);
                      }}
                    />
                  ) : documentData.mimeType === "application/pdf" && documentData.filePath ? (
                    // Display PDF
                    <div className={`w-full bg-white rounded-lg overflow-hidden ${
                      isFullscreen ? 'h-full' : 'h-full'
                    }`}>
                      <iframe
                        src={`/objects/${documentData.filePath.replace("/objects/", "")}#view=FitH&toolbar=1&navpanes=1`}
                        className="w-full h-full border-0"
                        title={`PDF Viewer - ${documentData.title}`}
                        allow="fullscreen"
                      />
                    </div>
                  ) : (
                    <div className="h-[600px] w-full bg-muted rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <Folder className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <p className="text-lg font-medium text-foreground">Documento</p>
                        <p className="text-sm text-muted-foreground">
                          {documentData.mimeType || "Tipo di file sconosciuto"}
                        </p>
                        {documentData.filePath && (
                          <Button
                            className="mt-4"
                            data-testid="button-view-document"
                            onClick={() => window.open(`/objects/${documentData.filePath.replace("/objects/", "")}`, '_blank')}
                          >
                            Visualizza Documento
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Metadata */}
          {!isFullscreen && (
            <div className={`space-y-6 transition-all duration-300 ${
              isSidebarOpen ? 'block' : 'hidden lg:hidden'
            }`}>
            {/* Description */}
            {documentData.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Descrizione</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground leading-relaxed">
                    {documentData.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Category Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Classificazione</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Folder className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Categoria</p>
                    <p className="text-sm text-foreground">{getCategoryDetails().name}</p>
                    {getCategoryDetails().description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {getCategoryDetails().description}
                      </p>
                    )}
                  </div>
                </div>

                {getSubcategoryDetails() && (
                  <div className="flex items-start space-x-3">
                    <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Sottocategoria</p>
                      <p className="text-sm text-foreground">{getSubcategoryDetails()?.name}</p>
                      {getSubcategoryDetails()?.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {getSubcategoryDetails()?.description}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informazioni</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {documentData.author && (
                  <div className="flex items-center space-x-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Autore</p>
                      <p className="text-sm text-muted-foreground">{documentData.author}</p>
                    </div>
                  </div>
                )}

                {documentData.dateCreated && (
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Data di Creazione</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(documentData.dateCreated).toLocaleDateString("it-IT")}
                      </p>
                    </div>
                  </div>
                )}

                {documentData.location && (
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Luogo</p>
                      <p className="text-sm text-muted-foreground">{documentData.location}</p>
                    </div>
                  </div>
                )}

                <Separator />

                {documentData.materials && (
                  <div>
                    <p className="text-sm font-medium mb-1">Materiali</p>
                    <p className="text-sm text-muted-foreground">{documentData.materials}</p>
                  </div>
                )}

                {documentData.dimensions && (
                  <div>
                    <p className="text-sm font-medium mb-1">Dimensioni</p>
                    <p className="text-sm text-muted-foreground">{documentData.dimensions}</p>
                  </div>
                )}

                {documentData.condition && (
                  <div>
                    <p className="text-sm font-medium mb-1">Condizioni</p>
                    <p className="text-sm text-muted-foreground">{documentData.condition}</p>
                  </div>
                )}

                {documentData.provenance && (
                  <div>
                    <p className="text-sm font-medium mb-1">Provenienza</p>
                    <p className="text-sm text-muted-foreground">{documentData.provenance}</p>
                  </div>
                )}

                {documentData.fileSize && (
                  <div>
                    <p className="text-sm font-medium mb-1">Dimensione File</p>
                    <p className="text-sm text-muted-foreground">
                      {documentData.fileSize > 1024 * 1024
                        ? `${(documentData.fileSize / (1024 * 1024)).toFixed(1)} MB`
                        : `${(documentData.fileSize / 1024).toFixed(1)} KB`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tags and Keywords */}
            {(documentData.tags?.length || documentData.keywords?.length) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tag e Parole Chiave</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {documentData.tags?.length && (
                    <div>
                      <p className="text-sm font-medium mb-2">Tag</p>
                      <div className="flex flex-wrap gap-1">
                        {documentData.tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {documentData.keywords?.length && (
                    <div>
                      <p className="text-sm font-medium mb-2">Parole Chiave</p>
                      <div className="flex flex-wrap gap-1">
                        {documentData.keywords.map((keyword, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
}