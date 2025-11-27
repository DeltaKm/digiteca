import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";
import type { SearchDocuments, Category } from "@shared/schema";

interface SearchFormProps {
  onSearch: (params: Partial<SearchDocuments>) => void;
}

export function SearchForm({ onSearch }: SearchFormProps) {
  const [formData, setFormData] = useState({
    query: "",
    categoryId: "all",
    period: "all",
    format: "all",
  });

  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      query: formData.query || undefined,
      categoryId: formData.categoryId === "all" ? undefined : formData.categoryId,
      period: formData.period === "all" ? undefined : formData.period,
      format: formData.format === "all" ? undefined : formData.format,
    });
  };

  const handleReset = () => {
    setFormData({
      query: "",
      categoryId: "all",
      period: "all",
      format: "all",
    });
    onSearch({});
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div>
                <Label htmlFor="search-query" className="block text-sm font-medium text-foreground mb-2">
                  Ricerca Generale
                </Label>
                <Input
                  id="search-query"
                  type="text"
                  placeholder="Cerca titoli, descrizioni..."
                  value={formData.query}
                  onChange={(e) => setFormData({ ...formData, query: e.target.value })}
                  data-testid="input-search-query"
                />
              </div>
              
              <div>
                <Label htmlFor="search-category" className="block text-sm font-medium text-foreground mb-2">
                  Categoria
                </Label>
                <Select 
                  value={formData.categoryId} 
                  onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                >
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Tutte le categorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le categorie</SelectItem>
                    {categories?.map((category: Category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="search-period" className="block text-sm font-medium text-foreground mb-2">
                  Periodo
                </Label>
                <Select 
                  value={formData.period} 
                  onValueChange={(value) => setFormData({ ...formData, period: value })}
                >
                  <SelectTrigger data-testid="select-period">
                    <SelectValue placeholder="Tutti i periodi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i periodi</SelectItem>
                    <SelectItem value="Medioevo">Medioevo</SelectItem>
                    <SelectItem value="Rinascimento">Rinascimento</SelectItem>
                    <SelectItem value="Epoca Moderna">Epoca Moderna</SelectItem>
                    <SelectItem value="XIX Secolo">XIX Secolo</SelectItem>
                    <SelectItem value="XX Secolo">XX Secolo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="search-format" className="block text-sm font-medium text-foreground mb-2">
                  Formato
                </Label>
                <Select 
                  value={formData.format} 
                  onValueChange={(value) => setFormData({ ...formData, format: value })}
                >
                  <SelectTrigger data-testid="select-format">
                    <SelectValue placeholder="Tutti i formati" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i formati</SelectItem>
                    <SelectItem value="images">Solo Immagini</SelectItem>
                    <SelectItem value="documents">Solo Documenti</SelectItem>
                    <SelectItem value="audio">File Audio</SelectItem>
                    <SelectItem value="video">File Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex justify-center space-x-3">
              <Button type="submit" data-testid="button-search">
                <Search className="mr-2 h-4 w-4" />
                Cerca
              </Button>
              <Button type="button" variant="outline" onClick={handleReset} data-testid="button-reset">
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
