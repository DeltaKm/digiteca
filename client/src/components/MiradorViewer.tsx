import { useEffect, useRef, useState } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface MiradorViewerProps {
  iiifInfoUrl?: string;
  iiifImageUrl?: string;
  imageUrl?: string;
  title?: string;
  className?: string;
  onError?: (error: Error) => void;
}

export function MiradorViewer({ 
  iiifInfoUrl, 
  iiifImageUrl, 
  imageUrl, 
  title = "Document",
  className = "", 
  onError 
}: MiradorViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadViewer = async () => {
      if (!iiifInfoUrl && !iiifImageUrl && !imageUrl) {
        const noImageError = new Error("No image URL provided");
        setError("No image available");
        onError?.(noImageError);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        if (!viewerRef.current) return;

        console.log("MiradorViewer URLs:", {
          iiifInfoUrl,
          iiifImageUrl,
          imageUrl,
          title
        });

        const OpenSeadragon = await import("openseadragon");
        viewerRef.current.innerHTML = '';

        let tileSource: any;

        if (iiifInfoUrl) {
          try {
            const response = await fetch(iiifInfoUrl);
            if (response.ok) {
              const iiifInfo = await response.json();
              tileSource = iiifInfo;
            } else {
              throw new Error(`IIIF info request failed: ${response.status}`);
            }
          } catch (iiifError) {
            console.warn('IIIF info failed, using image URL fallback:', iiifError);
            tileSource = {
              type: "image",
              url: iiifImageUrl || imageUrl,
              crossOriginPolicy: "Anonymous"
            };
          }
        } else if (iiifImageUrl || imageUrl) {
          tileSource = {
            type: "image",
            url: iiifImageUrl || imageUrl,
            crossOriginPolicy: "Anonymous"
          };
        }

        if (!tileSource) {
          throw new Error("No valid image source available");
        }

        viewerInstance.current = OpenSeadragon.default({
          element: viewerRef.current,
          tileSources: tileSource,
          showNavigationControl: true,
          showZoomControl: true,
          showHomeControl: true,
          showFullPageControl: true,
          defaultZoomLevel: 0,
          minZoomLevel: 0.1,
          maxZoomLevel: 10,
          visibilityRatio: 0.5,
          constrainDuringPan: true,
          showSequenceControl: false,
          prefixUrl: "https://openseadragon.github.io/openseadragon/images/",
          timeout: 30000,
          crossOriginPolicy: "Anonymous"
        });

        viewerInstance.current.addHandler("open", () => {
          setIsLoading(false);
          setError(null);
        });

        viewerInstance.current.addHandler("open-failed", (event: any) => {
          console.error("OpenSeadragon failed to open:", event);
          setError("Failed to load image");
          setIsLoading(false);
        });

      } catch (error) {
        console.error("Failed to load viewer:", error);
        const errorMessage = `Failed to initialize viewer: ${error instanceof Error ? error.message : 'Unknown error'}`;
        setError(errorMessage);
        onError?.(error as Error);
        setIsLoading(false);
      }
    };

    loadViewer();

    return () => {
      if (viewerInstance.current) {
        try {
          if (viewerInstance.current.destroy) {
            viewerInstance.current.destroy();
          }
        } catch (e) {
          console.warn("Error cleaning up viewer:", e);
        }
        viewerInstance.current = null;
      }
      if (viewerRef.current) {
        viewerRef.current.innerHTML = '';
      }
    };
  }, [iiifInfoUrl, iiifImageUrl, imageUrl, title, onError]);

  if (error) {
    return (
      <div 
        className={`w-full h-full min-h-[400px] bg-muted border border-border rounded-lg flex items-center justify-center ${className}`}
        data-testid="mirador-viewer-error"
      >
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">Failed to load document</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full min-h-[400px] ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
          <LoadingSpinner size="lg" />
        </div>
      )}
      <div 
        ref={viewerRef} 
        className="w-full h-full"
        data-testid="mirador-viewer"
      />
    </div>
  );
}
