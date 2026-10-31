// Generated from ReUI base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

// Opted out of React Compiler with the rest of the grid (see data-grid.tsx).
"use no memo";

import { useMemo, useState } from "react";
import { Badge } from "@proto/ui/components/badge";
import { useDataGrid } from "@proto/ui/components/data-grid/data-grid";
import type { DataGridFeatures } from "@proto/ui/components/data-grid/data-grid";
import type { Column } from "@tanstack/react-table";

import { cn } from "@proto/ui/lib/utils";
import { Button } from "@proto/ui/components/button";
import { Input } from "@proto/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@proto/ui/components/popover";
import { Separator } from "@proto/ui/components/separator";
import { CheckIcon, CirclePlusIcon } from "@proto/ui/lib/icons";

interface DataGridColumnFilterProps<TData extends object, TValue> {
  column?: Column<DataGridFeatures, TData, TValue>;
  title?: string;
  options: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
}

function DataGridColumnFilter<TData extends object, TValue>({
  column,
  title,
  options,
}: DataGridColumnFilterProps<TData, TValue>) {
  const { i18n } = useDataGrid();
  const facets = column?.getFacetedUniqueValues();
  const filterValue = column?.getFilterValue();
  const selectedValues = new Set(Array.isArray(filterValue) ? (filterValue as string[]) : []);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <CirclePlusIcon className="defaults:size-4" />
            {title}
            {selectedValues?.size > 0 && (
              <>
                <Separator orientation="vertical" className="defaults:mx-2 defaults:h-4" />
                <Badge
                  variant="secondary"
                  className="defaults:px-1 defaults:font-normal defaults:lg:hidden"
                >
                  {selectedValues.size}
                </Badge>
                <div className="defaults:hidden defaults:gap-x-1 defaults:lg:flex">
                  {selectedValues.size > 2 ? (
                    <Badge variant="secondary" className="defaults:px-1 defaults:font-normal">
                      {i18n.labels.filterSelectedCount(selectedValues.size)}
                    </Badge>
                  ) : (
                    options
                      .filter((option) => selectedValues.has(option.value))
                      .map((option) => (
                        <Badge
                          variant="secondary"
                          key={option.value}
                          className="defaults:px-1 defaults:font-normal"
                        >
                          {option.label}
                        </Badge>
                      ))
                  )}
                </div>
              </>
            )}
          </Button>
        }
      />
      <PopoverContent className="defaults:w-[200px] defaults:p-0" align="start">
        <div className="defaults:p-2">
          <Input
            placeholder={title}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="defaults:h-8"
          />
        </div>
        <div className="defaults:max-h-[300px] defaults:overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="defaults:text-muted-foreground defaults:py-6 defaults:text-center defaults:text-sm">
              {i18n.labels.filterNoResults}
            </div>
          ) : (
            <div className="defaults:p-1">
              {filteredOptions.map((option) => {
                const isSelected = selectedValues.has(option.value);
                const facetCount = facets?.get(option.value);
                const toggleOption = () => {
                  if (isSelected) {
                    selectedValues.delete(option.value);
                  } else {
                    selectedValues.add(option.value);
                  }
                  const filterValues = Array.from(selectedValues);
                  column?.setFilterValue(filterValues.length ? filterValues : undefined);
                };
                return (
                  <div
                    key={option.value}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={toggleOption}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleOption();
                      }
                    }}
                    className={cn(
                      "defaults:rounded-md defaults:relative defaults:flex defaults:cursor-pointer defaults:items-center defaults:gap-2 defaults:px-2 defaults:py-1.5 defaults:text-sm defaults:outline-hidden defaults:select-none",
                      "defaults:hover:bg-accent defaults:hover:text-accent-foreground defaults:focus:bg-accent defaults:focus:text-accent-foreground"
                    )}
                  >
                    <div
                      className={cn(
                        "defaults:border-primary defaults:rounded-sm defaults:flex defaults:h-4 defaults:w-4 defaults:items-center defaults:justify-center defaults:border",
                        isSelected
                          ? "defaults:bg-primary defaults:text-primary-foreground"
                          : "defaults:opacity-50 defaults:[&_svg]:invisible"
                      )}
                    >
                      <CheckIcon className="defaults:h-4 defaults:w-4" />
                    </div>
                    {option.icon && (
                      <option.icon className="defaults:text-muted-foreground defaults:h-4 defaults:w-4" />
                    )}
                    <span>{option.label}</span>
                    {facetCount !== undefined && (
                      <span className="defaults:ms-auto defaults:flex defaults:h-4 defaults:w-4 defaults:items-center defaults:justify-center defaults:font-mono defaults:text-xs">
                        {facetCount}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {selectedValues.size > 0 && (
            <>
              <div className="defaults:bg-border defaults:-mx-1 defaults:my-1 defaults:h-px" />
              <div className="defaults:p-1">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => column?.setFilterValue(undefined)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      column?.setFilterValue(undefined);
                    }
                  }}
                  className="defaults:hover:bg-accent defaults:hover:text-accent-foreground defaults:focus:bg-accent defaults:focus:text-accent-foreground defaults:rounded-md defaults:relative defaults:flex defaults:cursor-pointer defaults:items-center defaults:justify-center defaults:px-2 defaults:py-1.5 defaults:text-sm defaults:outline-hidden defaults:select-none"
                >
                  {i18n.labels.filterClear}
                </div>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { DataGridColumnFilter, type DataGridColumnFilterProps };
