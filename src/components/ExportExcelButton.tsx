import { Button } from "@/components/ui/button";
import { exportToExcel } from "@/lib/export-excel";
import { Download } from "lucide-react";

type ExportExcelButtonProps<T extends Record<string, unknown>> = {
  rows: T[];
  fileName: string;
  sheetName?: string;
  label?: string;
  disabled?: boolean;
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "link";
};

export function ExportExcelButton<T extends Record<string, unknown>>({
  rows,
  fileName,
  sheetName,
  label = "Export",
  disabled,
  variant = "secondary",
}: ExportExcelButtonProps<T>) {
  const isDisabled = disabled ?? !rows?.length;

  return (
    <Button
      type="button"
      variant={variant}
      onClick={() => exportToExcel({ rows, fileName, sheetName })}
      disabled={isDisabled}
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      {label}
    </Button>
  );
}
