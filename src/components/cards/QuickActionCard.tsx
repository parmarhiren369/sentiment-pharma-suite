import { LucideIcon } from "lucide-react";

interface QuickActionCardProps {
  title: string;
  icon: LucideIcon;
  onClick?: () => void;
}

export function QuickActionCard({ title, icon: Icon, onClick }: QuickActionCardProps) {
  return (
    <button onClick={onClick} className="quick-action-card">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <span className="text-sm font-medium text-primary">{title}</span>
    </button>
  );
}
