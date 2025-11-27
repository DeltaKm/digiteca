import { useEffect, useRef, useState, useCallback } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface IIIFViewerProps {
  // IIIF URLs (prioritized in this order)
  iiifInfoUrl?: string;
  iiifImageUrl?: string;
  // Fallback image URL
  imageUrl?: string;
  className?: string;
  onError?: (error: Error) => void;
}

export function IIIFViewer({ iiifInfoUrl, iiifImageUrl, imageUrl, className = "", onError }: IIIFViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstanceRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSource, setCurrentSource] = useState<'iiif-info' | 'iiif-image' | 'fallback' | null>(null);
  const [tileFailureCount, setTileFailureCount] = useState(0);
  const retryAttempts = useRef(0);
  const maxRetries = 2;

  const attemptFallback = useCallback(async (OpenSeadragon: any) => {
    console.warn('Attempting fallback due to tile failures or IIIF issues');

    if (viewerInstanceRef.current) {
      try {
        viewerInstanceRef.current.destroy();
      } catch (e) {
        console.warn('Error destroying viewer during fallback:', e);
      }
      viewerInstanceRef.current = null;
    }

    // Try fallback to regular image display
    if (imageUrl && currentSource !== 'fallback') {
      setCurrentSource('fallback');
      console.log('Falling back to regular image display:', imageUrl);

      const fallbackTileSource = {
        type: "image",
        url: imageUrl,
        crossOriginPolicy: "Anonymous"
      };

      try {
        await createViewer(OpenSeadragon, fallbackTileSource);
        return true;
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        return false;
      }
    }

    return false;
  }, [imageUrl, currentSource]);

  const createViewer = useCallback(async (OpenSeadragon: any, tileSource: any) => {
    if (!viewerRef.current) return;

    viewerInstanceRef.current = OpenSeadragon.default({
      element: viewerRef.current,
      tileSources: tileSource,
      prefixUrl: "https://openseadragon.github.io/openseadragon/images/",
      showNavigationControl: true,
      showZoomControl: true,
      showHomeControl: true,
      showFullPageControl: true,
      showRotationControl: true,
      crossOriginPolicy: "Anonymous",
      gestureSettingsMouse: {
        clickToZoom: false,
        dblClickToZoom: true,
        dragToPan: true,
        scrollToZoom: true,
      },
      gestureSettingsTouch: {
        clickToZoom: false,
        dblClickToZoom: true,
        dragToPan: true,
        scrollToZoom: true,
        pinchToZoom: true,
      },
      animationTime: 1.2,
      blendTime: 0.1,
      constrainDuringPan: true,
      maxZoomPixelRatio: 2,
      minZoomLevel: 0.1,
      visibilityRatio: 1,
      zoomPerScroll: 1.2,
      // Increase timeout for IIIF requests
      timeout: 30000,
      // Configure tile loading
      loadTilesWithAjax: true,
      ajaxWithCredentials: false,
      // Disable WebGL to avoid graphics card compatibility issues
      useCanvas: true,
      webglEnabled: false,
      // Add error handling for better user experience
      debugMode: false,
      silenceMultiImageWarnings: true,
    });

    // Enhanced error handling with fallback mechanisms
    viewerInstanceRef.current.addHandler("open-failed", async (event: any) => {
      console.error('OpenSeadragon open-failed event:', event);

      retryAttempts.current++;

      if (retryAttempts.current <= maxRetries) {
        console.log(`Retrying... attempt ${retryAttempts.current}/${maxRetries}`);
        // Wait a bit before retrying
        setTimeout(() => {
          if (viewerInstanceRef.current) {
            viewerInstanceRef.current.open(tileSource);
          }
        }, 1000 * retryAttempts.current);
        return;
      }

      // After exhausting retries, try fallback
      const fallbackSuccess = await attemptFallback(OpenSeadragon);

      if (!fallbackSuccess) {
        const failureMessage = `Failed to load image: ${event.message || 'Unknown error'}`;
        console.error(failureMessage);
        setError(failureMessage);
        onError?.(new Error(failureMessage));
        setIsLoading(false);
      }
    });

    viewerInstanceRef.current.addHandler("tile-load-failed", async (event: any) => {
      console.warn("Tile load failed:", event);
      setTileFailureCount(prev => {
        const newCount = prev + 1;

        // If we have too many tile failures, attempt fallback
        if (newCount > 5 && currentSource !== 'fallback') {
          console.warn(`Too many tile failures (${newCount}), attempting fallback`);
          setTimeout(() => attemptFallback(OpenSeadragon), 100);
        }

        return newCount;
      });
    });

    viewerInstanceRef.current.addHandler("open", () => {
      console.log("Image loaded successfully with source:", currentSource);
      setIsLoading(false);
      setError(null);
      retryAttempts.current = 0;
      setTileFailureCount(0);
    });

    viewerInstanceRef.current.addHandler("tile-loaded", () => {
      // Ensure loading state is cleared when first tiles load
      if (isLoading) {
        setIsLoading(false);
      }
    });

    // Handle network errors more gracefully
    viewerInstanceRef.current.addHandler("tile-drawing", (event: any) => {
      // This event fires when tiles are being drawn, indicating some success
      if (tileFailureCount > 0) {
        console.log('Tiles are rendering despite some failures, continuing...');
      }
    });
  }, [isLoading, attemptFallback, currentSource, tileFailureCount, onError, maxRetries]);

  useEffect(() => {
    const loadOpenSeadragon = async () => {
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

        // Dynamically import OpenSeadragon
        const OpenSeadragon = await import("openseadragon");

        if (viewerRef.current && !viewerInstanceRef.current) {
          // Reset state for new loading attempt
          retryAttempts.current = 0;
          setTileFailureCount(0);

          // Determine the best tileSource to use with progressive fallback strategy
          let tileSource: any;

          if (iiifInfoUrl) {
            // Try IIIF Image API info.json first (preferred method)
            try {
              console.log('Attempting to load IIIF info.json:', iiifInfoUrl);
              const response = await fetch(iiifInfoUrl, { 
                timeout: 10000,
                headers: {
                  'Accept': 'application/json'
                }
              });

              if (response.ok) {
                const iiifInfo = await response.json();

                // Validate IIIF info structure
                if (iiifInfo.width && iiifInfo.height && iiifInfo['@id']) {
                  tileSource = iiifInfo;
                  setCurrentSource('iiif-info');
                  console.log('Successfully loaded IIIF info.json with dimensions:', iiifInfo.width, 'x', iiifInfo.height);
                } else {
                  throw new Error('Invalid IIIF info.json structure');
                }
              } else {
                throw new Error(`IIIF info.json failed: ${response.status} ${response.statusText}`);
              }
            } catch (iiifError) {
              console.warn('IIIF info.json failed, trying next option:', iiifError);
              // Fall through to next option
            }
          }

          if (!tileSource && iiifImageUrl) {
            // Try IIIF Image URL (less preferred but still IIIF)
            console.log('Attempting to use IIIF image URL:', iiifImageUrl);
            tileSource = iiifImageUrl;
            setCurrentSource('iiif-image');
          }

          if (!tileSource && imageUrl) {
            // Fallback to regular image
            console.log('Falling back to regular image URL:', imageUrl);
            tileSource = {
              type: "image",
              url: imageUrl,
              crossOriginPolicy: "Anonymous"
            };
            setCurrentSource('fallback');
          }

          if (!tileSource) {
            throw new Error("No valid tile source available");
          }

          await createViewer(OpenSeadragon, tileSource);
        }
      } catch (error) {
        console.error("Failed to load OpenSeadragon:", error);
        const errorMessage = `Failed to initialize viewer: ${error instanceof Error ? error.message : 'Unknown error'}`;
        setError(errorMessage);
        onError?.(error as Error);
        setIsLoading(false);
      }
    };

    loadOpenSeadragon();

    return () => {
      if (viewerInstanceRef.current) {
        try {
          viewerInstanceRef.current.destroy();
        } catch (e) {
          console.warn("Error destroying OpenSeadragon viewer:", e);
        }
        viewerInstanceRef.current = null;
      }
      // Reset state on cleanup
      setCurrentSource(null);
      setTileFailureCount(0);
      retryAttempts.current = 0;
    };
  }, [iiifInfoUrl, iiifImageUrl, imageUrl, createViewer]);

  if (error) {
    return (
      <div 
        className={`w-full h-full min-h-[400px] bg-muted border border-border rounded-lg flex items-center justify-center ${className}`}
        data-testid="iiif-viewer-error"
      >
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">Failed to load image</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full min-h-[400px] ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-muted border border-border rounded-lg flex items-center justify-center z-10">
          <div className="text-center">
            <LoadingSpinner className="mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading image...</p>
          </div>
        </div>
      )}
      <div 
        ref={viewerRef} 
        className={`w-full h-full min-h-[400px] bg-muted border border-border rounded-lg ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        data-testid="iiif-viewer"
      />
    </div>
  );
}