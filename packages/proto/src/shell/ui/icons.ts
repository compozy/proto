// Vendored subset of @proto/ui icons (packages/ui/src/lib/icons.ts, BnUI v0.1.2): Lucide names
// mapped to reicon-react, so the prebuilt shell never imports @proto/ui (ADR-002). Add icons by
// copying their lines from the source module, which also owns `strokeWidth` and `decorative`.
import { createElement, forwardRef } from "react";
import { createIcon } from "reicon-react/createIcon";
import type { IconComponent, IconProps } from "reicon-react/createIcon";
import { AlertCircle as AlertCircleSource } from "reicon-react/icons/AlertCircle";
import { AlertTriangle as AlertTriangleSource } from "reicon-react/icons/AlertTriangle";
import { CheckCircle as CheckCircleSource } from "reicon-react/icons/CheckCircle";
import { DocumentCode as DocumentCodeSource } from "reicon-react/icons/DocumentCode";
import { History as HistorySource } from "reicon-react/icons/History";
import { Key as KeySource } from "reicon-react/icons/Key";
import { Maximize as MaximizeSource } from "reicon-react/icons/Maximize";
import { Trash2 as Trash2Source } from "reicon-react/icons/Trash2";
import { Widget as WidgetSource } from "reicon-react/icons/Widget";
import { ArrowRight as ArrowRightSource } from "reicon-react/icons/ArrowRight";
import { ArrowUpRight as ArrowUpRightSource } from "reicon-react/icons/ArrowUpRight";
import { BookOpen as BookOpenSource } from "reicon-react/icons/BookOpen";
import { Check as CheckSource } from "reicon-react/icons/Check";
import { ChevronDown as ChevronDownSource } from "reicon-react/icons/ChevronDown";
import { ChevronLeft as ChevronLeftSource } from "reicon-react/icons/ChevronLeft";
import { ChevronRight as ChevronRightSource } from "reicon-react/icons/ChevronRight";
import { Clock as ClockSource } from "reicon-react/icons/Clock";
import { Code as CodeSource } from "reicon-react/icons/Code";
import { Command as CommandSource } from "reicon-react/icons/Command";
import { Copy as CopySource } from "reicon-react/icons/Copy";
import { Cursor as CursorSource } from "reicon-react/icons/Cursor";
import { DarkLight as DarkLightSource } from "reicon-react/icons/DarkLight";
import { Export5 as Export5Source } from "reicon-react/icons/Export5";
import { Eye as EyeSource } from "reicon-react/icons/Eye";
import { Filter as FilterSource } from "reicon-react/icons/Filter";
import { Flag as FlagSource } from "reicon-react/icons/Flag";
import { Forward2 as Forward2Source } from "reicon-react/icons/Forward2";
import { Globe as GlobeSource } from "reicon-react/icons/Globe";
import { Hand as HandSource } from "reicon-react/icons/Hand";
import { InfoCircle as InfoCircleSource } from "reicon-react/icons/InfoCircle";
import { Keyboard as KeyboardSource } from "reicon-react/icons/Keyboard";
import { Layers as LayersSource } from "reicon-react/icons/Layers";
import { Link as LinkSource } from "reicon-react/icons/Link";
import { Lock as LockSource } from "reicon-react/icons/Lock";
import { Login as LoginSource } from "reicon-react/icons/Login";
import { MessagePlus as MessagePlusSource } from "reicon-react/icons/MessagePlus";
import { Message as MessageSource } from "reicon-react/icons/Message";
import { Minus as MinusSource } from "reicon-react/icons/Minus";
import { Mobile as MobileSource } from "reicon-react/icons/Mobile";
import { Monitor as MonitorSource } from "reicon-react/icons/Monitor";
import { Moon as MoonSource } from "reicon-react/icons/Moon";
import { MoreH as MoreHSource } from "reicon-react/icons/MoreH";
import { Paperclip as PaperclipSource } from "reicon-react/icons/Paperclip";
import { Pen as PenSource } from "reicon-react/icons/Pen";
import { Plus as PlusSource } from "reicon-react/icons/Plus";
import { Programming as ProgrammingSource } from "reicon-react/icons/Programming";
import { RotateLeft as RotateLeftSource } from "reicon-react/icons/RotateLeft";
import { RowHorizontal as RowHorizontalSource } from "reicon-react/icons/RowHorizontal";
import { Scan as ScanSource } from "reicon-react/icons/Scan";
import { Search as SearchSource } from "reicon-react/icons/Search";
import { Send as SendSource } from "reicon-react/icons/Send";
import { Settings2 as Settings2Source } from "reicon-react/icons/Settings2";
import { ShieldCheck as ShieldCheckSource } from "reicon-react/icons/ShieldCheck";
import { SidebarRight as SidebarRightSource } from "reicon-react/icons/SidebarRight";
import { Sparkles as SparklesSource } from "reicon-react/icons/Sparkles";
import { Sun as SunSource } from "reicon-react/icons/Sun";
import { Tablet as TabletSource } from "reicon-react/icons/Tablet";
import { Users as UsersSource } from "reicon-react/icons/Users";
import { X as XSource } from "reicon-react/icons/X";

export type { IconComponent, IconProps } from "reicon-react/createIcon";

const strokeWidth = 1.75;

/**
 * Hides an icon from assistive technology unless the caller names it, as Lucide does, and sets
 * the outline weight. Filled glyphs keep their shape: a stroke would only swell them.
 */
function decorative(Glyph: IconComponent): IconComponent {
  return forwardRef<SVGSVGElement, IconProps>((props, ref) => {
    const named = Object.keys(props).some(
      prop => prop.startsWith("aria-") || prop === "role" || prop === "title"
    );
    return createElement(Glyph, {
      ...(named ? null : { "aria-hidden": true }),
      ...(props.weight === "Filled" ? null : { strokeWidth }),
      ...props,
      ref,
    });
  });
}

