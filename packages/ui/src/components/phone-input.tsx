// Generated from ReUI base-nova (MIT) by scripts/primitives.mjs; local changes live in patches/primitives. See docs/primitives.md.
"use client";

import { createContext, useContext, useMemo, useState } from "react";
import * as BasePhoneInput from "react-phone-number-input";
import flags from "react-phone-number-input/flags";

import { cn } from "@proto/ui/lib/utils";
import { Button } from "@proto/ui/components/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
} from "@proto/ui/components/combobox";
import { Input } from "@proto/ui/components/input";
import { ScrollArea } from "@proto/ui/components/scroll-area";
import { GlobeIcon } from "@proto/ui/lib/icons";

type PhoneInputSize = "sm" | "default" | "lg";

const PhoneInputContext = createContext<{
  variant: PhoneInputSize;
  popupClassName?: string;
  scrollAreaClassName?: string;
}>({
  variant: "default",
  popupClassName: undefined,
  scrollAreaClassName: undefined,
});

type PhoneInputProps = Omit<React.ComponentProps<"input">, "onChange" | "value" | "ref"> &
  Omit<
    BasePhoneInput.Props<typeof BasePhoneInput.default>,
    "onChange" | "variant" | "popupClassName" | "scrollAreaClassName"
  > & {
    onChange?: (value: BasePhoneInput.Value) => void;
    variant?: PhoneInputSize;
    popupClassName?: string;
    scrollAreaClassName?: string;
  };

function PhoneInput({
  className,
  variant,
  popupClassName,
  scrollAreaClassName,
  onChange,
  value,
  ...props
}: PhoneInputProps) {
  const phoneInputSize = variant || "default";
  return (
    <PhoneInputContext.Provider
      value={{ variant: phoneInputSize, popupClassName, scrollAreaClassName }}
    >
      <BasePhoneInput.default
        className={cn(
          "defaults:flex",
          props["aria-invalid"] &&
            "defaults:[&_*[data-slot=combobox-trigger]]:border-destructive defaults:[&_*[data-slot=combobox-trigger]]:ring-destructive/50",
          className
        )}
        flagComponent={FlagComponent}
        countrySelectComponent={CountrySelect}
        inputComponent={InputComponent}
        smartCaret={false}
        value={value || undefined}
        onChange={(value) => onChange?.(value || ("" as BasePhoneInput.Value))}
        {...props}
      />
    </PhoneInputContext.Provider>
  );
}

function InputComponent({ className, ...props }: React.ComponentProps<typeof Input>) {
  const { variant } = useContext(PhoneInputContext);

  return (
    <Input
      className={cn(
        "defaults:ring-none! defaults:rounded-s-none defaults:outline-none! defaults:focus:z-1",
        variant === "sm" && "defaults:h-7",
        variant === "lg" && "defaults:h-9",
        className
      )}
      {...props}
    />
  );
}

type CountryEntry = { label: string; value: BasePhoneInput.Country | undefined };

type CountrySelectProps = {
  disabled?: boolean;
  value: BasePhoneInput.Country;
  options: CountryEntry[];
  onChange: (country: BasePhoneInput.Country) => void;
};

function CountrySelect({
  disabled,
  value: selectedCountry,
  options: countryList,
  onChange,
}: CountrySelectProps) {
  const { variant, popupClassName } = useContext(PhoneInputContext);
  const [searchValue, setSearchValue] = useState("");

  // Only countries with a code render as rows (the library's "International"
  // option has none), so the rows, the empty state and the list's guard below
  // count the same entries.
  const filteredCountries = useMemo(() => {
    const query = searchValue.toLowerCase();
    return countryList.filter(({ value, label }) => value && label.toLowerCase().includes(query));
  }, [countryList, searchValue]);

  return (
    <Combobox
      items={filteredCountries}
      value={selectedCountry || ""}
      onValueChange={(country: BasePhoneInput.Country | null) => {
        if (country) {
          onChange(country);
        }
      }}
    >
      <ComboboxTrigger
        render={
          <Button
            variant="outline"
            size={variant}
            className={cn(
              "defaults:rounded-s-lg defaults:rounded-e-none defaults:flex defaults:gap-1 defaults:border-e-0 defaults:px-2.5 defaults:py-0 defaults:leading-none defaults:hover:bg-transparent defaults:focus:z-10 defaults:data-pressed:bg-transparent",
              disabled && "defaults:opacity-50"
            )}
            disabled={disabled}
          >
            <span className="defaults:sr-only">
              <ComboboxValue />
            </span>
            <FlagComponent country={selectedCountry} countryName={selectedCountry} />
          </Button>
        }
      />
      <ComboboxContent
        className={cn(
          "defaults:w-xs defaults:*:data-[slot=input-group]:bg-transparent",
          popupClassName
        )}
      >
        <ComboboxInput
          placeholder="e.g. United States"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          showTrigger={false}
          className="defaults:border-input defaults:focus-visible:border-border defaults:rounded-none defaults:border-0 defaults:px-0 defaults:py-2.5 defaults:shadow-none defaults:ring-0! defaults:outline-none! defaults:focus-visible:ring-0 defaults:focus-visible:ring-offset-0"
        />
        <ComboboxSeparator />
        <ComboboxEmpty className="defaults:px-4 defaults:py-2.5 defaults:text-sm">
          No country found.
        </ComboboxEmpty>
        {/* The rows scroll inside the list's own max height, its per-style
            padding moved inside, so the last country can be reached; the list
            itself must not scroll too. Not rendered while nothing matches: an
            emptied scroll area kept its old thumb below the popup. */}
        <ComboboxList className="defaults:p-0">
          {filteredCountries.length > 0 && (
            <div className="defaults:relative defaults:flex defaults:max-h-[inherit]">
              <div className="defaults:p-1 defaults:flex defaults:max-h-[inherit] defaults:w-full defaults:scroll-pt-2 defaults:scroll-pb-2 defaults:flex-col defaults:overscroll-contain">
                <ScrollArea className="defaults:size-full defaults:min-h-0 defaults:**:data-[slot=scroll-area-scrollbar]:m-0 defaults:[&_[data-slot=scroll-area-viewport]]:h-full defaults:[&_[data-slot=scroll-area-viewport]]:overscroll-contain">
                  {filteredCountries.map((item: CountryEntry) =>
                    item.value ? (
                      <ComboboxItem
                        key={item.value}
                        value={item.value}
                        className="defaults:flex defaults:items-center defaults:gap-2"
                      >
                        <FlagComponent country={item.value} countryName={item.label} />
                        <span className="defaults:flex-1 defaults:text-sm">{item.label}</span>
                        <span className="defaults:text-foreground/50 defaults:text-sm">
                          {`+${BasePhoneInput.getCountryCallingCode(item.value)}`}
                        </span>
                      </ComboboxItem>
                    ) : null
                  )}
                </ScrollArea>
              </div>
            </div>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function FlagComponent({ country, countryName }: BasePhoneInput.FlagProps) {
  const Flag = flags[country];

  return (
    <span className="defaults:flex defaults:h-4 defaults:w-4 defaults:items-center defaults:justify-center defaults:[&_svg:not([class*='size-'])]:size-full! defaults:[&_svg:not([class*='size-'])]:rounded-[5px]">
      {Flag ? (
        <Flag title={countryName} />
      ) : (
        <GlobeIcon className="defaults:size-4 defaults:opacity-60" />
      )}
    </span>
  );
}

export { PhoneInput };
