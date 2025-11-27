
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

declare global {
  interface Window {
    Mirador?: any;
  }
}

export default function ManifestViewer() {
  const [, setLocation] = useLocation();
  const viewerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manifestUrl, setManifestUrl] = useState<string>("");
  const miradorInstance = useRef<any>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const manifest = urlParams.get('manifest');

    if (!manifest) {
      setError("Nessun manifest specificato");
      setIsLoading(false);
      return;
    }

    setManifestUrl(manifest);
    initializeMirador(manifest);

    return () => {
      if (miradorInstance.current) {
        try {
          if (miradorInstance.current.destroy) {
            miradorInstance.current.destroy();
          }
        } catch (e) {
          console.warn("Error cleaning up Mirador:", e);
        }
        miradorInstance.current = null;
      }
    };
  }, []);

  const loadMiradorAssets = (): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      try {
        // Import Mirador JS module (CSS is bundled with the component)
        const Mirador = await import('mirador');
        
        // Make Mirador available globally
        window.Mirador = Mirador;
        
        console.log('✅ Mirador loaded successfully as module');
        resolve();
      } catch (error) {
        console.error('❌ Failed to load Mirador module:', error);
        reject(error);
      }
    });
  };

  const createMiradorFallback = async (manifestUrl: string) => {
    if (!viewerRef.current) return;

    try {
      // Try to load the manifest data to show image preview with retry button
      const response = await fetch(manifestUrl);
      if (response.ok) {
        const manifestData = await response.json();
        const canvases = manifestData.sequences?.[0]?.canvases || [];
        
        let imagesHtml = '';
        if (canvases.length > 0) {
          imagesHtml = `
            <div class="mt-6 w-full max-w-4xl">
              <h4 class="text-md font-medium text-gray-800 mb-4">Pagine disponibili (${canvases.length}):</h4>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${canvases.map((canvas: any, index: number) => {
                  const image = canvas.images?.[0];
                  const imageUrl = image?.resource?.['@id'];
                  const label = canvas.label || `Pagina ${index + 1}`;
                  
                  if (imageUrl) {
                    return `
                      <div class="border border-gray-200 rounded-lg p-3 bg-white">
                        <div class="aspect-square mb-2 bg-gray-100 rounded overflow-hidden">
                          <img 
                            src="${imageUrl}" 
                            alt="${label}"
                            class="w-full h-full object-cover"
                            onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-gray-400\\'>Immagine non disponibile</div>'"
                          />
                        </div>
                        <p class="text-sm font-medium text-gray-900 truncate">${label}</p>
                        ${canvas.description ? `<p class="text-xs text-gray-600 truncate">${canvas.description}</p>` : ''}
                      </div>
                    `;
                  }
                  return `
                    <div class="border border-gray-200 rounded-lg p-3 bg-white">
                      <div class="aspect-square mb-2 bg-gray-100 rounded flex items-center justify-center">
                        <span class="text-gray-400 text-sm">Nessuna immagine</span>
                      </div>
                      <p class="text-sm font-medium text-gray-900 truncate">${label}</p>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }

        viewerRef.current.innerHTML = `
          <div class="w-full h-full flex flex-col items-center justify-start bg-gray-50 border border-gray-200 rounded-lg overflow-y-auto p-8">
            <div class="text-center">
              <div class="mb-4">
                <svg class="w-16 h-16 mx-auto text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
              </div>
              <h3 class="text-lg font-medium text-gray-900 mb-2">${manifestData.label || 'Documento IIIF'}</h3>
              <p class="text-gray-600 mb-4">Mirador non è riuscito a caricarsi. Riprova o visualizza le immagini qui sotto.</p>
              <div class="flex gap-3 justify-center">
                <button onclick="window.location.reload()" class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                  </svg>
                  Riprova con Mirador
                </button>
                <a href="${manifestUrl}" target="_blank" class="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                  </svg>
                  Visualizza JSON
                </a>
              </div>
            </div>
            ${imagesHtml}
          </div>
        `;
      } else {
        throw new Error('Cannot load manifest');
      }
    } catch (error) {
      console.warn('Error creating enhanced fallback:', error);
      
      // Basic fallback
      viewerRef.current.innerHTML = `
        <div class="w-full h-full flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-lg">
          <div class="text-center p-8">
            <div class="mb-4">
              <svg class="w-16 h-16 mx-auto text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">Errore nel caricamento</h3>
            <p class="text-gray-600 mb-4">Non è possibile caricare il documento IIIF.</p>
            <div class="flex gap-3 justify-center">
              <button onclick="window.location.reload()" class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                </svg>
                Riprova
              </button>
              <a href="${manifestUrl}" target="_blank" class="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                </svg>
                Visualizza JSON
              </a>
            </div>
          </div>
        </div>
      `;
    }
  };

  const initializeMirador = async (manifestUrl: string) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!viewerRef.current) return;

      console.log("Initializing Mirador for manifest:", manifestUrl);

      // Clear any existing content
      viewerRef.current.innerHTML = '';

      // Verify the manifest is accessible first
      try {
        console.log("Fetching manifest:", manifestUrl);
        const response = await fetch(manifestUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json, application/ld+json',
            'Cache-Control': 'no-cache'
          }
        });

        if (!response.ok) {
          throw new Error(`Manifest non trovato: ${response.status} ${response.statusText}`);
        }

        const manifestData = await response.json();
        console.log("Manifest loaded:", manifestData);

        if (!manifestData) {
          throw new Error("Dati del manifest vuoti");
        }

        if (!manifestData.sequences && !manifestData.items) {
          throw new Error("Manifest non valido: mancano sequences o items");
        }

      } catch (manifestError: any) {
        console.error("Manifest validation failed:", manifestError);
        await createMiradorFallback(manifestUrl);
        setIsLoading(false);
        return;
      }

      // Try to load Mirador
      try {
        console.log("Loading Mirador assets...");
        await loadMiradorAssets();

        if (!window.Mirador) {
          throw new Error("Mirador non disponibile dopo il caricamento");
        }

        // Create a unique container ID
        const containerId = `mirador-viewer-${Date.now()}`;
        viewerRef.current.id = containerId;

        const config = {
          id: containerId,
          manifests: {
            [manifestUrl]: {
              provider: "IIIF Manifest"
            }
          },
          windows: [{
            manifestId: manifestUrl,
            canvasId: null
          }],
          workspaceControlPanel: {
            enabled: true
          },
          window: {
            allowClose: false,
            allowMaximize: true,
            allowTopMenuButton: false,
            allowWindowSideBar: true,
            sideBarOpenByDefault: false,
            defaultSidebarPanelWidth: 280,
            panels: {
              info: true,
              attribution: true,
              canvas: true,
              annotations: false,
              search: false,
              layers: false
            }
          },
          workspace: {
            showZoomControls: true,
            type: "single",
            isWorkspaceAddVisible: false
          },
          thumbnailNavigation: {
            displaySettings: true,
            defaultPosition: 'far-left',
            height: 150,
            width: 150
          }
        };

        console.log("Creating Mirador instance with config:", config);
        
        try {
          // Use the imported Mirador module directly
          const MiradorViewer = window.Mirador.default || window.Mirador;
          miradorInstance.current = MiradorViewer.viewer(config);
          console.log("✅ Mirador instance created successfully");
          
          // Set a longer timeout for complex manifests
          setTimeout(() => {
            setIsLoading(false);
            setError(null);
            console.log("🎉 Mirador viewer ready");
          }, 3000);
          
        } catch (miradorCreationError) {
          console.error("❌ Failed to create Mirador instance:", miradorCreationError);
          throw miradorCreationError;
        }

      } catch (miradorError: any) {
        console.warn("Mirador failed, showing retry option:", miradorError);
        await createMiradorFallback(manifestUrl);
        setIsLoading(false);
      }

    } catch (error: any) {
      console.error("Failed to initialize viewer:", error);
      await createMiradorFallback(manifestUrl);
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">Errore</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => setLocation("/admin/manifests")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Torna ai Manifest
            </Button>
            {manifestUrl && (
              <Button 
                variant="outline"
                onClick={() => window.open(manifestUrl, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Vedi JSON
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/admin/manifests")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Torna ai Manifest
          </Button>
          <h1 className="text-lg font-semibold">Visualizzatore Manifest IIIF</h1>
        </div>

        {manifestUrl && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(manifestUrl, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Vedi JSON
          </Button>
        )}
      </div>

      {/* Viewer */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center">
              <LoadingSpinner className="mx-auto mb-4" />
              <p className="text-muted-foreground">Caricamento visualizzatore IIIF...</p>
              <p className="text-sm text-muted-foreground mt-2">Caricamento librerie Mirador...</p>
            </div>
          </div>
        )}

        <div 
          ref={viewerRef} 
          className={`w-full h-full min-h-[calc(100vh-80px)] ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}
          style={{ height: 'calc(100vh - 80px)' }}
        />
      </div>
    </div>
  );
}
