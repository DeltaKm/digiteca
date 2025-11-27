import { useState, useEffect } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { CloudUpload, X, Plus, Eye } from "lucide-react";
import type { Category, InsertDocument, UpdateDocument, Document } from "@shared/schema";

interface EditDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId?: string; // If provided, edit mode; if not, create mode
}

export function EditDocumentModal({ isOpen, onClose, documentId }: EditDocumentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditMode = !!documentId;

  const [formData, setFormData] = useState<Partial<InsertDocument>>({
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
  });

  const [tagInput, setTagInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Helper function to check if Regesti category is selected
  const isRegestiSelected = () => {
    if (!formData.categoryId || !categories) return false;
    const selectedCategory = categories.find(cat => cat.id === formData.categoryId);
    return selectedCategory?.slug === "regesti";
  };

  // Fetch document data if editing
  const { data: documentData, isLoading: documentLoading } = useQuery<Document>({
    queryKey: ["/api/admin/documents", documentId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/admin/documents/${documentId}`);
      return response.json();
    },
    enabled: isEditMode && isOpen && !!documentId,
    retry: false,
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/categories");
      return response.json();
    },
  });

  const { data: subcategories } = useQuery<any[]>({
    queryKey: ["/api/subcategories", formData.categoryId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/subcategories?categoryId=${formData.categoryId}`);
      return response.json();
    },
    enabled: !!formData.categoryId,
  });

  // Populate form data when editing
  useEffect(() => {
    if (isEditMode && documentData) {
      console.log('Populating form with document data:', documentData);
      setFormData({
        title: documentData.title || "",
        description: documentData.description || "",
        categoryId: documentData.categoryId || "",
        subcategoryId: documentData.subcategoryId || "",
        author: documentData.author || "",
        location: documentData.location || "",
        period: documentData.period || "",
        century: documentData.century || "",
        materials: documentData.materials || "",
        dimensions: documentData.dimensions || "",
        condition: documentData.condition || "",
        provenance: documentData.provenance || "",
        tags: documentData.tags || [],
        keywords: documentData.keywords || [],
        status: documentData.status || "draft",
        isPublic: documentData.isPublic !== undefined ? documentData.isPublic : true,
        // Populate Regesti fields
        documentType: documentData.documentType || "",
        transcriptionEditor: documentData.transcriptionEditor || "",
        languageOriginal: documentData.languageOriginal || "",
        languageTranscription: documentData.languageTranscription || "",
        languageTranslation: documentData.languageTranslation || "",
        textRegesto: documentData.textRegesto || "",
        textTranscription: documentData.textTranscription || "",
        textTranslation: documentData.textTranslation || "",
        textAbstract: documentData.textAbstract || "",
        textEdition: documentData.textEdition || "",
        transcriptionNotes: documentData.transcriptionNotes || "",
        corrediLinks: documentData.corrediLinks || [],
        rightsLicense: documentData.rightsLicense || "",
        qcStatus: documentData.qcStatus || "",
        masterFormat: documentData.masterFormat || "",
        masterUri: documentData.masterUri || "",
        sourceReference: documentData.sourceReference || "",
        subjects: documentData.subjects || [],
      });
    } else if (!isEditMode) {
      // Reset form for create mode
      handleReset();
    }
  }, [documentData, isEditMode, isOpen]);

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

  const updateDocumentMutation = useMutation({
    mutationFn: async (document: UpdateDocument) => {
      const response = await apiRequest("PUT", `/api/admin/documents/${documentId}`, document);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Documento aggiornato",
        description: "Il documento è stato aggiornato con successo.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
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
        description: "Errore durante l'aggiornamento del documento.",
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
      console.log('🔵 EditDocumentModal: Starting file upload');
      console.log('📄 File:', file.name, 'Size:', file.size);
      
      // Get CSRF token
      const csrfResponse = await apiRequest("GET", "/api/csrf-token");
      const csrfData = await csrfResponse.json();
      
      // Get category and subcategory names
      const categoryName = formData.categoryId 
        ? categories?.find(c => c.id === formData.categoryId)?.name 
        : undefined;
      
      const subcategoryName = formData.subcategoryId 
        ? subcategories?.find((s: any) => s.id === formData.subcategoryId)?.name 
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
      
      // Upload file directly to FTP server
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
        name: file.name,
        size: file.size,
        type: file.type,
      };
    },
    onSuccess: (fileData) => {
      console.log('✅ EditDocumentModal: File upload success:', fileData);
      setUploadedFiles(prev => [...prev, fileData]);
      setSelectedFile(null);
      
      toast({
        title: "File caricato",
        description: `Il file ${fileData.name} è stato caricato con successo.`,
      });
    },
    onError: (error) => {
      console.error('❌ EditDocumentModal: File upload error:', error);
      toast({
        title: "Errore",
        description: "Errore durante il caricamento del file.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 104857600) { // 100MB
        toast({
          title: "File troppo grande",
          description: "Il file deve essere inferiore a 100MB.",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleFileUpload = () => {
    if (selectedFile) {
      fileUploadMutation.mutate(selectedFile);
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

    try {
      if (isEditMode) {
        // Update existing document
        const documentData: UpdateDocument = {
          ...formData as UpdateDocument,
        };

        const document = await updateDocumentMutation.mutateAsync(documentData);

        // Update with file information if new file was uploaded
        if (uploadedFiles.length > 0 && document.id) {
          await updateDocumentFileMutation.mutateAsync({
            documentId: document.id,
            fileData: {
              fileURL: uploadedFiles[0].url,
              fileName: uploadedFiles[0].name,
              originalFileName: uploadedFiles[0].name,
              fileSize: uploadedFiles[0].size,
              mimeType: uploadedFiles[0].type,
            },
          });
        }
      } else {
        // Create new document with file metadata
        if (uploadedFiles.length === 0) {
          toast({
            title: "Errore",
            description: "Devi caricare un file prima di salvare il documento.",
            variant: "destructive",
          });
          return;
        }

        const documentData: InsertDocument = {
          ...formData as InsertDocument,
          fileName: uploadedFiles[0].name,
          originalFileName: uploadedFiles[0].name,
          filePath: uploadedFiles[0].url, // Il path FTP completo
          fileSize: uploadedFiles[0].size,
          mimeType: uploadedFiles[0].type,
        };

        console.log('📝 Creating document with data:', documentData);
        await createDocumentMutation.mutateAsync(documentData);
        
        // Non serve più chiamare updateDocumentFileMutation perché tutti i dati
        // sono già inclusi nel documento creato
      }
    } catch (error) {
      // Error handling is done in mutations
    }
  };

  const handleReset = () => {
    setFormData({
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
      // Reset Regesti fields
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
    });
    setTagInput("");
    setKeywordInput("");
    setUploadedFiles([]);
    setSelectedFile(null);
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

  if (!isOpen) return null;

  if (isEditMode && documentLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex h-96 items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Caricamento documento...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Modifica Documento" : "Carica Nuovo Documento"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Upload - Always show for both create and edit modes */}
          <Card>
            <CardHeader>
              <CardTitle>
                {isEditMode ? "File Allegato" : "File"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Current File Display with Preview */}
              {isEditMode && documentData && documentData.fileName && uploadedFiles.length === 0 && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="h-12 w-12 rounded bg-green-100 flex items-center justify-center">
                        <span className="text-lg font-medium text-green-600">
                          {documentData.mimeType?.includes('image') ? '🖼️' : 
                           documentData.mimeType === 'application/pdf' ? '📄' :
                           documentData.mimeType?.includes('video') ? '🎥' :
                           documentData.mimeType?.includes('audio') ? '🎵' : '📁'}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-green-800">File attuale:</p>
                        <p className="text-sm text-green-700">{documentData.fileName}</p>
                        <p className="text-xs text-green-600">
                          {documentData.mimeType || 'Tipo sconosciuto'}
                        </p>
                        {documentData.fileSize && (
                          <p className="text-xs text-green-600">
                            {documentData.fileSize > 1024 * 1024 
                              ? `${(documentData.fileSize / (1024 * 1024)).toFixed(1)} MB`
                              : `${(documentData.fileSize / 1024).toFixed(1)} KB`}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                      ✓ Allegato
                    </Badge>
                  </div>
                  
                  {/* File Preview */}
                  {documentData.filePath && (
                    <div className="mt-3 border border-green-300 rounded-lg overflow-hidden bg-white">
                      {documentData.mimeType?.startsWith("image/") ? (
                        <div className="p-4">
                          <div className="mb-3">
                            <img
                              className="w-full max-w-md h-48 object-contain rounded mx-auto border border-gray-200"
                              src={`/objects/${documentData.filePath.replace("/objects/", "")}`}
                              alt="Anteprima file"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                          <div className="text-center">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`/objects/${documentData.filePath.replace("/objects/", "")}`, '_blank')}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Visualizza a dimensione originale
                            </Button>
                          </div>
                        </div>
                      ) : documentData.mimeType === "application/pdf" ? (
                        <div className="p-4 text-center">
                          <div className="text-4xl mb-2">📄</div>
                          <p className="text-sm text-muted-foreground mb-2">Documento PDF</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/objects/${documentData.filePath.replace("/objects/", "")}`, '_blank')}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Apri PDF
                          </Button>
                        </div>
                      ) : (
                        <div className="p-4 text-center">
                          <div className="text-4xl mb-2">
                            {documentData.mimeType?.includes('video') ? '🎥' :
                             documentData.mimeType?.includes('audio') ? '🎵' : '📁'}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {documentData.mimeType || 'File allegato'}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/objects/${documentData.filePath.replace("/objects/", "")}`, '_blank')}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Visualizza file
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <Label htmlFor="file-input">
                    {isEditMode ? "Sostituisci File Esistente" : "Seleziona File"}
                  </Label>
                  <Input
                    id="file-input"
                    type="file"
                    onChange={handleFileSelect}
                    accept="*/*"
                    className="cursor-pointer"
                    data-testid="input-file"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Dimensione massima: 100MB
                    {isEditMode && " - Caricando un nuovo file sostituirai quello attuale"}
                  </p>
                </div>

                {selectedFile && (
                  <div className="space-y-2">
                    {isEditMode && documentData?.fileName && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm font-medium text-amber-800">⚠️ Sostituzione File</p>
                        <p className="text-xs text-amber-700 mt-1">
                          Il file "{documentData.fileName}" verrà sostituito con "{selectedFile.name}"
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-sm font-medium">
                        {isEditMode ? "Nuovo file:" : ""} {selectedFile.name}
                      </span>
                      <Badge variant="outline">
                        {selectedFile.size > 1024 * 1024 
                          ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
                          : `${(selectedFile.size / 1024).toFixed(1)} KB`}
                      </Badge>
                    </div>
                    
                    <Button
                      type="button"
                      onClick={handleFileUpload}
                      disabled={fileUploadMutation.isPending}
                      className="w-full"
                    >
                      {fileUploadMutation.isPending ? (
                        "Caricamento in corso..."
                      ) : (
                        <>
                          <CloudUpload className="h-4 w-4 mr-2" />
                          {isEditMode ? "Sostituisci File" : "Carica File"}
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {uploadedFiles.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">
                      {isEditMode ? "File sostituito:" : "File caricati:"}
                    </h4>
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="h-8 w-8 rounded bg-green-100 flex items-center justify-center">
                              <span className="text-xs font-medium text-green-600">
                                {file.type?.includes('image') ? '🖼️' : '📄'}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-green-800">{file.name}</p>
                              <p className="text-xs text-green-600">
                                {file.size > 1024 * 1024 
                                  ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                                  : `${(file.size / 1024).toFixed(1)} KB`}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                            ✓ {isEditMode ? "Sostituito" : "Caricato"}
                          </Badge>
                        </div>
                        {isEditMode && documentData?.fileName && documentData.fileName !== file.name && (
                          <div className="pl-4 border-l-2 border-amber-200">
                            <p className="text-xs text-muted-foreground">
                              File precedente: <span className="line-through">{documentData.fileName}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

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
                    data-testid="input-title"
                  />
                </div>

                <div>
                  <Label htmlFor="category">Categoria</Label>
                  <Select 
                    key={`category-${formData.categoryId}`}
                    value={formData.categoryId || ""} 
                    onValueChange={(value) => {
                      console.log('Category changed to:', value);
                      setFormData({ ...formData, categoryId: value, subcategoryId: "" });
                    }}
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
                    key={`subcategory-${formData.subcategoryId}`}
                    value={formData.subcategoryId || ""} 
                    onValueChange={(value) => {
                      console.log('Subcategory changed to:', value);
                      setFormData({ ...formData, subcategoryId: value });
                    }}
                    disabled={!formData.categoryId}
                  >
                    <SelectTrigger data-testid="select-subcategory">
                      <SelectValue placeholder="Seleziona sottocategoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {(subcategories || []).map((subcategory: any) => (
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
                    data-testid="textarea-description"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

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
                    key={`status-${formData.status}-${isEditMode}-${documentData?.id}`}
                    value={formData.status || "draft"} 
                    onValueChange={(value) => {
                      console.log('Status changed to:', value);
                      setFormData({ ...formData, status: value });
                    }}
                  >
                    <SelectTrigger data-testid="select-status">
                      <SelectValue>
                        {formData.status === "draft" && "Bozza"}
                        {formData.status === "published" && "Pubblicato"}
                        {formData.status === "archived" && "Archiviato"}
                        {!formData.status && "Seleziona stato"}
                      </SelectValue>
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
                    key={`visibility-${formData.isPublic}-${isEditMode}-${documentData?.id}`}
                    value={formData.isPublic ? "public" : "private"} 
                    onValueChange={(value) => {
                      console.log('Visibility changed to:', value);
                      setFormData({ ...formData, isPublic: value === "public" });
                    }}
                  >
                    <SelectTrigger data-testid="select-visibility">
                      <SelectValue>
                        {formData.isPublic ? "Pubblico" : "Privato"}
                      </SelectValue>
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
                    data-testid="input-location"
                  />
                </div>

                <div>
                  <Label htmlFor="period">Periodo</Label>
                  <Select 
                    key={`period-${formData.period}`}
                    value={formData.period || ""} 
                    onValueChange={(value) => {
                      console.log('Period changed to:', value);
                      setFormData({ ...formData, period: value });
                    }}
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
                        autoComplete="off"
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
                        autoComplete="off"
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
                        autoComplete="off"
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
                        autoComplete="off"
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
                        autoComplete="off"
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
                        autoComplete="off"
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
                        autoComplete="off"
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

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
              Annulla
            </Button>
            <Button 
              type="submit" 
              disabled={createDocumentMutation.isPending || updateDocumentMutation.isPending || fileUploadMutation.isPending}
              data-testid="button-save"
            >
              {(createDocumentMutation.isPending || updateDocumentMutation.isPending || fileUploadMutation.isPending)
                ? "Salvando..." 
                : isEditMode 
                  ? "Aggiorna Documento" 
                  : "Crea Documento"
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}