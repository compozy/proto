// Generated from ReUI base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

// Opted out of React Compiler with the rest of the grid (see data-grid.tsx).
"use no memo";

import type { ReactElement } from "react";
import { getColumnHeaderLabel, useDataGrid } from "@proto/ui/components/data-grid/data-grid";
import type { DataGridFeatures } from "@proto/ui/components/data-grid/data-grid";
import type { Table } from "@tanstack/react-table";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@proto/ui/components/dropdown-menu";

function DataGridColumnVisibility<TData extends object>({
  table,
  trigger,
}: {
  table: Table<DataGridFeatures, TData>;
  trigger: ReactElement<Record<string, unknown>>;
}) {
  const { i18n } = useDataGrid();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent align="end" className="defaults:min-w-[150px]">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="defaults:font-medium">
            {i18n.labels.toggleColumns}
          </DropdownMenuLabel>
          {table
            .getAllColumns()
            .filter((column) => column.getCanHide())
            .map((column) => {
              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  // Title-casing is for a raw column id only; an authored
                  // label keeps its own casing.
                  className={
                    getColumnHeaderLabel(column) === column.id ? "defaults:capitalize" : undefined
                  }
                  checked={column.getIsVisible()}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {getColumnHeaderLabel(column)}
                </DropdownMenuCheckboxItem>
              );
            })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { DataGridColumnVisibility };