export const ArrowRight = /*#__PURE__*/ decorative(ArrowRightSource);
export const ArrowUpRight = /*#__PURE__*/ decorative(ArrowUpRightSource);
export const BookOpen = /*#__PURE__*/ decorative(BookOpenSource);
export const Bot = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("Bot", {
    O: '<rect x="4.75" y="7.75" width="14.5" height="11.5" rx="3.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7.75V4.75M2.75 12.25v2.5M21.25 12.25v2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="3.75" r="1" fill="currentColor"/><circle cx="9.25" cy="13.25" r="1.5" fill="currentColor"/><circle cx="14.75" cy="13.25" r="1.5" fill="currentColor"/>',
  })
);
export const Check = /*#__PURE__*/ decorative(CheckSource);
export { Check as CheckIcon };
export const ChevronDown = /*#__PURE__*/ decorative(ChevronDownSource);
export { ChevronDown as ChevronDownIcon };
export const ChevronLeft = /*#__PURE__*/ decorative(ChevronLeftSource);
export const ChevronRight = /*#__PURE__*/ decorative(ChevronRightSource);
export { ChevronRight as ChevronRightIcon };
export const Clock = /*#__PURE__*/ decorative(ClockSource);
export const Code = /*#__PURE__*/ decorative(CodeSource);
export const Columns2 = /*#__PURE__*/ decorative(RowHorizontalSource);
export const Command = /*#__PURE__*/ decorative(CommandSource);
export const Copy = /*#__PURE__*/ decorative(CopySource);
export const CornerDownRight = /*#__PURE__*/ decorative(Forward2Source);
export const Ellipsis = /*#__PURE__*/ decorative(MoreHSource);
export const ExternalLink = /*#__PURE__*/ decorative(Export5Source);
export const Eye = /*#__PURE__*/ decorative(EyeSource);
export const Filter = /*#__PURE__*/ decorative(FilterSource);
export const Flag = /*#__PURE__*/ decorative(FlagSource);
export const Globe = /*#__PURE__*/ decorative(GlobeSource);
export const Hand = /*#__PURE__*/ decorative(HandSource);
export const Info = /*#__PURE__*/ decorative(InfoCircleSource);
export const Keyboard = /*#__PURE__*/ decorative(KeyboardSource);
export const Layers = /*#__PURE__*/ decorative(LayersSource);
export const Link = /*#__PURE__*/ decorative(LinkSource);
export const Lock = /*#__PURE__*/ decorative(LockSource);
export const LogIn = /*#__PURE__*/ decorative(LoginSource);
export const MessageSquare = /*#__PURE__*/ decorative(MessageSource);
export const MessageSquarePlus = /*#__PURE__*/ decorative(MessagePlusSource);
export const Minus = /*#__PURE__*/ decorative(MinusSource);
export const Monitor = /*#__PURE__*/ decorative(MonitorSource);
export const Moon = /*#__PURE__*/ decorative(MoonSource);
export const MousePointer2 = /*#__PURE__*/ decorative(CursorSource);
export const PanelRight = /*#__PURE__*/ decorative(SidebarRightSource);
export const Paperclip = /*#__PURE__*/ decorative(PaperclipSource);
export const Pencil = /*#__PURE__*/ decorative(PenSource);
export const Plus = /*#__PURE__*/ decorative(PlusSource);
export const RotateCcw = /*#__PURE__*/ decorative(RotateLeftSource);
export const Scan = /*#__PURE__*/ decorative(ScanSource);
export const Search = /*#__PURE__*/ decorative(SearchSource);
export const Send = /*#__PURE__*/ decorative(SendSource);
export const Settings = /*#__PURE__*/ decorative(Settings2Source);
export const ShieldCheck = /*#__PURE__*/ decorative(ShieldCheckSource);
export const Smartphone = /*#__PURE__*/ decorative(MobileSource);
export const Sparkles = /*#__PURE__*/ decorative(SparklesSource);
export const Sun = /*#__PURE__*/ decorative(SunSource);
export const SunMoon = /*#__PURE__*/ decorative(DarkLightSource);
export const Tablet = /*#__PURE__*/ decorative(TabletSource);
export const Terminal = /*#__PURE__*/ decorative(ProgrammingSource);
export const Users = /*#__PURE__*/ decorative(UsersSource);
export const Workflow = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("Workflow", {
    O: '<rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 11v3a3 3 0 0 0 3 3h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export const X = /*#__PURE__*/ decorative(XSource);
export { X as XIcon };
export const AlertCircle = /*#__PURE__*/ decorative(AlertCircleSource);
export { AlertCircle as CircleAlert };
export const AlertTriangle = /*#__PURE__*/ decorative(AlertTriangleSource);
export { AlertTriangle as TriangleAlert };
export const CheckCircle = /*#__PURE__*/ decorative(CheckCircleSource);
export { CheckCircle as CircleCheck };
export const FileBracesCorner = /*#__PURE__*/ decorative(DocumentCodeSource);
export { FileBracesCorner as FileCode };
export const FileClock = /*#__PURE__*/ decorative(HistorySource);
export { FileClock as History };
export const Key = /*#__PURE__*/ decorative(KeySource);
export { Key as KeyRound };
export const Maximize = /*#__PURE__*/ decorative(MaximizeSource);
export { Maximize as Maximize2 };
export const Trash = /*#__PURE__*/ decorative(Trash2Source);
export { Trash as Trash2 };
export const Blocks = /*#__PURE__*/ decorative(WidgetSource);
export { Blocks as LayoutGrid };
