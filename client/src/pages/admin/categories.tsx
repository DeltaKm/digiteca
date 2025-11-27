import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { CategoryTree } from "@/components/admin/category-tree";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Save, X, ChevronDown, ChevronUp, Grid, TreePine } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Category, InsertCategory, Subcategory, InsertSubcategory } from "@shared/schema";

export default function Categories() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategory, setNewCategory] = useState<InsertCategory>({
    name: "",
    slug: "",
    description: "",
    color: "#3B82F6",
  });
  const [showNewForm, setShowNewForm] = useState(false);
  
  // Subcategory state management
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [newSubcategory, setNewSubcategory] = useState<InsertSubcategory>({
    name: "",
    slug: "",
    description: "",
    categoryId: "",
  });
  const [showNewSubcategoryForm, setShowNewSubcategoryForm] = useState<string | null>(null);
  
  // View mode state
  const [viewMode, setViewMode] = useState<'grid' | 'tree'>('tree');

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

  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Query to fetch subcategories for all categories
  const { data: subcategoriesData } = useQuery<Subcategory[]>({
    queryKey: ["/api/subcategories"],
    enabled: isAuthenticated,
    retry: false,
  });

  // Group subcategories by category ID for easy lookup
  const subcategoriesByCategory = Array.isArray(subcategoriesData) 
    ? subcategoriesData.reduce((acc: Record<string, Subcategory[]>, sub: Subcategory) => {
        if (sub.categoryId && !acc[sub.categoryId]) acc[sub.categoryId] = [];
        if (sub.categoryId) acc[sub.categoryId].push(sub);
        return acc;
      }, {} as Record<string, Subcategory[]>)
    : {};

  const createMutation = useMutation({
    mutationFn: async (category: InsertCategory) => {
      await apiRequest("POST", "/api/admin/categories", category);
    },
    onSuccess: () => {
      toast({
        title: "Categoria creata",
        description: "La categoria è stata creata con successo.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setNewCategory({ name: "", slug: "", description: "", color: "#3B82F6" });
      setShowNewForm(false);
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
        description: "Errore durante la creazione della categoria.",
        variant: "destructive",
      });
    },
  });


  const updateMutation = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: Partial<InsertCategory> }) => {
      await apiRequest("PUT", `/api/admin/categories/${id}`, category);
    },
    onSuccess: () => {
      toast({
        title: "Categoria aggiornata",
        description: "La categoria è stata aggiornata con successo.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setEditingCategory(null);
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
        description: "Errore durante l'aggiornamento della categoria.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, cascade = false }: { id: string; cascade?: boolean }) => {
      const queryParams = cascade ? "?cascade=true" : "";
      const response = await apiRequest("DELETE", `/api/admin/categories/${id}${queryParams}`);
      
      // Parse JSON response only for cascade delete (which returns impact details)
      if (cascade && response.status === 200) {
        return await response.json();
      }
      
      // For non-cascade delete, return null (204 No Content)
      return null;
    },
    onSuccess: (result, { cascade }) => {
      if (cascade && result?.impact) {
        toast({
          title: "Categoria eliminata",
          description: `Categoria eliminata con successo. Sottocategorie eliminate: ${result.impact.subcategoriesAffected}, Documenti aggiornati: ${result.impact.documentsUpdated}`,
        });
      } else {
        toast({
          title: "Categoria eliminata",
          description: "La categoria è stata eliminata con successo.",
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
      
      // Invalidate documents cache if cascade delete (may have updated documents)
      if (cascade) {
        queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      }
    },
    onError: (error: any, { id, cascade }) => {
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
      
      // Handle FK constraint errors - offer cascade delete
      if (error?.response?.status === 409 && !cascade) {
        if (confirm("La categoria contiene documenti associati. Vuoi eliminarla insieme a tutti i documenti associati (eliminazione a cascata)?")) {
          // Retry with cascade delete
          deleteMutation.mutate({ id, cascade: true });
        }
        return;
      }
      
      toast({
        title: "Errore",
        description: "Errore durante l'eliminazione della categoria.",
        variant: "destructive",
      });
    },
  });

  // Subcategory mutations
  const createSubcategoryMutation = useMutation({
    mutationFn: async (subcategory: InsertSubcategory) => {
      await apiRequest("POST", "/api/admin/subcategories", subcategory);
    },
    onSuccess: () => {
      toast({
        title: "Sottocategoria creata",
        description: "La sottocategoria è stata creata con successo.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
      setNewSubcategory({ name: "", slug: "", description: "", categoryId: "" });
      setShowNewSubcategoryForm(null);
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
        description: "Errore durante la creazione della sottocategoria.",
        variant: "destructive",
      });
    },
  });

  const updateSubcategoryMutation = useMutation({
    mutationFn: async ({ id, subcategory }: { id: string; subcategory: Partial<InsertSubcategory> }) => {
      await apiRequest("PUT", `/api/admin/subcategories/${id}`, subcategory);
    },
    onSuccess: () => {
      toast({
        title: "Sottocategoria aggiornata",
        description: "La sottocategoria è stata aggiornata con successo.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
      setEditingSubcategory(null);
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
        description: "Errore durante l'aggiornamento della sottocategoria.",
        variant: "destructive",
      });
    },
  });

  const deleteSubcategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/subcategories/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Sottocategoria eliminata",
        description: "La sottocategoria è stata eliminata con successo.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/subcategories"] });
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
        description: "Errore durante l'eliminazione della sottocategoria.",
        variant: "destructive",
      });
    },
  });

  const handleCreateCategory = () => {
    if (!newCategory.name || !newCategory.slug) {
      toast({
        title: "Errore",
        description: "Nome e slug sono obbligatori.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newCategory);
  };

  const handleUpdateCategory = () => {
    if (!editingCategory) return;
    updateMutation.mutate({
      id: editingCategory.id,
      category: editingCategory,
    });
  };

  const handleDeleteCategory = (categoryId: string) => {
    const subcategoriesCount = subcategoriesByCategory[categoryId]?.length || 0;
    
    if (subcategoriesCount > 0) {
      // Category has subcategories, show cascade options
      if (confirm(`Questa categoria contiene ${subcategoriesCount} sottocategorie. Vuoi eliminarla insieme a tutte le sottocategorie e aggiornare i documenti associati?`)) {
        deleteMutation.mutate({ id: categoryId, cascade: true });
      }
    } else {
      // Simple delete for categories without subcategories
      if (confirm("Sei sicuro di voler eliminare questa categoria?")) {
        deleteMutation.mutate({ id: categoryId, cascade: false });
      }
    }
  };


  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .trim();
  };

  // Subcategory handler functions
  const handleCreateSubcategory = (categoryId: string) => {
    if (!newSubcategory.name || !newSubcategory.slug) {
      toast({
        title: "Errore",
        description: "Nome e slug sono obbligatori.",
        variant: "destructive",
      });
      return;
    }
    const subcategoryWithCategory = { ...newSubcategory, categoryId };
    createSubcategoryMutation.mutate(subcategoryWithCategory);
  };

  const handleUpdateSubcategory = () => {
    if (!editingSubcategory) return;
    updateSubcategoryMutation.mutate({
      id: editingSubcategory.id,
      subcategory: editingSubcategory,
    });
  };

  const handleDeleteSubcategory = (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questa sottocategoria?")) {
      deleteSubcategoryMutation.mutate(id);
    }
  };

  const toggleCategoryExpansion = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const startNewSubcategory = (categoryId: string) => {
    setNewSubcategory({ name: "", slug: "", description: "", categoryId });
    setShowNewSubcategoryForm(categoryId);
    // Expand the category to show the form
    const newExpanded = new Set(expandedCategories);
    newExpanded.add(categoryId);
    setExpandedCategories(newExpanded);
  };

  const cancelNewSubcategory = () => {
    setNewSubcategory({ name: "", slug: "", description: "", categoryId: "" });
    setShowNewSubcategoryForm(null);
  };

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
              <h1 className="text-2xl font-bold text-foreground">Gestione Categorie</h1>
              <p className="text-muted-foreground">Amministra le categorie dell'archivio</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* View Mode Toggle */}
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'tree' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('tree')}
                  className="rounded-r-none"
                >
                  <TreePine className="h-4 w-4 mr-1" />
                  Albero
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-l-none"
                >
                  <Grid className="h-4 w-4 mr-1" />
                  Griglia
                </Button>
              </div>
              
              <Button 
                onClick={() => setShowNewForm(true)}
                data-testid="button-new-category"
              >
                <Plus className="mr-2 h-4 w-4" />
                Nuova Categoria
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* New Category Form */}
          {showNewForm && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Nuova Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="new-name">Nome</Label>
                    <Input
                      id="new-name"
                      value={newCategory.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setNewCategory({
                          ...newCategory,
                          name,
                          slug: generateSlug(name),
                        });
                      }}
                      data-testid="input-new-category-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-slug">Slug</Label>
                    <Input
                      id="new-slug"
                      value={newCategory.slug}
                      onChange={(e) => setNewCategory({ ...newCategory, slug: e.target.value })}
                      data-testid="input-new-category-slug"
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-color">Colore</Label>
                    <Input
                      id="new-color"
                      type="color"
                      value={newCategory.color || "#3B82F6"}
                      onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                      data-testid="input-new-category-color"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="new-description">Descrizione</Label>
                    <Textarea
                      id="new-description"
                      value={newCategory.description || ""}
                      onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                      data-testid="textarea-new-category-description"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setShowNewForm(false)}
                    data-testid="button-cancel-new-category"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Annulla
                  </Button>
                  <Button
                    onClick={handleCreateCategory}
                    disabled={createMutation.isPending}
                    data-testid="button-save-new-category"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Salva
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tree View */}
          {viewMode === 'tree' && (
            <CategoryTree
              categories={categories || []}
              subcategories={subcategoriesData || []}
              onEditCategory={(category) => setEditingCategory(category)}
              onDeleteCategory={handleDeleteCategory}
              onAddSubcategory={(categoryId) => startNewSubcategory(categoryId)}
              onEditSubcategory={(subcategory) => setEditingSubcategory(subcategory)}
              onDeleteSubcategory={handleDeleteSubcategory}
              onAddCategory={() => setShowNewForm(true)}
            />
          )}

          {/* Categories Grid */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {(categories || [])?.map((category: Category) => (
              <Card key={category.id} className="relative">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color || '#3B82F6' }}
                      />
                      <CardTitle className="text-lg">
                        {editingCategory?.id === category.id ? (
                          <Input
                            value={editingCategory.name}
                            onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                            className="text-lg font-semibold"
                            data-testid={`input-edit-category-name-${category.id}`}
                          />
                        ) : (
                          category.name
                        )}
                      </CardTitle>
                    </div>
                    <div className="flex space-x-1">
                      {editingCategory?.id === category.id ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleUpdateCategory}
                            disabled={updateMutation.isPending}
                            data-testid={`button-save-category-${category.id}`}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingCategory(null)}
                            data-testid={`button-cancel-edit-category-${category.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingCategory(category)}
                            data-testid={`button-edit-category-${category.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCategory(category.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-category-${category.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Badge variant="outline">{category.slug}</Badge>
                      {editingCategory?.id === category.id ? (
                        <Textarea
                          value={editingCategory.description || ""}
                          onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                          placeholder="Descrizione..."
                          data-testid={`textarea-edit-category-description-${category.id}`}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {category.description || "Nessuna descrizione"}
                        </p>
                      )}
                    </div>

                    {/* Subcategories Section */}
                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleCategoryExpansion(category.id)}
                            data-testid={`button-toggle-subcategories-${category.id}`}
                          >
                            {expandedCategories.has(category.id) ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                            <span className="ml-1 text-sm font-medium">
                              Sottocategorie ({subcategoriesByCategory[category.id]?.length || 0})
                            </span>
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startNewSubcategory(category.id)}
                          data-testid={`button-add-subcategory-${category.id}`}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Aggiungi
                        </Button>
                      </div>

                      {/* Expanded Subcategories */}
                      {expandedCategories.has(category.id) && (
                        <div className="space-y-2">
                          {/* New Subcategory Form */}
                          {showNewSubcategoryForm === category.id && (
                            <div className="bg-muted/30 p-3 rounded-lg border">
                              <div className="space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <Label htmlFor={`subcategory-name-${category.id}`} className="text-xs">Nome</Label>
                                    <Input
                                      id={`subcategory-name-${category.id}`}
                                      value={newSubcategory.name}
                                      onChange={(e) => {
                                        const name = e.target.value;
                                        setNewSubcategory({
                                          ...newSubcategory,
                                          name,
                                          slug: generateSlug(name),
                                        });
                                      }}
                                      data-testid={`input-new-subcategory-name-${category.id}`}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor={`subcategory-slug-${category.id}`} className="text-xs">Slug</Label>
                                    <Input
                                      id={`subcategory-slug-${category.id}`}
                                      value={newSubcategory.slug}
                                      onChange={(e) => setNewSubcategory({ ...newSubcategory, slug: e.target.value })}
                                      data-testid={`input-new-subcategory-slug-${category.id}`}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <Label htmlFor={`subcategory-description-${category.id}`} className="text-xs">Descrizione</Label>
                                  <Textarea
                                    id={`subcategory-description-${category.id}`}
                                    rows={2}
                                    value={newSubcategory.description || ""}
                                    onChange={(e) => setNewSubcategory({ ...newSubcategory, description: e.target.value })}
                                    data-testid={`textarea-new-subcategory-description-${category.id}`}
                                  />
                                </div>
                                <div className="flex justify-end space-x-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={cancelNewSubcategory}
                                    data-testid={`button-cancel-new-subcategory-${category.id}`}
                                  >
                                    <X className="mr-1 h-3 w-3" />
                                    Annulla
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleCreateSubcategory(category.id)}
                                    disabled={createSubcategoryMutation.isPending}
                                    data-testid={`button-save-new-subcategory-${category.id}`}
                                  >
                                    <Save className="mr-1 h-3 w-3" />
                                    Salva
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Existing Subcategories */}
                          {subcategoriesByCategory[category.id]?.map((subcategory: Subcategory) => (
                            <div
                              key={subcategory.id}
                              className="bg-muted/20 p-3 rounded-lg border flex items-start justify-between"
                            >
                              <div className="flex-1 space-y-1">
                                {editingSubcategory?.id === subcategory.id ? (
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      <Input
                                        value={editingSubcategory.name}
                                        onChange={(e) => setEditingSubcategory({ ...editingSubcategory, name: e.target.value })}
                                        data-testid={`input-edit-subcategory-name-${subcategory.id}`}
                                      />
                                      <Input
                                        value={editingSubcategory.slug}
                                        onChange={(e) => setEditingSubcategory({ ...editingSubcategory, slug: e.target.value })}
                                        data-testid={`input-edit-subcategory-slug-${subcategory.id}`}
                                      />
                                    </div>
                                    <Textarea
                                      value={editingSubcategory.description || ""}
                                      onChange={(e) => setEditingSubcategory({ ...editingSubcategory, description: e.target.value })}
                                      rows={2}
                                      data-testid={`textarea-edit-subcategory-description-${subcategory.id}`}
                                    />
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center space-x-2">
                                      <h4 className="font-medium text-sm">{subcategory.name}</h4>
                                      <Badge variant="secondary" className="text-xs">{subcategory.slug}</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                      {subcategory.description || "Nessuna descrizione"}
                                    </p>
                                  </>
                                )}
                              </div>
                              <div className="flex space-x-1 ml-2">
                                {editingSubcategory?.id === subcategory.id ? (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={handleUpdateSubcategory}
                                      disabled={updateSubcategoryMutation.isPending}
                                      data-testid={`button-save-subcategory-${subcategory.id}`}
                                    >
                                      <Save className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingSubcategory(null)}
                                      data-testid={`button-cancel-edit-subcategory-${subcategory.id}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditingSubcategory(subcategory)}
                                      data-testid={`button-edit-subcategory-${subcategory.id}`}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteSubcategory(subcategory.id)}
                                      disabled={deleteSubcategoryMutation.isPending}
                                      data-testid={`button-delete-subcategory-${subcategory.id}`}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}

                          {/* Empty state */}
                          {(!subcategoriesByCategory[category.id] || subcategoriesByCategory[category.id].length === 0) && 
                           showNewSubcategoryForm !== category.id && (
                            <div className="text-center py-4 text-muted-foreground text-sm">
                              Nessuna sottocategoria presente
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
