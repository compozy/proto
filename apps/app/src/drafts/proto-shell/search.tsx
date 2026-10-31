import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@proto/ui/components/command";
import { MessageSquare, Monitor, Moon, Workflow } from "@proto/ui/lib/icons";

import { comments, flow, loginForm } from "./data";

/** ⌘K palette scoped to the gallery: screens and their states, flows, comments and actions. */
export function SearchPalette() {
  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center bg-background/60 pt-[12vh] backdrop-blur-[2px]">
      <Command
        className="h-auto w-[min(560px,calc(100%-2rem))] rounded-2xl border border-border bg-[var(--shell-panel)] shadow-2xl"
        value="login-form-error"
      >
        <CommandInput
          placeholder="Search screens, states, flows or comments…"
          defaultValue="wrong"
        />
        <CommandList className="max-h-[420px]">
          <CommandEmpty>Nothing matches.</CommandEmpty>
          <CommandGroup heading="States">
            {loginForm.states
              .filter(item => item.id === "error" || item.id === "pending")
              .map(item => (
                <CommandItem key={item.id} value={`login-form-${item.id}`}>
                  <Monitor />
                  <span>
                    Sign in <span className="text-muted-foreground">·</span> {item.label}
                  </span>
                  <CommandShortcut className="font-mono">/login</CommandShortcut>
                </CommandItem>
              ))}
          </CommandGroup>
          <CommandGroup heading="Flows">
            <CommandItem value="flow-sign-in">
              <Workflow />
              <span>
                {flow.title}{" "}
                <span className="text-muted-foreground">· step 5 · Wrong password</span>
              </span>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading="Comments">
            {comments.slice(0, 1).map(item => (
              <CommandItem key={item.id} value={`comment-${item.id}`}>
                <MessageSquare />
                <span className="truncate">
                  #{item.id} {item.text}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Actions">
            <CommandItem value="toggle-theme">
              <Moon />
              Compare light and dark
              <CommandShortcut>T</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
