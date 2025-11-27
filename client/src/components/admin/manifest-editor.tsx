
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Move3D, Eye, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface ImageCanvasData {
  id: string;
  label: string;
  imageUrl: string;
  width?: number;
  height?: number;
  description?: string;
  order: number;
}

interface ManifestMetadata {
  label: string;
  description: string;
  attribution: string;
  license: string;
  logo?: string;
  related?: string;
  seeAlso?: string;
  within?: string;
  // Document standard fields
  categoryId: string;
  subcategoryId: string;
  status: string;
  isPublic: boolean;
  tags: string[];
  keywords: string[];
}

interface ManifestEditorProps {
  images: Array<{
    id: string;
    url: string;
    filename: string;
    width?: number;
    height?: number;
  }>;
  categories?: Array<{ id: string; name: string; slug: string }>;
  subcategories?: Array<{ id: string; name: string; categoryId: string }>;
  onSaveManifest: (manifest: any, documentData: any) => void;
  onCancel: () => void;
  initialManifest?: any;
  initialDocumentData?: any;
}

export function ManifestEditor({ 
  images, 
  categories = [],
  subcategories = [],
  onSaveManifest, 
  onCancel, 
  initialManifest,
  initialDocumentData 
}: ManifestEditorProps) {
  const [metadata, setMetadata] = useState<ManifestMetadata>({
    label: initialDocumentData?.title || "",
    description: initialDocumentData?.description || "",
    attribution: "",
    license: "https://creativecommons.org/licenses/by/4.0/",
    categoryId: initialDocumentData?.categoryId || "",
    subcategoryId: initialDocumentData?.subcategoryId || "",
    status: initialDocumentData?.status || "draft",
    isPublic: initialDocumentData?.isPublic ?? true,
    tags: initialDocumentData?.tags || [],
    keywords: initialDocumentData?.keywords || [],
  });

  const [canvases, setCanvases] = useState<ImageCanvasData[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generatedManifest, setGeneratedManifest] = useState<any>(null);
  const [tagInput, setTagInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  
  // Filter subcategories based on selected category
  const filteredSubcategories = subcategories.filter(
    sub => sub.categoryId === metadata.categoryId
  );

  useEffect(() => {
    if (initialManifest) {
      // Load existing manifest
      setMetadata({
        label: initialManifest.label || "",
        description: initialManifest.description || "",
        attribution: initialManifest.attribution || "",
        license: initialManifest.license || "https://creativecommons.org/licenses/by/4.0/",
        logo: initialManifest.logo,
        related: initialManifest.related,
        seeAlso: initialManifest.seeAlso,
        within: initialManifest.within,
        categoryId: initialDocumentData?.categoryId || "",
        subcategoryId: initialDocumentData?.subcategoryId || "",
        status: initialDocumentData?.status || "draft",
        isPublic: initialDocumentData?.isPublic ?? true,
        tags: initialDocumentData?.tags || [],
        keywords: initialDocumentData?.keywords || [],
      });

      // Extract canvases
      const loadedCanvases = initialManifest.sequences?.[0]?.canvases?.map((canvas: any, index: number) => ({
        id: canvas['@id'] || `canvas-${index}`,
        label: canvas.label || `Canvas ${index + 1}`,
        imageUrl: canvas.images?.[0]?.resource?.['@id'] || "",
        width: canvas.width,
        height: canvas.height,
        description: canvas.description || "",
        order: index,
      })) || [];

      setCanvases(loadedCanvases);
    } else {
      // Initialize with uploaded images
      const initialCanvases = images.map((img, index) => ({
        id: `canvas-${img.id}`,
        label: img.filename || `Immagine ${index + 1}`,
        imageUrl: img.url,
        width: img.width,
        height: img.height,
        description: "",
        order: index,
      }));
      setCanvases(initialCanvases);
    }
  }, [images, initialManifest]);

  const updateCanvas = (id: string, field: keyof ImageCanvasData, value: any) => {
    setCanvases(prev => prev.map(canvas => 
      canvas.id === id ? { ...canvas, [field]: value } : canvas
    ));
  };

  const removeCanvas = (id: string) => {
    setCanvases(prev => prev.filter(canvas => canvas.id !== id).map((canvas, index) => ({
      ...canvas,
      order: index
    })));
  };

  const moveCanvas = (id: string, direction: 'up' | 'down') => {
    setCanvases(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex(canvas => canvas.id === id);
      
      if ((direction === 'up' && index === 0) || 
          (direction === 'down' && index === sorted.length - 1)) {
        return prev;
      }
      
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      [sorted[index], sorted[swapIndex]] = [sorted[swapIndex], sorted[index]];
      
      return sorted.map((canvas, newIndex) => ({ ...canvas, order: newIndex }));
    });
  };

  const addCanvas = () => {
    const newCanvas: ImageCanvasData = {
      id: `canvas-${Date.now()}`,
      label: `Nuova immagine ${canvases.length + 1}`,
      imageUrl: "",
      description: "",
      order: canvases.length,
    };
    setCanvases(prev => [...prev, newCanvas]);
  };

  const generateManifest = () => {
    const baseUrl = window.location.origin;
    const manifestId = `${baseUrl}/manifests/${Date.now()}`;
    
    const sortedCanvases = [...canvases].sort((a, b) => a.order - b.order);
    
    const manifest = {
      "@context": "http://iiif.io/api/presentation/2/context.json",
      "@type": "sc:Manifest",
      "@id": manifestId,
      label: metadata.label || "Manifest senza titolo",
      description: metadata.description || "",
      attribution: metadata.attribution || "",
      license: metadata.license || "https://creativecommons.org/licenses/by/4.0/",
      ...(metadata.logo && { logo: metadata.logo }),
      ...(metadata.related && { related: metadata.related }),
      ...(metadata.seeAlso && { seeAlso: metadata.seeAlso }),
      ...(metadata.within && { within: metadata.within }),
      sequences: [{
        "@type": "sc:Sequence",
        "@id": `${manifestId}/sequence/1`,
        label: "Sequenza normale",
        canvases: sortedCanvases.map((canvas, index) => ({
          "@type": "sc:Canvas",
          "@id": `${manifestId}/canvas/${index + 1}`,
          label: canvas.label || `Canvas ${index + 1}`,
          ...(canvas.description && { description: canvas.description }),
          width: canvas.width || 1000,
          height: canvas.height || 1000,
          images: [{
            "@type": "oa:Annotation",
            "@id": `${manifestId}/canvas/${index + 1}/annotation/1`,
            motivation: "sc:painting",
            resource: {
              "@type": "dctypes:Image",
              "@id": canvas.imageUrl.startsWith('http') ? canvas.imageUrl : `${baseUrl}${canvas.imageUrl}`,
              width: canvas.width || 1000,
              height: canvas.height || 1000,
              format: "image/jpeg"
            },
            on: `${manifestId}/canvas/${index + 1}`
          }]
        }))
      }]
    };

    setGeneratedManifest(manifest);
    return manifest;
  };

  const handlePreview = () => {
    const manifest = generateManifest();
    setGeneratedManifest(manifest);
    setPreviewOpen(true);
  };

  const addTag = () => {
    if (tagInput.trim() && !metadata.tags.includes(tagInput.trim())) {
      setMetadata(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setMetadata(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !metadata.keywords.includes(keywordInput.trim())) {
      setMetadata(prev => ({
        ...prev,
        keywords: [...prev.keywords, keywordInput.trim()],
      }));
      setKeywordInput("");
    }
  };

  const removeKeyword = (keywordToRemove: string) => {
    setMetadata(prev => ({
      ...prev,
      keywords: prev.keywords.filter(keyword => keyword !== keywordToRemove),
    }));
  };

  const handleSave = () => {
    const manifest = generateManifest();
    const documentData = {
      title: metadata.label,
      description: metadata.description,
      categoryId: metadata.categoryId || null,
      subcategoryId: metadata.subcategoryId || null,
      status: metadata.status,
      isPublic: metadata.isPublic,
      tags: metadata.tags,
      keywords: metadata.keywords,
    };
    onSaveManifest(manifest, documentData);
  };

  const sortedCanvases = [...canvases].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Editor Manifest IIIF</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePreview}>
            <Eye className="w-4 h-4 mr-2" />
            Anteprima JSON
          </Button>
          <Button onClick={handleSave}>Salva Manifest</Button>
          <Button variant="outline" onClick={onCancel}>Annulla</Button>
        </div>
      </div>

      {/* Document Information Section */}
      <Card>
        <CardHeader>
          <CardTitle>Informazioni Documento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="label">Titolo *</Label>
            <Input
              id="label"
              value={metadata.label}
              onChange={(e) => setMetadata(prev => ({ ...prev, label: e.target.value }))}
              placeholder="Es: Collezione di Manoscritti Medievali"
              data-testid="input-manifest-title"
            />
          </div>

          <div>
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              value={metadata.description}
              onChange={(e) => setMetadata(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descrizione dettagliata della collezione..."
              rows={3}
              data-testid="input-manifest-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="category">Categoria</Label>
              <Select
                value={metadata.categoryId}
                onValueChange={(value) => setMetadata(prev => ({ ...prev, categoryId: value, subcategoryId: "" }))}
              >
                <SelectTrigger data-testid="select-manifest-category">
                  <SelectValue placeholder="Seleziona categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="subcategory">Sottocategoria</Label>
              <Select
                value={metadata.subcategoryId}
                onValueChange={(value) => setMetadata(prev => ({ ...prev, subcategoryId: value }))}
                disabled={!metadata.categoryId}
              >
                <SelectTrigger data-testid="select-manifest-subcategory">
                  <SelectValue placeholder="Seleziona sottocategoria" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSubcategories.map(sub => (
                    <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Stato</Label>
              <Select
                value={metadata.status}
                onValueChange={(value) => setMetadata(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger data-testid="select-manifest-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Bozza</SelectItem>
                  <SelectItem value="published">Pubblicato</SelectItem>
                  <SelectItem value="archived">Archiviato</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-6">
              <Label htmlFor="isPublic">Visibile pubblicamente</Label>
              <Switch
                id="isPublic"
                checked={metadata.isPublic}
                onCheckedChange={(checked) => setMetadata(prev => ({ ...prev, isPublic: checked }))}
                data-testid="switch-manifest-public"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="tags">Tag</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Aggiungi tag e premi Invio"
                data-testid="input-manifest-tag"
              />
              <Button type="button" onClick={addTag} variant="outline" data-testid="button-add-manifest-tag">
                Aggiungi
              </Button>
            </div>
            {metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {metadata.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {tag}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => removeTag(tag)}
                      data-testid={`button-remove-manifest-tag-${index}`}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="keywords">Parole Chiave</Label>
            <div className="flex gap-2">
              <Input
                id="keywords"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                placeholder="Aggiungi parola chiave e premi Invio"
                data-testid="input-manifest-keyword"
              />
              <Button type="button" onClick={addKeyword} variant="outline" data-testid="button-add-manifest-keyword">
                Aggiungi
              </Button>
            </div>
            {metadata.keywords.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {metadata.keywords.map((keyword, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {keyword}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => removeKeyword(keyword)}
                      data-testid={`button-remove-manifest-keyword-${index}`}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* IIIF Metadata Section */}
      <Card>
        <CardHeader>
          <CardTitle>Metadati IIIF</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="attribution">Attribuzione</Label>
              <Input
                id="attribution"
                value={metadata.attribution}
                onChange={(e) => setMetadata(prev => ({ ...prev, attribution: e.target.value }))}
                placeholder="Es: Biblioteca Universitaria"
              />
            </div>

            <div>
              <Label htmlFor="license">Licenza</Label>
              <Input
                id="license"
                value={metadata.license}
                onChange={(e) => setMetadata(prev => ({ ...prev, license: e.target.value }))}
                placeholder="URL della licenza"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="logo">Logo URL (opzionale)</Label>
              <Input
                id="logo"
                value={metadata.logo || ""}
                onChange={(e) => setMetadata(prev => ({ ...prev, logo: e.target.value }))}
                placeholder="URL del logo"
              />
            </div>

            <div>
              <Label htmlFor="related">Link correlato (opzionale)</Label>
              <Input
                id="related"
                value={metadata.related || ""}
                onChange={(e) => setMetadata(prev => ({ ...prev, related: e.target.value }))}
                placeholder="URL di una risorsa correlata"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Canvases Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Immagini e Canvas ({sortedCanvases.length})</CardTitle>
          <Button onClick={addCanvas} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Aggiungi Canvas
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {sortedCanvases.map((canvas, index) => (
              <Card key={canvas.id} className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{index + 1}</Badge>
                      <span className="font-medium">Canvas</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveCanvas(canvas.id, 'up')}
                        disabled={index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveCanvas(canvas.id, 'down')}
                        disabled={index === sortedCanvases.length - 1}
                      >
                        ↓
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCanvas(canvas.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Etichetta Canvas</Label>
                      <Input
                        value={canvas.label}
                        onChange={(e) => updateCanvas(canvas.id, 'label', e.target.value)}
                        placeholder="Titolo dell'immagine"
                      />
                    </div>
                    <div>
                      <Label>URL Immagine *</Label>
                      <Input
                        value={canvas.imageUrl}
                        onChange={(e) => updateCanvas(canvas.id, 'imageUrl', e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Larghezza (px)</Label>
                      <Input
                        type="number"
                        value={canvas.width || ""}
                        onChange={(e) => updateCanvas(canvas.id, 'width', parseInt(e.target.value) || undefined)}
                        placeholder="1000"
                      />
                    </div>
                    <div>
                      <Label>Altezza (px)</Label>
                      <Input
                        type="number"
                        value={canvas.height || ""}
                        onChange={(e) => updateCanvas(canvas.id, 'height', parseInt(e.target.value) || undefined)}
                        placeholder="1000"
                      />
                    </div>
                    <div className="flex items-end">
                      {canvas.imageUrl && (
                        <div className="w-16 h-16 border rounded overflow-hidden">
                          <img 
                            src={canvas.imageUrl} 
                            alt={canvas.label}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label>Descrizione (opzionale)</Label>
                    <Textarea
                      value={canvas.description || ""}
                      onChange={(e) => updateCanvas(canvas.id, 'description', e.target.value)}
                      placeholder="Descrizione di questa immagine..."
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            {sortedCanvases.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nessun canvas configurato.</p>
                <p>Clicca "Aggiungi Canvas" per iniziare.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Anteprima Manifest JSON</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[60vh]">
            <pre className="text-xs bg-muted p-4 rounded overflow-x-auto">
              {generatedManifest && JSON.stringify(generatedManifest, null, 2)}
            </pre>
          </ScrollArea>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(generatedManifest, null, 2));
              }}
            >
              Copia JSON
            </Button>
            <Button onClick={() => setPreviewOpen(false)}>Chiudi</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
