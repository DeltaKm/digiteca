import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Image, Folder, CloudUpload } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface StatsData {
  totalDocuments: number;
  totalImages: number;
  totalCategories: number;
  todayUploads: number;
}

export function StatsCards() {
  const { data: stats, isLoading } = useQuery<StatsData>({
    queryKey: ["/api/admin/stats"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-6">
            <div className="flex justify-center">
              <LoadingSpinner size="sm" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const statsData = [
    {
      title: "Documenti totali",
      value: stats?.totalDocuments || 0,
      icon: FileText,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Immagini",
      value: stats?.totalImages || 0,
      icon: Image,
      color: "text-secondary",
      bgColor: "bg-secondary/10",
    },
    {
      title: "Categorie",
      value: stats?.totalCategories || 0,
      icon: Folder,
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Oggi",
      value: stats?.todayUploads || 0,
      icon: CloudUpload,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statsData.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="p-6 shadow-sm" data-testid={`stat-card-${index}`}>
            <div className="flex items-center">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <Icon className={`text-xl h-6 w-6 ${stat.color}`} />
              </div>
              <div className="ml-4">
                <p className="text-2xl font-semibold text-foreground" data-testid={`stat-value-${index}`}>
                  {stat.value.toLocaleString()}
                </p>
                <p className="text-muted-foreground" data-testid={`stat-title-${index}`}>
                  {stat.title}
                </p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
