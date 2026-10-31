// Vendored subset of @proto/ui icons (packages/ui/src/lib/icons.ts @ 5e799db): Lucide names
// mapped to reicon-react, so the prebuilt shell never imports @proto/ui (ADR-002). Add icons by
// copying their line from the source map.
import { createIcon } from "reicon-react/createIcon";

export type { IconComponent, IconProps } from "reicon-react/createIcon";
export { AlertCircle as CircleAlert } from "reicon-react/icons/AlertCircle";
export { AlertTriangle as TriangleAlert } from "reicon-react/icons/AlertTriangle";
export { ArrowRight } from "reicon-react/icons/ArrowRight";
export { ArrowUpRight } from "reicon-react/icons/ArrowUpRight";
export { BookOpen } from "reicon-react/icons/BookOpen";
export { Check as CheckIcon } from "reicon-react/icons/Check";
export { Check } from "reicon-react/icons/Check";
export { CheckCircle as CircleCheck } from "reicon-react/icons/CheckCircle";
export { ChevronDown as ChevronDownIcon } from "reicon-react/icons/ChevronDown";
export { ChevronDown } from "reicon-react/icons/ChevronDown";
export { ChevronLeft } from "reicon-react/icons/ChevronLeft";
export { ChevronRight as ChevronRightIcon } from "reicon-react/icons/ChevronRight";
export { ChevronRight } from "reicon-react/icons/ChevronRight";
export { Clock } from "reicon-react/icons/Clock";
export { Code } from "reicon-react/icons/Code";
export { Command } from "reicon-react/icons/Command";
export { Copy } from "reicon-react/icons/Copy";
export { Cursor as MousePointer2 } from "reicon-react/icons/Cursor";
export { DarkLight as SunMoon } from "reicon-react/icons/DarkLight";
export { Data2 as Workflow } from "reicon-react/icons/Data2";
export { DocumentCode as FileCode } from "reicon-react/icons/DocumentCode";
export { Export4 as ExternalLink } from "reicon-react/icons/Export4";
export { Eye } from "reicon-react/icons/Eye";
export { Filter } from "reicon-react/icons/Filter";
export { Flag } from "reicon-react/icons/Flag";
export { Forward2 as CornerDownRight } from "reicon-react/icons/Forward2";
export { Globe } from "reicon-react/icons/Globe";
export { Hand } from "reicon-react/icons/Hand";
export { History } from "reicon-react/icons/History";
export { InfoCircle as Info } from "reicon-react/icons/InfoCircle";
export { Key as KeyRound } from "reicon-react/icons/Key";
export { Keyboard } from "reicon-react/icons/Keyboard";
export { Layers } from "reicon-react/icons/Layers";
export { Link } from "reicon-react/icons/Link";
export { Lock } from "reicon-react/icons/Lock";
export { Login as LogIn } from "reicon-react/icons/Login";
export { Maximize as Maximize2 } from "reicon-react/icons/Maximize";
export { MessageAdd2 as MessageSquarePlus } from "reicon-react/icons/MessageAdd2";
export { MessageSquare } from "reicon-react/icons/MessageSquare";
export { Minus } from "reicon-react/icons/Minus";
export { Mobile as Smartphone } from "reicon-react/icons/Mobile";
export { Monitor } from "reicon-react/icons/Monitor";
export { Moon } from "reicon-react/icons/Moon";
export { MoreH as Ellipsis } from "reicon-react/icons/MoreH";
export { Paperclip } from "reicon-react/icons/Paperclip";
export { Pen as Pencil } from "reicon-react/icons/Pen";
export { Plus } from "reicon-react/icons/Plus";
export { Programming as Terminal } from "reicon-react/icons/Programming";
export { RotateLeft as RotateCcw } from "reicon-react/icons/RotateLeft";
export { RowHorizontal as Columns2 } from "reicon-react/icons/RowHorizontal";
export { Scan } from "reicon-react/icons/Scan";
export { Search } from "reicon-react/icons/Search";
export { Send } from "reicon-react/icons/Send";
export { Settings2 as Settings } from "reicon-react/icons/Settings2";
export { ShieldCheck } from "reicon-react/icons/ShieldCheck";
export { SidebarRight as PanelRight } from "reicon-react/icons/SidebarRight";
export { Sparkles } from "reicon-react/icons/Sparkles";
export { Sun } from "reicon-react/icons/Sun";
export { Tablet } from "reicon-react/icons/Tablet";
export { Trash2 } from "reicon-react/icons/Trash2";
export { Users } from "reicon-react/icons/Users";
export { Widget as LayoutGrid } from "reicon-react/icons/Widget";
export { X as XIcon } from "reicon-react/icons/X";
export { X } from "reicon-react/icons/X";

/** Drawn locally (copied from @proto/ui icons): Reicon has no Bot glyph. */
const BotGlyph = createIcon("Bot", {
  O: '<rect x="4.75" y="7.75" width="14.5" height="11.5" rx="3.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7.75V4.75M2.75 12.25v2.5M21.25 12.25v2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="3.75" r="1" fill="currentColor"/><circle cx="9.25" cy="13.25" r="1.5" fill="currentColor"/><circle cx="14.75" cy="13.25" r="1.5" fill="currentColor"/>',
});
export { BotGlyph as Bot };
