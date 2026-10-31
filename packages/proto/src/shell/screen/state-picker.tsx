import type { RegistryPrototype, RegistryState } from "../../model/registry";
import { useT } from "../lib/i18n";
import { padNumber } from "../lib/registry-model";
import { Button } from "../ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "../ui/combobox";
import { ChevronLeft, ChevronRight } from "../ui/icons";

/**
 * S6 state picker: a searchable combobox (prototypes can declare dozens of states) with the
 * state number and the position `3 / 4`, plus previous/next (J/K).
 */
export function StatePicker({
  prototype,
  state,
  unknown,
  onState,
  annotate,
}: {
  prototype: RegistryPrototype;
  state: RegistryState;
  /** A state id from the URL that the prototype does not declare. */
  unknown: string | null;
  onState: (state: string) => void;
  /** Per-state annotation (open comment counts, review slice). */
  annotate?: (state: RegistryState) => React.ReactNode;
}) {
  const t = useT();
  const states = prototype.states;
  const index = states.findIndex(item => item.id === state.id);
  const number = (item: RegistryState) => padNumber(states.indexOf(item) + 1);
  return (
    <div className="flex min-w-0 items-center gap-1 rounded-xl border border-border bg-[var(--shell-panel)] p-1">
      <Combobox
        items={states}
        value={state}
        onValueChange={(item: RegistryState | null) => {
          if (item) onState(item.id);
        }}
        itemToStringLabel={(item: RegistryState) => item.label}
        itemToStringValue={(item: RegistryState) => item.id}
        isItemEqualToValue={(a: RegistryState, b: RegistryState) => a.id === b.id}
      >
        <ComboboxTrigger
          aria-label={t("screen.state")}
          render={
            <Button
              variant="ghost"
              className="h-7 w-[260px] min-w-0 justify-between gap-2 px-2.5 text-[13px] font-normal max-sm:w-[170px]"
            />
          }
        >
          <ComboboxValue>
            {(item: RegistryState) => (
              <span className="flex min-w-0 items-center gap-2">
                <span className="font-mono text-[10px] text-primary">{number(item)}</span>
                <span className="truncate">{item.label}</span>
                {unknown && (
                  <span
                    title={t("screen.unknownState", { state: unknown })}
                    className="shrink-0 rounded bg-[color-mix(in_oklch,var(--tone-warning)_14%,transparent)] px-1.5 font-mono text-[10px] text-[var(--tone-warning)]"
                  >
                    {t("screen.unknown")}
                  </span>
                )}
                {annotate?.(item)}
              </span>
            )}
          </ComboboxValue>
        </ComboboxTrigger>
        <ComboboxContent className="w-[300px] min-w-[300px] bg-[var(--shell-panel)]">
          <ComboboxInput showTrigger={false} placeholder={t("screen.searchStates")} />
          <ComboboxEmpty>{t("screen.noState")}</ComboboxEmpty>
          <ComboboxList>
            {(item: RegistryState) => (
              <ComboboxItem key={item.id} value={item} className="gap-2.5 py-1.5 text-[13px]">
                <span className="font-mono text-[10px] text-muted-foreground">{number(item)}</span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {annotate?.(item)}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <span className="hidden px-1 font-mono text-[10px] whitespace-nowrap text-muted-foreground tabular-nums sm:inline">
        {index + 1} / {states.length}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("screen.previousState")}
        aria-keyshortcuts="J"
        disabled={index <= 0}
        onClick={() => {
          const previous = states[index - 1];
          if (previous) onState(previous.id);
        }}
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("screen.nextState")}
        aria-keyshortcuts="K"
        disabled={index >= states.length - 1}
        onClick={() => {
          const next = states[index + 1];
          if (next) onState(next.id);
        }}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
