
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Edit, 
  Trash2,
  FolderOpen,
  Folder,
  FileText
} from "lucide-react";
import type { Category, Subcategory } from "@shared/schema";

interface CategoryTreeProps {
  categories: Category[];
  subcategories: Subcategory[];
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (categoryId: string) => void;
  onAddSubcategory: (categoryId: string) => void;
  onEditSubcategory: (subcategory: Subcategory) => void;
  onDeleteSubcategory: (subcategoryId: string) => void;
  onAddCategory: () => void;
}

interface TreeNodeProps {
  category: Category;
  subcategories: Subcategory[];
  isExpanded: boolean;
  onToggle: () => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (categoryId: string) => void;
  onAddSubcategory: (categoryId: string) => void;
  onEditSubcategory: (subcategory: Subcategory) => void;
  onDeleteSubcategory: (subcategoryId: string) => void;
}

function TreeNode({ 
  category, 
  subcategories, 
  isExpanded, 
  onToggle,
  onEditCategory,
  onDeleteCategory,
  onAddSubcategory,
  onEditSubcategory,
  onDeleteSubcategory
}: TreeNodeProps) {
  const subcategoriesForCategory = subcategories.filter(sub => sub.categoryId === category.id);
  const hasSubcategories = subcategoriesForCategory.length > 0;

  return (
    <div className="select-none">
      {/* Category Node */}
      <div className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded-md group">
        {/* Expand/Collapse Button */}
        <Button
          variant="ghost"
          size="sm"
          className="p-0 h-6 w-6 hover:bg-background"
          onClick={onToggle}
          disabled={!hasSubcategories}
        >
          {hasSubcategories ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <div className="w-4 h-4" />
          )}
        </Button>

        {/* Category Icon */}
        <div className="flex items-center gap-2">
          {isExpanded && hasSubcategories ? (
            <FolderOpen className="h-4 w-4 text-blue-500" />
          ) : (
            <Folder className="h-4 w-4 text-blue-500" />
          )}
          
          {/* Category Color Indicator */}
          <div
            className="w-3 h-3 rounded-full border"
            style={{ backgroundColor: category.color || '#3B82F6' }}
          />
        </div>

        {/* Category Info */}
        <div className="flex-1 flex items-center gap-2">
          <span className="font-medium text-sm">{category.name}</span>
          <Badge variant="secondary" className="text-xs">
            {category.slug}
          </Badge>
          {hasSubcategories && (
            <Badge variant="outline" className="text-xs">
              {subcategoriesForCategory.length} sub
            </Badge>
          )}
        </div>

        {/* Category Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onAddSubcategory(category.id)}
            title="Aggiungi sottocategoria"
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onEditCategory(category)}
            title="Modifica categoria"
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            onClick={() => onDeleteCategory(category.id)}
            title="Elimina categoria"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Subcategories */}
      {isExpanded && hasSubcategories && (
        <div className="ml-8 border-l border-border pl-4 space-y-1">
          {subcategoriesForCategory.map((subcategory) => (
            <div 
              key={subcategory.id} 
              className="flex items-center gap-2 p-2 hover:bg-muted/30 rounded-md group"
            >
              {/* Subcategory Icon */}
              <FileText className="h-4 w-4 text-green-500" />
              
              {/* Subcategory Info */}
              <div className="flex-1 flex items-center gap-2">
                <span className="text-sm">{subcategory.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {subcategory.slug}
                </Badge>
              </div>

              {/* Subcategory Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => onEditSubcategory(subcategory)}
                  title="Modifica sottocategoria"
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  onClick={() => onDeleteSubcategory(subcategory.id)}
                  title="Elimina sottocategoria"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryTree({
  categories,
  subcategories,
  onEditCategory,
  onDeleteCategory,
  onAddSubcategory,
  onEditSubcategory,
  onDeleteSubcategory,
  onAddCategory,
}: CategoryTreeProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const expandAll = () => {
    setExpandedCategories(new Set(categories.map(cat => cat.id)));
  };

  const collapseAll = () => {
    setExpandedCategories(new Set());
  };

  return (
    <Card>
      <CardContent className="p-4">
        {/* Tree Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Struttura Categorie</h3>
            <Badge variant="outline">
              {categories.length} categorie, {subcategories.length} sottocategorie
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>
              Espandi Tutto
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Comprimi Tutto
            </Button>
            <Button size="sm" onClick={onAddCategory}>
              <Plus className="h-4 w-4 mr-1" />
              Nuova Categoria
            </Button>
          </div>
        </div>

        {/* Tree Content */}
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nessuna categoria presente</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onAddCategory}
                className="mt-2"
              >
                Crea la prima categoria
              </Button>
            </div>
          ) : (
            categories.map((category) => (
              <TreeNode
                key={category.id}
                category={category}
                subcategories={subcategories}
                isExpanded={expandedCategories.has(category.id)}
                onToggle={() => toggleCategory(category.id)}
                onEditCategory={onEditCategory}
                onDeleteCategory={onDeleteCategory}
                onAddSubcategory={onAddSubcategory}
                onEditSubcategory={onEditSubcategory}
                onDeleteSubcategory={onDeleteSubcategory}
              />
            ))
          )}
        </div>

        {/* Tree Statistics */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Folder className="h-3 w-3" />
                <span>{categories.length} Categorie</span>
              </div>
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span>{subcategories.length} Sottocategorie</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span>Espanse: {expandedCategories.size}/{categories.length}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
