import { createContext } from "react";
export const DataTableCellEmailContext = createContext<{
  align: string | null;
} | null>(null);
