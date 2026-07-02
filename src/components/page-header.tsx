import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight truncate">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1 truncate">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap justify-end">{actions}</div>}
    </div>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="max-w-[1600px] mx-auto px-6 lg:px-8 py-8 w-full">{children}</div>;
}