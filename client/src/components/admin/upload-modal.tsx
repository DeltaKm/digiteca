import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ObjectUploader } from "@/components/ObjectUploader";
import { ManifestEditor } from "@/components/admin/manifest-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, Image, X, CheckCircle, AlertCircle, BookOpen } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Badge } from "@/components/ui/badge";
import type { Category, InsertDocument } from "@shared/schema";
import { Plus } from "lucide-react";

// Helper function for API requests
const apiRequest = async (method: string, url: string, body?: any) => {
  const csrfData = await fetch('/api/csrf-token', {
    credentials: 'include'
  }).then(r => r.json());

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfData.csrfToken,
    },
    credentials: 'include',
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return fetch(url, options);
};

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedDocumentIds?: string[];
}

interface UploadedImage {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: string;
  width?: number;
  height?: number;
}

export function UploadModal({ isOpen, onClose, preselectedDocumentIds }: UploadModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const initialFormData = {
    title: "",
    description: "",
    categoryId: "",
    subcategoryId: "",
    author: "",
    location: "",
    period: "",
    century: "",
    materials: "",
    dimensions: "",
    condition: "",
    provenance: "",
    tags: [],
    keywords: [],
    status: "draft",
    isPublic: true,
    // Regesti specific fields
    documentType: "",
    transcriptionEditor: "",
    languageOriginal: "",
    languageTranscription: "",
    languageTranslation: "",
    textRegesto: "",
    textTranscription: "",
    textTranslation: "",
    textAbstract: "",
    textEdition: "",
    transcriptionNotes: "",
    corrediLinks: [],
    rightsLicense: "",
    qcStatus: "",
    masterFormat: "",
    masterUri: "",
    sourceReference: "",
    subjects: [],
  };

  const [formData, setFormData] = useState<Partial<InsertDocument>>(initialFormData);

  const [tagInput, setTagInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [uploadedFile, setUploadedFile] = useState<{
    url: string;
    filename: string;
    size: number;
    type: string;
    width?: number;
    height?: number;
  } | null>(null);

  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadMode, setUploadMode] = useState<'single' | 'manifest'>('single'); // Default to single file upload
  const [showManifestEditor, setShowManifestEditor] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Load preselected documents if provided
  const { data: preselectedDocuments, isLoading: loadingPreselected, error: preselectedError } = useQuery({
    queryKey: ["/api/admin/documents/batch", preselectedDocumentIds],
    queryFn: async () => {
      if (!preselectedDocumentIds || preselectedDocumentIds.length === 0) return null;

      // Fetch each document using authenticated API
      try {
        const promises = preselectedDocumentIds.map(async id => {
          const response = await apiRequest("GET", `/api/documents/${id}`);
          if (!response.ok) {
            throw new Error(`Failed to load document ${id}`);
          }
          return response.json();
        });
        return Promise.all(promises);
      } catch (error) {
        console.error('Error loading preselected documents:', error);
        throw error;
      }
    },
    enabled: !!preselectedDocumentIds && preselectedDocumentIds.length > 0,
    retry: 1,
  });

  // Show error toast if preselected documents fail to load
  useEffect(() => {
    if (preselectedError) {
      toast({
        title: "Errore",
        description: "Impossibile caricare alcuni documenti selezionati. Verifica i permessi.",
        variant: "destructive",
      });
    }
  }, [preselectedError, toast]);

  // When preselected documents are loaded, switch to manifest mode
  useEffect(() => {
    if (preselectedDocuments && preselectedDocuments.length > 0) {
      // Convert documents to uploadedImages format for manifest editor
      // Include all documents with file paths (images, PDFs, videos, etc.)
      const images = preselectedDocuments
        .filter(doc => doc.filePath)
        .map((doc, index) => ({
          id: doc.id,
          url: `/objects/${doc.filePath.replace("/objects/", "")}`,
          filename: doc.originalFileName || doc.fileName || `Document ${index + 1}`,
          size: doc.fileSize || 0,
          type: doc.mimeType || 'application/octet-stream',
          width: doc.width,
          height: doc.height,
        }));

      if (images.length === 0) {
        // No usable files - show warning and stay in normal mode
        toast({
          title: "Attenzione",
          description: "Nessuno dei documenti selezionati contiene file caricabili.",
          variant: "destructive",
        });
        // Reset state so user can try again
        setUploadMode('single');
        setShowManifestEditor(false);
        setUploadedImages([]);
        return;
      }

      // Only switch to manifest editor if we have usable files
      setUploadMode('manifest');
      setUploadedImages(images);
      setShowManifestEditor(true);

      toast({
        title: "Documenti caricati",
        description: `${images.length} documento/i caricato/i per il manifest.`,
      });
    }
  }, [preselectedDocuments, toast]);

  // Fetch CSRF token once
  const { data: csrfToken } = useQuery({
    queryKey: ["/api/csrf-token"],
    queryFn: async () => await fetch('/api/csrf-token').then(r => r.json()),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Helper function to check if Regesti category is selected
  const isRegestiSelected = () => {
    if (!formData.categoryId || !categories) return false;
    const selectedCategory = categories.find(cat => cat.id === formData.categoryId);
    return selectedCategory?.slug === "regesti";
  };

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Fetch all subcategories (filtering is done in UI based on selected category)
  const { data: subcategories } = useQuery<Array<{id: string; name: string; categoryId: string}>>({
    queryKey: ["/api/subcategories"],
    queryFn: async () => {
      const response = await fetch(`/api/subcategories`);
      if (!response.ok) {
        throw new Error('Failed to fetch subcategories');
      }
      return response.json();
    },
  });

  const createDocumentMutation = useMutation({
    mutationFn: async (document: InsertDocument) => {
      const response = await apiRequest("POST", "/api/admin/documents", document);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Documento creato",
        description: "Il documento è stato creato con successo.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      handleReset();
      onClose();
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
        description: "Errore durante la creazione del documento.",
        variant: "destructive",
      });
    },
  });

  const updateDocumentFileMutation = useMutation({
    mutationFn: async ({ documentId, fileData }: { documentId: string; fileData: any }) => {
      await apiRequest("PUT", `/api/admin/documents/${documentId}/file`, fileData);
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
        description: "Errore durante l'aggiornamento del file.",
        variant: "destructive",
      });
    },
  });

  const fileUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      console.log('🔵 CLIENT: Starting file upload mutation');
      console.log('📄 File:', file.name, 'Size:', file.size);
      
      // Get CSRF token
      const csrfData = await fetch('/api/csrf-token', {
        credentials: 'include'
      }).then(r => r.json());

      // Get category name if available
      const categoryName = formData.categoryId 
        ? categories?.find(c => c.id === formData.categoryId)?.name 
        : undefined;

      // Get subcategory name if available
      const subcategoryName = formData.subcategoryId 
        ? subcategories?.find(s => s.id === formData.subcategoryId)?.name 
        : undefined;

      console.log('📁 Category:', categoryName, 'Subcategory:', subcategoryName);

      // Build query params
      const params = new URLSearchParams({
        category: categoryName || 'general',
        filename: file.name,
      });
      
      if (subcategoryName) {
        params.append('subcategory', subcategoryName);
      }

      const uploadUrl = `/api/ftp/upload?${params.toString()}`;
      console.log('🌐 Upload URL:', uploadUrl);

      // Upload file directly to FTP server via our API
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        body: file,
        headers: {
          "Content-Type": file.type,
          "X-CSRF-Token": csrfData.csrfToken,
        },
        credentials: 'include',
      });

      console.log('📡 Upload response status:', uploadResponse.status);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('❌ Upload failed:', errorText);
        throw new Error("Upload failed");
      }

      const result = await uploadResponse.json();
      console.log('✅ Upload successful:', result);

      return {
        url: result.path || result.url,
        filename: file.name,
        size: file.size,
        type: file.type,
      };
    },
    onSuccess: (fileData) => {
      console.log('✅ CLIENT: File upload mutation success:', fileData);
      setUploadedFile(fileData);

      toast({
        title: "File caricato",
        description: `Il file ${fileData.filename} è stato caricato con successo.`,
      });
    },
    onError: (error) => {
      console.error('❌ CLIENT: File upload mutation error:', error);
      toast({
        title: "Errore",
        description: "Errore durante il caricamento del file.",
        variant: "destructive",
      });
    },
  });

  const extractImageDimensions = (file: File): Promise<{width: number, height: number}> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img');
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileUpload = async (result: any) => {
    try {
      setIsUploading(true);

      if (result.successful && result.successful.length > 0) {
        if (uploadMode === 'single') {
          // Single file upload (existing logic)
          const file = result.successful[0];
          const uploadURL = file.uploadURL;

          console.log("File uploaded successfully:", file);

          // Extract file metadata
          let width: number | undefined;
          let height: number | undefined;

          // Try to extract dimensions if it's an image
          if (file.type?.startsWith('image/')) {
            try {
              const img = document.createElement('img');
              const dimensions = await new Promise<{width: number, height: number}>((resolve, reject) => {
                img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
                img.onerror = reject;
                img.src = uploadURL;
              });
              width = dimensions.width;
              height = dimensions.height;
            } catch (error) {
              console.warn("Could not extract image dimensions:", error);
            }
          }

          setUploadedFile({
            url: uploadURL,
            filename: file.name || "document",
            size: file.size || 0,
            type: file.type || "application/octet-stream",
            width,
            height
          });
        } else {
          // Multiple images for manifest
          const processedImages = await Promise.all(
            result.successful.map(async (file: any) => {
              let width: number | undefined;
              let height: number | undefined;

              if (file.type?.startsWith('image/')) {
                try {
                  const img = document.createElement('img');
                  const dimensions = await new Promise<{width: number, height: number}>((resolve, reject) => {
                    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
                    img.onerror = reject;
                    img.src = file.uploadURL;
                  });
                  width = dimensions.width;
                  height = dimensions.height;
                } catch (error) {
                  console.warn("Could not extract image dimensions for", file.name, error);
                }
              }

              return {
                id: file.id || Math.random().toString(36),
                url: file.uploadURL,
                filename: file.name || "image",
                size: file.size || 0,
                type: file.type || "image/jpeg",
                width,
                height
              };
            })
          );

          setUploadedImages(processedImages);
          setShowManifestEditor(true);
        }
      }
    } catch (error) {
      console.error("Error during file upload:", error);
      toast({
        title: "Errore",
        description: "Errore durante il caricamento del file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveManifest = async (manifest: any, documentData: any) => {
    if (!uploadedImages.length) {
      toast({
        title: "Errore",
        description: "Nessuna immagine disponibile",
        variant: "destructive",
      });
      return;
    }

    try {
      const csrfData = await fetch('/api/csrf-token', {
        credentials: 'include'
      }).then(r => r.json());

      const response = await fetch("/api/admin/manifests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfData.csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          manifest,
          title: documentData.title || manifest.label,
          description: documentData.description || manifest.description,
          categoryId: documentData.categoryId,
          subcategoryId: documentData.subcategoryId,
          status: documentData.status,
          isPublic: documentData.isPublic,
          tags: documentData.tags || [],
          keywords: documentData.keywords || [],
          imageUrls: uploadedImages.map(img => img.url),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Errore nel salvataggio del manifest");
      }

      const result = await response.json();

      toast({
        title: "Successo",
        description: `Manifest IIIF "${documentData.title || manifest.label}" creato con successo!`,
      });
      setShowManifestEditor(false);
      setUploadedImages([]);
      setFormData(initialFormData);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      onClose();
    } catch (error) {
      console.error("Error saving manifest:", error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Errore nel salvataggio del manifest",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!uploadedFile) {
      toast({
        title: "Errore",
        description: "Carica prima un file",
        variant: "destructive",
      });
      return;
    }

    if (!formData.title?.trim()) {
      toast({
        title: "Errore",
        description: "Il titolo è obbligatorio",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploading(true);

      const csrfData = await fetch('/api/csrf-token', {
        credentials: 'include'
      }).then(r => r.json());

      // First, create the document
      const createResponse = await fetch('/api/admin/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          author: formData.author,
          period: formData.period,
          location: formData.location,
          categoryId: formData.categoryId || null,
          subcategoryId: formData.subcategoryId || null,
          status: formData.status,
          isPublic: formData.isPublic,
        }),
      });

      if (!createResponse.ok) {
        if (createResponse.status === 401) {
          throw new Error('UNAUTHORIZED');
        }
        throw new Error(`Failed to create document: ${createResponse.status}`);
      }

      const document = await createResponse.json();

      // Then, associate the uploaded file with the document
      const fileResponse = await fetch(`/api/admin/documents/${document.id}/file`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({
          fileURL: uploadedFile.url,
          fileName: uploadedFile.filename,
          originalFileName: uploadedFile.filename,
          fileSize: uploadedFile.size,
          mimeType: uploadedFile.type,
        }),
      });

      if (!fileResponse.ok) {
        throw new Error(`Failed to associate file: ${fileResponse.status}`);
      }

      toast({
        title: "Successo",
        description: "Documento caricato con successo",
      });

      onClose();
    } catch (error) {
      console.error('Save error:', error);
      if (error instanceof Error && error.message === 'UNAUTHORIZED') {
        if (isUnauthorizedError(error)) {
          window.location.href = "/api/login";
          return;
        }
      }

      toast({
        title: "Errore",
        description: "Errore durante il salvataggio del documento",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🟢 handleFileSelect called');
    const files = e.target.files;
    console.log('📁 Files selected:', files?.length || 0);
    console.log('🎯 Upload mode:', uploadMode);
    
    if (files && files.length > 0) {
      if (uploadMode === 'single') {
        const file = files[0];
        console.log('📄 Selected file:', file.name, 'Size:', file.size, 'Type:', file.type);
        
        if (file.size > 104857600) { // 100MB
          console.log('❌ File too large:', file.size);
          toast({
            title: "File troppo grande",
            description: "Il file deve essere inferiore a 100MB.",
            variant: "destructive",
          });
          return;
        }
        console.log('✅ File valid, calling fileUploadMutation.mutate()');
        setUploadedFile(null); // Reset previous upload
        fileUploadMutation.mutate(file);
      } else {
        console.log('⚠️ Upload mode is not "single", it is:', uploadMode);
      }
    } else {
      console.log('❌ No files selected');
    }
  };

  const handleManifestFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
      if (imageFiles.length === 0) {
        toast({
          title: "Nessuna immagine selezionata",
          description: "Seleziona almeno un file immagine (JPEG, PNG, TIFF, GIF).",
          variant: "destructive",
        });
        return;
      }

      if (imageFiles.some(file => file.size > 52428800)) { // 50MB limit per image
        toast({
          title: "Immagine troppo grande",
          description: "Ogni immagine deve essere inferiore a 50MB.",
          variant: "destructive",
        });
        return;
      }

      setIsUploading(true);
      setUploadedImages([]); // Reset previous uploads

      try {
        // Get category name if available
        const categoryName = formData.categoryId 
          ? categories?.find(c => c.id === formData.categoryId)?.name 
          : undefined;

        // Upload each image individually to FTP
        const uploadPromises = imageFiles.map(async (file) => {
          const csrfData = await fetch('/api/csrf-token', {
            credentials: 'include'
          }).then(r => r.json());

          // Upload file directly to FTP server
          const uploadResponse = await fetch(`/api/ftp/upload?category=${encodeURIComponent(categoryName || 'general')}&filename=${encodeURIComponent(file.name)}`, {
            method: "POST",
            body: file,
            headers: {
              "Content-Type": file.type,
              "X-CSRF-Token": csrfData.csrfToken,
            },
            credentials: 'include',
          });

          if (!uploadResponse.ok) {
            throw new Error(`Upload failed for ${file.name}: ${uploadResponse.status}`);
          }

          const data = await uploadResponse.json();

          // Extract image dimensions
          let width: number | undefined;
          let height: number | undefined;

          try {
            const img = document.createElement('img');
            const dimensions = await new Promise<{width: number, height: number}>((resolve, reject) => {
              img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
              img.onerror = reject;
              img.src = URL.createObjectURL(file);
            });
            width = dimensions.width;
            height = dimensions.height;
          } catch (error) {
            console.warn("Could not extract image dimensions for", file.name, error);
          }

          return {
            id: Math.random().toString(36),
            url: data.path || data.url,
            filename: file.name,
            size: file.size,
            type: file.type,
            width,
            height
          };
        });

        const uploadedImages = await Promise.all(uploadPromises);
        setUploadedImages(uploadedImages);
        setShowManifestEditor(true);

        toast({
          title: "Immagini caricate",
          description: `${uploadedImages.length} immagini caricate con successo.`,
        });
      } catch (error) {
        console.error("Error uploading images:", error);
        toast({
          title: "Errore",
          description: "Errore durante il caricamento delle immagini",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleGetUploadParameters = async (file: any) => {
    try {
      const csrfData = await fetch('/api/csrf-token', {
        credentials: 'include'
      }).then(r => r.json());

      const response = await fetch('/api/objects/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.csrfToken,
        },
        credentials: 'include',
      });

      const data = await response.json();

      return {
        method: 'PUT' as const,
        url: data.uploadURL,
      };
    } catch (error) {
      console.error('Error getting upload parameters:', error);
      throw error;
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title) {
      toast({
        title: "Errore",
        description: "Il titolo è obbligatorio.",
        variant: "destructive",
      });
      return;
    }

    if (uploadMode === 'single') {
      if (!uploadedFile) {
        toast({
          title: "Errore",
          description: "Carica prima un file.",
          variant: "destructive",
        });
        return;
      }
      await handleSave();
    } else {
      // Manifest mode: The save logic is handled by ManifestEditor's onSaveManifest
      // The upload is already done by handleFileUpload, and showManifestEditor is true
      // So, we don't need to do anything here.
    }
  };

  const handleReset = () => {
    setFormData(initialFormData);
    setTagInput("");
    setKeywordInput("");
    setUploadedFile(null);
    setUploadedImages([]);
    setSelectedFile(null);
    setUploadMode('manifest'); // Reset to manifest
    setShowManifestEditor(false);
  };

  const addTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), tagInput.trim()],
      });
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter(tag => tag !== tagToRemove) || [],
    });
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !formData.keywords?.includes(keywordInput.trim())) {
      setFormData({
        ...formData,
        keywords: [...(formData.keywords || []), keywordInput.trim()],
      });
      setKeywordInput("");
    }
  };

  const removeKeyword = (keywordToRemove: string) => {
    setFormData({
      ...formData,
      keywords: formData.keywords?.filter(keyword => keyword !== keywordToRemove) || [],
    });
  };

  // Show loading state while preselected documents are loading
  if (loadingPreselected && preselectedDocumentIds && preselectedDocumentIds.length > 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <LoadingSpinner className="w-8 h-8" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">Caricamento documenti...</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Caricamento di {preselectedDocumentIds.length} documento/i per il manifest IIIF
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (showManifestEditor) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <ManifestEditor
            images={uploadedImages}
            categories={categories || []}
            subcategories={subcategories || []}
            initialDocumentData={formData}
            onSaveManifest={handleSaveManifest}
            onCancel={() => {
              setShowManifestEditor(false);
              setUploadedImages([]);
            }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Carica Nuovo Documento
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Upload Section - SINGLE MODE */}
          {uploadMode === 'single' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Caricamento File
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {fileUploadMutation.isPending && <LoadingSpinner />}

                  {!uploadedFile && !fileUploadMutation.isPending && (
                    <div>
                      <input
                        type="file"
                        id="single-file-input"
                        onChange={handleFileSelect}
                        className="hidden"
                        accept="*/*"
                      />
                      <Button
                        type="button"
                        onClick={() => document.getElementById('single-file-input')?.click()}
                        className="w-full"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Seleziona File
                      </Button>
                      <p className="text-sm text-muted-foreground mt-2">
                        Seleziona un file da caricare (max 100MB).
                      </p>
                    </div>
                  )}

                  {uploadedFile && !fileUploadMutation.isPending && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="text-sm font-medium text-green-800">{uploadedFile.filename}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUploadedFile(null);
                            const input = document.getElementById('single-file-input') as HTMLInputElement;
                            if (input) input.value = '';
                          }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* File Upload Section - MANIFEST MODE */}
          {uploadMode === 'manifest' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Caricamento Immagini per Manifest IIIF
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {isUploading && <LoadingSpinner />}

                  {uploadedImages.length === 0 && !isUploading && (
                    <div>
                      <input
                        type="file"
                        id="manifest-file-input"
                        multiple
                        accept="image/jpeg,image/png,image/tiff,image/gif,image/jpg"
                        onChange={handleManifestFileSelect}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        onClick={() => document.getElementById('manifest-file-input')?.click()}
                        className="w-full"
                      >
                        <Image className="w-4 h-4 mr-2" />
                        Seleziona Immagini (JPEG, PNG, TIFF, GIF)
                      </Button>
                      <p className="text-sm text-muted-foreground mt-2">
                        Seleziona multiple immagini per creare un manifest IIIF. Formati supportati: JPEG, PNG, TIFF, GIF.
                      </p>
                    </div>
                  )}

                  {uploadedImages.length > 0 && !isUploading && (
                    <div className="mt-4">
                      <h4 className="font-medium mb-2">Immagini caricate:</h4>
                      {uploadedImages.map((img, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded mb-2">
                          <span className="text-sm text-green-800">{img.filename}</span>
                          <Badge variant="outline" className="bg-green-100 text-green-800">
                            ✓ Caricato
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Informazioni Base</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="title">Titolo *</Label>
                  <Input
                    id="title"
                    value={formData.title || ""}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    autoComplete="off"
                    spellCheck="false"
                    data-testid="input-title"
                  />
                </div>

                <div>
                  <Label htmlFor="category">Categoria</Label>
                  <Select
                    value={formData.categoryId || ""}
                    onValueChange={(value) => setFormData({ ...formData, categoryId: value, subcategoryId: "" })}
                  >
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Seleziona categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {(categories || []).map((category: Category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="subcategory">Sottocategoria</Label>
                  <Select
                    value={formData.subcategoryId || ""}
                    onValueChange={(value) => setFormData({ ...formData, subcategoryId: value })}
                    disabled={!formData.categoryId}
                  >
                    <SelectTrigger data-testid="select-subcategory">
                      <SelectValue placeholder="Seleziona sottocategoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategories?.filter((sub: any) => sub.categoryId === formData.categoryId).map((subcategory: any) => (
                        <SelectItem key={subcategory.id} value={subcategory.id}>
                          {subcategory.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="description">Descrizione</Label>
                  <Textarea
                    id="description"
                    rows={3}
                    value={formData.description || ""}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    spellCheck="false"
                    data-testid="textarea-description"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="author">Autore</Label>
                  <Input
                    id="author"
                    value={formData.author || ""}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                    autoComplete="off"
                    spellCheck="false"
                    data-testid="input-author"
                  />
                </div>

                <div>
                  <Label htmlFor="location">Luogo</Label>
                  <Input
                    id="location"
                    value={formData.location || ""}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    autoComplete="off"
                    spellCheck="false"
                    data-testid="input-location"
                  />
                </div>

                <div>
                  <Label htmlFor="period">Periodo</Label>
                  <Select
                    value={formData.period || ""}
                    onValueChange={(value) => setFormData({ ...formData, period: value })}
                  >
                    <SelectTrigger data-testid="select-period">
                      <SelectValue placeholder="Seleziona periodo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Medioevo">Medioevo</SelectItem>
                      <SelectItem value="Rinascimento">Rinascimento</SelectItem>
                      <SelectItem value="Epoca Moderna">Epoca Moderna</SelectItem>
                      <SelectItem value="XIX Secolo">XIX Secolo</SelectItem>
                      <SelectItem value="XX Secolo">XX Secolo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="century">Secolo</Label>
                  <Input
                    id="century"
                    value={formData.century || ""}
                    onChange={(e) => setFormData({ ...formData, century: e.target.value })}
                    placeholder="es. XIII secolo"
                    autoComplete="off"
                    spellCheck="false"
                    data-testid="input-century"
                  />
                </div>

                <div>
                  <Label htmlFor="materials">Materiali</Label>
                  <Input
                    id="materials"
                    value={formData.materials || ""}
                    onChange={(e) => setFormData({ ...formData, materials: e.target.value })}
                    placeholder="es. Pergamena, oro"
                    autoComplete="off"
                    spellCheck="false"
                    data-testid="input-materials"
                  />
                </div>

                <div>
                  <Label htmlFor="dimensions">Dimensioni</Label>
                  <Input
                    id="dimensions"
                    value={formData.dimensions || ""}
                    onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                    placeholder="es. 30x40 cm"
                    autoComplete="off"
                    spellCheck="false"
                    data-testid="input-dimensions"
                  />
                </div>

                <div>
                  <Label htmlFor="condition">Condizioni</Label>
                  <Input
                    id="condition"
                    value={formData.condition || ""}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                    placeholder="es. Buone"
                    autoComplete="off"
                    spellCheck="false"
                    data-testid="input-condition"
                  />
                </div>

                <div className="md:col-span-3">
                  <Label htmlFor="provenance">Provenienza</Label>
                  <Textarea
                    id="provenance"
                    rows={2}
                    value={formData.provenance || ""}
                    onChange={(e) => setFormData({ ...formData, provenance: e.target.value })}
                    spellCheck="false"
                    data-testid="textarea-provenance"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tags and Keywords */}
          <Card>
            <CardHeader>
              <CardTitle>Tag e Parole Chiave</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="tags">Tag</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="tags"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                      placeholder="Aggiungi tag..."
                      autoComplete="off"
                      spellCheck="false"
                      data-testid="input-tag"
                    />
                    <Button type="button" onClick={addTag} size="sm" data-testid="button-add-tag">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {formData.tags && formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {formData.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="cursor-pointer">
                          {tag}
                          <X
                            className="h-3 w-3 ml-1"
                            onClick={() => removeTag(tag)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="keywords">Parole Chiave</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="keywords"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                      placeholder="Aggiungi parola chiave..."
                      autoComplete="off"
                      spellCheck="false"
                      data-testid="input-keyword"
                    />
                    <Button type="button" onClick={addKeyword} size="sm" data-testid="button-add-keyword">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {formData.keywords && formData.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {formData.keywords.map((keyword, index) => (
                        <Badge key={index} variant="outline" className="cursor-pointer">
                          {keyword}
                          <X
                            className="h-3 w-3 ml-1"
                            onClick={() => removeKeyword(keyword)}
                          />
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Regesti-specific Fields - Show only when Regesti category is selected */}
          {isRegestiSelected() && (
            <Card>
              <CardHeader>
                <CardTitle>Campi Regesti</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Document Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="documentType">Tipo Documento</Label>
                      <Select
                        value={formData.documentType || ""}
                        onValueChange={(value) => setFormData({ ...formData, documentType: value })}
                      >
                        <SelectTrigger data-testid="select-document-type">
                          <SelectValue placeholder="Seleziona tipo documento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="carta">Carta</SelectItem>
                          <SelectItem value="bolla">Bolla</SelectItem>
                          <SelectItem value="breve">Breve</SelectItem>
                          <SelectItem value="diploma">Diploma</SelectItem>
                          <SelectItem value="privilegio">Privilegio</SelectItem>
                          <SelectItem value="notarile">Notarile</SelectItem>
                          <SelectItem value="altro">Altro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="transcriptionEditor">Editore Trascrizione</Label>
                      <Input
                        id="transcriptionEditor"
                        value={formData.transcriptionEditor || ""}
                        onChange={(e) => setFormData({ ...formData, transcriptionEditor: e.target.value })}
                        placeholder="Nome dell'editore"
                        data-testid="input-transcription-editor"
                      />
                    </div>
                  </div>

                  {/* Languages */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="languageOriginal">Lingua Originale</Label>
                      <Input
                        id="languageOriginal"
                        value={formData.languageOriginal || ""}
                        onChange={(e) => setFormData({ ...formData, languageOriginal: e.target.value })}
                        placeholder="es. Latino"
                        data-testid="input-language-original"
                      />
                    </div>

                    <div>
                      <Label htmlFor="languageTranscription">Lingua Trascrizione</Label>
                      <Input
                        id="languageTranscription"
                        value={formData.languageTranscription || ""}
                        onChange={(e) => setFormData({ ...formData, languageTranscription: e.target.value })}
                        placeholder="es. Latino modernizzato"
                        data-testid="input-language-transcription"
                      />
                    </div>

                    <div>
                      <Label htmlFor="languageTranslation">Lingua Traduzione</Label>
                      <Input
                        id="languageTranslation"
                        value={formData.languageTranslation || ""}
                        onChange={(e) => setFormData({ ...formData, languageTranslation: e.target.value })}
                        placeholder="es. Italiano"
                        data-testid="input-language-translation"
                      />
                    </div>
                  </div>

                  {/* Text Content Fields */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="textRegesto">Testo Regesto</Label>
                      <Textarea
                        id="textRegesto"
                        rows={3}
                        value={formData.textRegesto || ""}
                        onChange={(e) => setFormData({ ...formData, textRegesto: e.target.value })}
                        placeholder="Sintesi strutturata del documento..."
                        data-testid="textarea-text-regesto"
                      />
                    </div>

                    <div>
                      <Label htmlFor="textTranscription">Testo Trascrizione</Label>
                      <Textarea
                        id="textTranscription"
                        rows={4}
                        value={formData.textTranscription || ""}
                        onChange={(e) => setFormData({ ...formData, textTranscription: e.target.value })}
                        placeholder="Trascrizione integrale del testo originale..."
                        data-testid="textarea-text-transcription"
                      />
                    </div>

                    <div>
                      <Label htmlFor="textTranslation">Testo Traduzione</Label>
                      <Textarea
                        id="textTranslation"
                        rows={4}
                        value={formData.textTranslation || ""}
                        onChange={(e) => setFormData({ ...formData, textTranslation: e.target.value })}
                        placeholder="Traduzione del documento..."
                        data-testid="textarea-text-translation"
                      />
                    </div>

                    <div>
                      <Label htmlFor="textAbstract">Abstract</Label>
                      <Textarea
                        id="textAbstract"
                        rows={3}
                        value={formData.textAbstract || ""}
                        onChange={(e) => setFormData({ ...formData, textAbstract: e.target.value })}
                        placeholder="Riassunto moderno del documento..."
                        data-testid="textarea-text-abstract"
                      />
                    </div>

                    <div>
                      <Label htmlFor="textEdition">Testo Edizione</Label>
                      <Textarea
                        id="textEdition"
                        rows={4}
                        value={formData.textEdition || ""}
                        onChange={(e) => setFormData({ ...formData, textEdition: e.target.value })}
                        placeholder="Testo rivisto criticamente..."
                        data-testid="textarea-text-edition"
                      />
                    </div>
                  </div>

                  {/* Additional Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="rightsLicense">Diritti/Licenza</Label>
                      <Input
                        id="rightsLicense"
                        value={formData.rightsLicense || ""}
                        onChange={(e) => setFormData({ ...formData, rightsLicense: e.target.value })}
                        placeholder="es. CC BY-SA 4.0"
                        data-testid="input-rights-license"
                      />
                    </div>

                    <div>
                      <Label htmlFor="qcStatus">Stato QC</Label>
                      <Select
                        value={formData.qcStatus || ""}
                        onValueChange={(value) => setFormData({ ...formData, qcStatus: value })}
                      >
                        <SelectTrigger data-testid="select-qc-status">
                          <SelectValue placeholder="Seleziona stato QC" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">In attesa</SelectItem>
                          <SelectItem value="reviewed">Revisionato</SelectItem>
                          <SelectItem value="approved">Approvato</SelectItem>
                          <SelectItem value="rejected">Respinto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="masterFormat">Formato Master</Label>
                      <Input
                        id="masterFormat"
                        value={formData.masterFormat || ""}
                        onChange={(e) => setFormData({ ...formData, masterFormat: e.target.value })}
                        placeholder="es. TIFF, PDF, JPG"
                        data-testid="input-master-format"
                      />
                    </div>

                    <div>
                      <Label htmlFor="sourceReference">Riferimento Fonte</Label>
                      <Input
                        id="sourceReference"
                        value={formData.sourceReference || ""}
                        onChange={(e) => setFormData({ ...formData, sourceReference: e.target.value })}
                        placeholder="Riferimento bibliografico..."
                        data-testid="input-source-reference"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="transcriptionNotes">Note Trascrizione</Label>
                    <Textarea
                      id="transcriptionNotes"
                      rows={3}
                      value={formData.transcriptionNotes || ""}
                      onChange={(e) => setFormData({ ...formData, transcriptionNotes: e.target.value })}
                      placeholder="Note metodologiche o criteri di trascrizione..."
                      data-testid="textarea-transcription-notes"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status and Visibility */}
          <Card>
            <CardHeader>
              <CardTitle>Stato e Visibilità</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status">Stato</Label>
                  <Select
                    value={formData.status || "draft"}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Bozza</SelectItem>
                      <SelectItem value="published">Pubblicato</SelectItem>
                      <SelectItem value="archived">Archiviato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="visibility">Visibilità</Label>
                  <Select
                    value={formData.isPublic ? "public" : "private"}
                    onValueChange={(value) => setFormData({ ...formData, isPublic: value === "public" })}
                  >
                    <SelectTrigger data-testid="select-visibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Pubblico</SelectItem>
                      <SelectItem value="private">Privato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              data-testid="button-reset"
            >
              Reset
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-testid="button-cancel"
            >
              Annulla
            </Button>
            {uploadMode === 'single' && (
              <Button
                type="submit"
                disabled={createDocumentMutation.isPending || isUploading}
                data-testid="button-upload-document"
              >
                {isUploading ? "Caricamento..." : "Carica Documento"}
              </Button>
            )}
            {uploadMode === 'manifest' && uploadedImages.length > 0 && (
              <Button
                type="button"
                onClick={() => setShowManifestEditor(true)}
                disabled={isUploading}
                data-testid="button-create-manifest"
              >
                {isUploading ? "Caricamento..." : "Crea Manifest"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}