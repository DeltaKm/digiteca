import { FileX } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ 
  title, 
  description, 
  icon,
  action 
}: EmptyStateProps) {
  return (
    <div className="text-center py-12" data-testid="empty-state">
      <div className="mx-auto h-12 w-12 text-muted-foreground mb-4">
        {icon || <FileX className="h-12 w-12" />}
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground mb-4">{description}</p>
      {action && action}
    </div>
  );
}
