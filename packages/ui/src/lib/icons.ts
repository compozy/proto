import { createElement, forwardRef } from "react";
import { createIcon } from "reicon-react/createIcon";
import type { IconComponent, IconProps } from "reicon-react/createIcon";
import { Additem as AdditemSource } from "reicon-react/icons/Additem";
import { AddressBook as AddressBookSource } from "reicon-react/icons/AddressBook";
import { Airplane as AirplaneSource } from "reicon-react/icons/Airplane";
import { AlarmCheck as AlarmCheckSource } from "reicon-react/icons/AlarmCheck";
import { Alert as AlertSource } from "reicon-react/icons/Alert";
import { AlertCircle as AlertCircleSource } from "reicon-react/icons/AlertCircle";
import { AlertTriangle as AlertTriangleSource } from "reicon-react/icons/AlertTriangle";
import { AlignVSpacing as AlignVSpacingSource } from "reicon-react/icons/AlignVSpacing";
import { Anchor as AnchorSource } from "reicon-react/icons/Anchor";
import { AnglesLeft as AnglesLeftSource } from "reicon-react/icons/AnglesLeft";
import { AnglesRight as AnglesRightSource } from "reicon-react/icons/AnglesRight";
import { Archive as ArchiveSource } from "reicon-react/icons/Archive";
import { ArchiveUp as ArchiveUpSource } from "reicon-react/icons/ArchiveUp";
import { Arrow2 as Arrow2Source } from "reicon-react/icons/Arrow2";
import { Arrow3 as Arrow3Source } from "reicon-react/icons/Arrow3";
import { ArrowDown as ArrowDownSource } from "reicon-react/icons/ArrowDown";
import { ArrowDownRight as ArrowDownRightSource } from "reicon-react/icons/ArrowDownRight";
import { ArrowLeft as ArrowLeftSource } from "reicon-react/icons/ArrowLeft";
import { ArrowRight as ArrowRightSource } from "reicon-react/icons/ArrowRight";
import { ArrowRight3 as ArrowRight3Source } from "reicon-react/icons/ArrowRight3";
import { ArrowUp as ArrowUpSource } from "reicon-react/icons/ArrowUp";
import { ArrowUpRight as ArrowUpRightSource } from "reicon-react/icons/ArrowUpRight";
import { AtSign as AtSignSource } from "reicon-react/icons/AtSign";
import { Ban as BanSource } from "reicon-react/icons/Ban";
import { Bank as BankSource } from "reicon-react/icons/Bank";
import { Banknote as BanknoteSource } from "reicon-react/icons/Banknote";
import { BatteryCharging as BatteryChargingSource } from "reicon-react/icons/BatteryCharging";
import { Bell as BellSource } from "reicon-react/icons/Bell";
import { BellOff2 as BellOff2Source } from "reicon-react/icons/BellOff2";
import { BellRing as BellRingSource } from "reicon-react/icons/BellRing";
import { Blend as BlendSource } from "reicon-react/icons/Blend";
import { Bluetooth as BluetoothSource } from "reicon-react/icons/Bluetooth";
import { Bold as BoldSource } from "reicon-react/icons/Bold";
import { Bolt as BoltSource } from "reicon-react/icons/Bolt";
import { Book as BookSource } from "reicon-react/icons/Book";
import { BookBookmark as BookBookmarkSource } from "reicon-react/icons/BookBookmark";
import { Bookmark as BookmarkSource } from "reicon-react/icons/Bookmark";
import { BookmarkCheck as BookmarkCheckSource } from "reicon-react/icons/BookmarkCheck";
import { BookOpen as BookOpenSource } from "reicon-react/icons/BookOpen";
import { Box as BoxSource } from "reicon-react/icons/Box";
import { Box2 as Box2Source } from "reicon-react/icons/Box2";
import { BoxAdd as BoxAddSource } from "reicon-react/icons/BoxAdd";
import { BoxTick as BoxTickSource } from "reicon-react/icons/BoxTick";
import { BranchUp as BranchUpSource } from "reicon-react/icons/BranchUp";
import { Briefcase as BriefcaseSource } from "reicon-react/icons/Briefcase";
import { Briefcase2 as Briefcase2Source } from "reicon-react/icons/Briefcase2";
import { Broom as BroomSource } from "reicon-react/icons/Broom";
import { BrowserCode as BrowserCodeSource } from "reicon-react/icons/BrowserCode";
import { Bug as BugSource } from "reicon-react/icons/Bug";
import { Building as BuildingSource } from "reicon-react/icons/Building";
import { Buildings as BuildingsSource } from "reicon-react/icons/Buildings";
import { Bullhorn as BullhornSource } from "reicon-react/icons/Bullhorn";
import { Cake as CakeSource } from "reicon-react/icons/Cake";
import { Calculator as CalculatorSource } from "reicon-react/icons/Calculator";
import { Calendar as CalendarSource } from "reicon-react/icons/Calendar";
import { Calendar4 as Calendar4Source } from "reicon-react/icons/Calendar4";
import { CalendarCheck as CalendarCheckSource } from "reicon-react/icons/CalendarCheck";
import { CalendarDays as CalendarDaysSource } from "reicon-react/icons/CalendarDays";
import { CalendarPlus as CalendarPlusSource } from "reicon-react/icons/CalendarPlus";
import { CalendarSearch as CalendarSearchSource } from "reicon-react/icons/CalendarSearch";
import { CalendarX as CalendarXSource } from "reicon-react/icons/CalendarX";
import { Camera as CameraSource } from "reicon-react/icons/Camera";
import { Car as CarSource } from "reicon-react/icons/Car";
import { Chart2 as Chart2Source } from "reicon-react/icons/Chart2";
import { Chart4 as Chart4Source } from "reicon-react/icons/Chart4";
import { ChartBar as ChartBarSource } from "reicon-react/icons/ChartBar";
import { ChartBarTrendUp as ChartBarTrendUpSource } from "reicon-react/icons/ChartBarTrendUp";
import { ChartLine as ChartLineSource } from "reicon-react/icons/ChartLine";
import { ChartPie as ChartPieSource } from "reicon-react/icons/ChartPie";
import { ChatRound as ChatRoundSource } from "reicon-react/icons/ChatRound";
import { Check as CheckSource } from "reicon-react/icons/Check";
import { CheckCircle as CheckCircleSource } from "reicon-react/icons/CheckCircle";
import { Checklist as ChecklistSource } from "reicon-react/icons/Checklist";
import { CheckRead as CheckReadSource } from "reicon-react/icons/CheckRead";
import { CheckSquare as CheckSquareSource } from "reicon-react/icons/CheckSquare";
import { ChevronDown as ChevronDownSource } from "reicon-react/icons/ChevronDown";
import { ChevronExpandY as ChevronExpandYSource } from "reicon-react/icons/ChevronExpandY";
import { ChevronLeft as ChevronLeftSource } from "reicon-react/icons/ChevronLeft";
import { ChevronRight as ChevronRightSource } from "reicon-react/icons/ChevronRight";
import { ChevronUp as ChevronUpSource } from "reicon-react/icons/ChevronUp";
import { Clapperboard as ClapperboardSource } from "reicon-react/icons/Clapperboard";
import { Clipboard as ClipboardSource } from "reicon-react/icons/Clipboard";
import { ClipboardCheck as ClipboardCheckSource } from "reicon-react/icons/ClipboardCheck";
import { ClipboardList as ClipboardListSource } from "reicon-react/icons/ClipboardList";
import { Clock as ClockSource } from "reicon-react/icons/Clock";
import { CloudCheck as CloudCheckSource } from "reicon-react/icons/CloudCheck";
import { CloudDownload as CloudDownloadSource } from "reicon-react/icons/CloudDownload";
import { CloudUpload as CloudUploadSource } from "reicon-react/icons/CloudUpload";
import { Code as CodeSource } from "reicon-react/icons/Code";
import { CodeSquare as CodeSquareSource } from "reicon-react/icons/CodeSquare";
import { Coffee as CoffeeSource } from "reicon-react/icons/Coffee";
import { Coins as CoinsSource } from "reicon-react/icons/Coins";
import { Command as CommandSource } from "reicon-react/icons/Command";
import { Compass as CompassSource } from "reicon-react/icons/Compass";
import { Component as ComponentSource } from "reicon-react/icons/Component";
import { Component2 as Component2Source } from "reicon-react/icons/Component2";
import { Convertshape as ConvertshapeSource } from "reicon-react/icons/Convertshape";
import { Copy as CopySource } from "reicon-react/icons/Copy";
import { CourseDown as CourseDownSource } from "reicon-react/icons/CourseDown";
import { CourseUp as CourseUpSource } from "reicon-react/icons/CourseUp";
import { Cpu as CpuSource } from "reicon-react/icons/Cpu";
import { CreditCard as CreditCardSource } from "reicon-react/icons/CreditCard";
import { Crop as CropSource } from "reicon-react/icons/Crop";
import { Cursor as CursorSource } from "reicon-react/icons/Cursor";
import { CursorSquare as CursorSquareSource } from "reicon-react/icons/CursorSquare";
import { DarkLight as DarkLightSource } from "reicon-react/icons/DarkLight";
import { Database as DatabaseSource } from "reicon-react/icons/Database";
import { DiagramTree as DiagramTreeSource } from "reicon-react/icons/DiagramTree";
import { DocText as DocTextSource } from "reicon-react/icons/DocText";
import { DocumentCode as DocumentCodeSource } from "reicon-react/icons/DocumentCode";
import { DollarCircle as DollarCircleSource } from "reicon-react/icons/DollarCircle";
import { DollarSign as DollarSignSource } from "reicon-react/icons/DollarSign";
import { Download as DownloadSource } from "reicon-react/icons/Download";
import { Element as ElementSource } from "reicon-react/icons/Element";
import { Element2 as Element2Source } from "reicon-react/icons/Element2";
import { Element4 as Element4Source } from "reicon-react/icons/Element4";
import { Envelope as EnvelopeSource } from "reicon-react/icons/Envelope";
import { EnvelopeCheck as EnvelopeCheckSource } from "reicon-react/icons/EnvelopeCheck";
import { Eraser as EraserSource } from "reicon-react/icons/Eraser";
import { Export5 as Export5Source } from "reicon-react/icons/Export5";
import { Eye as EyeSource } from "reicon-react/icons/Eye";
import { EyeOff as EyeOffSource } from "reicon-react/icons/EyeOff";
import { FacePlus as FacePlusSource } from "reicon-react/icons/FacePlus";
import { FaceSmile as FaceSmileSource } from "reicon-react/icons/FaceSmile";
import { File as FileSource } from "reicon-react/icons/File";
import { FileCheck as FileCheckSource } from "reicon-react/icons/FileCheck";
import { FileContent as FileContentSource } from "reicon-react/icons/FileContent";
import { FileDown as FileDownSource } from "reicon-react/icons/FileDown";
import { FilePlus as FilePlusSource } from "reicon-react/icons/FilePlus";
import { Files as FilesSource } from "reicon-react/icons/Files";
import { FileText as FileTextSource } from "reicon-react/icons/FileText";
import { FileUp as FileUpSource } from "reicon-react/icons/FileUp";
import { FileZip as FileZipSource } from "reicon-react/icons/FileZip";
import { Film as FilmSource } from "reicon-react/icons/Film";
import { Filter as FilterSource } from "reicon-react/icons/Filter";
import { FilterAdd as FilterAddSource } from "reicon-react/icons/FilterAdd";
import { FilterRemove as FilterRemoveSource } from "reicon-react/icons/FilterRemove";
import { Fingerprint as FingerprintSource } from "reicon-react/icons/Fingerprint";
import { Flag as FlagSource } from "reicon-react/icons/Flag";
import { Flame as FlameSource } from "reicon-react/icons/Flame";
import { Flask as FlaskSource } from "reicon-react/icons/Flask";
import { FlipH as FlipHSource } from "reicon-react/icons/FlipH";
import { FlipV as FlipVSource } from "reicon-react/icons/FlipV";
import { Floppy2 as Floppy2Source } from "reicon-react/icons/Floppy2";
import { Folder as FolderSource } from "reicon-react/icons/Folder";
import { FolderLink as FolderLinkSource } from "reicon-react/icons/FolderLink";
import { FolderMove as FolderMoveSource } from "reicon-react/icons/FolderMove";
import { FolderOpen as FolderOpenSource } from "reicon-react/icons/FolderOpen";
import { FolderPlus as FolderPlusSource } from "reicon-react/icons/FolderPlus";
import { Forbidden2 as Forbidden2Source } from "reicon-react/icons/Forbidden2";
import { Forward as ForwardSource } from "reicon-react/icons/Forward";
import { Forward2 as Forward2Source } from "reicon-react/icons/Forward2";
import { Fuel as FuelSource } from "reicon-react/icons/Fuel";
import { FullscreenCircle as FullscreenCircleSource } from "reicon-react/icons/FullscreenCircle";
import { Gallery as GallerySource } from "reicon-react/icons/Gallery";
import { GallerySlash as GallerySlashSource } from "reicon-react/icons/GallerySlash";
import { Gauge as GaugeSource } from "reicon-react/icons/Gauge";
import { Globe as GlobeSource } from "reicon-react/icons/Globe";
import { Globe2 as Globe2Source } from "reicon-react/icons/Globe2";
import { Golf as GolfSource } from "reicon-react/icons/Golf";
import { Gps as GpsSource } from "reicon-react/icons/Gps";
import { GraduationCap as GraduationCapSource } from "reicon-react/icons/GraduationCap";
import { Graph as GraphSource } from "reicon-react/icons/Graph";
import { Grid as GridSource } from "reicon-react/icons/Grid";
import { Grid2 as Grid2Source } from "reicon-react/icons/Grid2";
import { Grid8 as Grid8Source } from "reicon-react/icons/Grid8";
import { Hand as HandSource } from "reicon-react/icons/Hand";
import { HandHeart as HandHeartSource } from "reicon-react/icons/HandHeart";
import { Hashtag as HashtagSource } from "reicon-react/icons/Hashtag";
import { Headphones as HeadphonesSource } from "reicon-react/icons/Headphones";
import { Heart as HeartSource } from "reicon-react/icons/Heart";
import { HeartPulse as HeartPulseSource } from "reicon-react/icons/HeartPulse";
import { HelpCircle as HelpCircleSource } from "reicon-react/icons/HelpCircle";
import { Hierarchy as HierarchySource } from "reicon-react/icons/Hierarchy";
import { Hierarchy2 as Hierarchy2Source } from "reicon-react/icons/Hierarchy2";
import { Hierarchy3 as Hierarchy3Source } from "reicon-react/icons/Hierarchy3";
import { History as HistorySource } from "reicon-react/icons/History";
import { Hospital as HospitalSource } from "reicon-react/icons/Hospital";
import { Hourglass as HourglassSource } from "reicon-react/icons/Hourglass";
import { House as HouseSource } from "reicon-react/icons/House";
import { Image as ImageSource } from "reicon-react/icons/Image";
import { ImagePlus as ImagePlusSource } from "reicon-react/icons/ImagePlus";
import { ImageUp as ImageUpSource } from "reicon-react/icons/ImageUp";
import { Inbox as InboxSource } from "reicon-react/icons/Inbox";
import { Industry as IndustrySource } from "reicon-react/icons/Industry";
import { InfoCircle as InfoCircleSource } from "reicon-react/icons/InfoCircle";
import { Italic as ItalicSource } from "reicon-react/icons/Italic";
import { Kanban as KanbanSource } from "reicon-react/icons/Kanban";
import { Key as KeySource } from "reicon-react/icons/Key";
import { Keyboard as KeyboardSource } from "reicon-react/icons/Keyboard";
import { KeySquare as KeySquareSource } from "reicon-react/icons/KeySquare";
import { Laptop as LaptopSource } from "reicon-react/icons/Laptop";
import { Layers as LayersSource } from "reicon-react/icons/Layers";
import { Layout as LayoutSource } from "reicon-react/icons/Layout";
import { Leaf as LeafSource } from "reicon-react/icons/Leaf";
import { Lifebuoy as LifebuoySource } from "reicon-react/icons/Lifebuoy";
import { Lightbulb as LightbulbSource } from "reicon-react/icons/Lightbulb";
import { Link as LinkSource } from "reicon-react/icons/Link";
import { Link2 as Link2Source } from "reicon-react/icons/Link2";
import { LinkBroken as LinkBrokenSource } from "reicon-react/icons/LinkBroken";
import { List3 as List3Source } from "reicon-react/icons/List3";
import { LocationTick as LocationTickSource } from "reicon-react/icons/LocationTick";
import { Lock as LockSource } from "reicon-react/icons/Lock";
import { LockKeyhole as LockKeyholeSource } from "reicon-react/icons/LockKeyhole";
import { Login as LoginSource } from "reicon-react/icons/Login";
import { Logout as LogoutSource } from "reicon-react/icons/Logout";
import { Map as MapSource } from "reicon-react/icons/Map";
import { MapArrowUp as MapArrowUpSource } from "reicon-react/icons/MapArrowUp";
import { MapPoint as MapPointSource } from "reicon-react/icons/MapPoint";
import { Maximize as MaximizeSource } from "reicon-react/icons/Maximize";
import { MemoPlus as MemoPlusSource } from "reicon-react/icons/MemoPlus";
import { Menu as MenuSource } from "reicon-react/icons/Menu";
import { Message as MessageSource } from "reicon-react/icons/Message";
import { MessageNotif as MessageNotifSource } from "reicon-react/icons/MessageNotif";
import { MessagePlus as MessagePlusSource } from "reicon-react/icons/MessagePlus";
import { MessageQuestion as MessageQuestionSource } from "reicon-react/icons/MessageQuestion";
import { Messages4 as Messages4Source } from "reicon-react/icons/Messages4";
import { MessageText2 as MessageText2Source } from "reicon-react/icons/MessageText2";
import { MessageX as MessageXSource } from "reicon-react/icons/MessageX";
import { Microphone as MicrophoneSource } from "reicon-react/icons/Microphone";
import { Minimize as MinimizeSource } from "reicon-react/icons/Minimize";
import { Minus as MinusSource } from "reicon-react/icons/Minus";
import { MinusCircle as MinusCircleSource } from "reicon-react/icons/MinusCircle";
import { Mobile as MobileSource } from "reicon-react/icons/Mobile";
import { Monitor as MonitorSource } from "reicon-react/icons/Monitor";
import { MonitorPhone as MonitorPhoneSource } from "reicon-react/icons/MonitorPhone";
import { Moon as MoonSource } from "reicon-react/icons/Moon";
import { MoreH as MoreHSource } from "reicon-react/icons/MoreH";
import { Music as MusicSource } from "reicon-react/icons/Music";
import { MusicNotes as MusicNotesSource } from "reicon-react/icons/MusicNotes";
import { MusicPlaylist as MusicPlaylistSource } from "reicon-react/icons/MusicPlaylist";
import { Nodes as NodesSource } from "reicon-react/icons/Nodes";
import { ObjectScan as ObjectScanSource } from "reicon-react/icons/ObjectScan";
import { OrderedList as OrderedListSource } from "reicon-react/icons/OrderedList";
import { Package as PackageSource } from "reicon-react/icons/Package";
import { Palette as PaletteSource } from "reicon-react/icons/Palette";
import { Paperclip as PaperclipSource } from "reicon-react/icons/Paperclip";
import { Pause as PauseSource } from "reicon-react/icons/Pause";
import { PauseCircle as PauseCircleSource } from "reicon-react/icons/PauseCircle";
import { Pen as PenSource } from "reicon-react/icons/Pen";
import { PenLine as PenLineSource } from "reicon-react/icons/PenLine";
import { PenSquare as PenSquareSource } from "reicon-react/icons/PenSquare";
import { PenTool as PenToolSource } from "reicon-react/icons/PenTool";
import { Personalcard as PersonalcardSource } from "reicon-react/icons/Personalcard";
import { Phone as PhoneSource } from "reicon-react/icons/Phone";
import { Pin as PinSource } from "reicon-react/icons/Pin";
import { PinOff as PinOffSource } from "reicon-react/icons/PinOff";
import { Pipette as PipetteSource } from "reicon-react/icons/Pipette";
import { Plane as PlaneSource } from "reicon-react/icons/Plane";
import { Play as PlaySource } from "reicon-react/icons/Play";
import { PlayCircle as PlayCircleSource } from "reicon-react/icons/PlayCircle";
import { Plug as PlugSource } from "reicon-react/icons/Plug";
import { Plug2 as Plug2Source } from "reicon-react/icons/Plug2";
import { PlugCircle as PlugCircleSource } from "reicon-react/icons/PlugCircle";
import { Plus as PlusSource } from "reicon-react/icons/Plus";
import { PlusCircle as PlusCircleSource } from "reicon-react/icons/PlusCircle";
import { Power as PowerSource } from "reicon-react/icons/Power";
import { Presentation as PresentationSource } from "reicon-react/icons/Presentation";
import { Printer as PrinterSource } from "reicon-react/icons/Printer";
import { Programming as ProgrammingSource } from "reicon-react/icons/Programming";
import { ProgrammingArrow as ProgrammingArrowSource } from "reicon-react/icons/ProgrammingArrow";
import { Puzzle as PuzzleSource } from "reicon-react/icons/Puzzle";
import { Qr as QrSource } from "reicon-react/icons/Qr";
import { QuoteUp as QuoteUpSource } from "reicon-react/icons/QuoteUp";
import { Radar as RadarSource } from "reicon-react/icons/Radar";
import { Ram as RamSource } from "reicon-react/icons/Ram";
import { Receipt as ReceiptSource } from "reicon-react/icons/Receipt";
import { ReceiptSearch as ReceiptSearchSource } from "reicon-react/icons/ReceiptSearch";
import { ReceiptText as ReceiptTextSource } from "reicon-react/icons/ReceiptText";
import { Redo as RedoSource } from "reicon-react/icons/Redo";
import { Refresh as RefreshSource } from "reicon-react/icons/Refresh";
import { Repeat as RepeatSource } from "reicon-react/icons/Repeat";
import { Repeat3 as Repeat3Source } from "reicon-react/icons/Repeat3";
import { Reply as ReplySource } from "reicon-react/icons/Reply";
import { Reply2 as Reply2Source } from "reicon-react/icons/Reply2";
import { Rocket as RocketSource } from "reicon-react/icons/Rocket";
import { RotateLeft as RotateLeftSource } from "reicon-react/icons/RotateLeft";
import { RotateRight as RotateRightSource } from "reicon-react/icons/RotateRight";
import { RouteTrack as RouteTrackSource } from "reicon-react/icons/RouteTrack";
import { Routing as RoutingSource } from "reicon-react/icons/Routing";
import { RowHorizontal as RowHorizontalSource } from "reicon-react/icons/RowHorizontal";
import { Scan as ScanSource } from "reicon-react/icons/Scan";
import { Scanner as ScannerSource } from "reicon-react/icons/Scanner";
import { Scissors as ScissorsSource } from "reicon-react/icons/Scissors";
import { Search as SearchSource } from "reicon-react/icons/Search";
import { SearchStatus as SearchStatusSource } from "reicon-react/icons/SearchStatus";
import { SearchZoomIn as SearchZoomInSource } from "reicon-react/icons/SearchZoomIn";
import { SearchZoomOut as SearchZoomOutSource } from "reicon-react/icons/SearchZoomOut";
import { Send as SendSource } from "reicon-react/icons/Send";
import { Server as ServerSource } from "reicon-react/icons/Server";
import { Settings as SettingsSource } from "reicon-react/icons/Settings";
import { Settings2 as Settings2Source } from "reicon-react/icons/Settings2";
import { Share as ShareSource } from "reicon-react/icons/Share";
import { Shield as ShieldSource } from "reicon-react/icons/Shield";
import { Shield2 as Shield2Source } from "reicon-react/icons/Shield2";
import { ShieldAlert as ShieldAlertSource } from "reicon-react/icons/ShieldAlert";
import { ShieldCheck as ShieldCheckSource } from "reicon-react/icons/ShieldCheck";
import { ShieldOff as ShieldOffSource } from "reicon-react/icons/ShieldOff";
import { ShoppingBag as ShoppingBagSource } from "reicon-react/icons/ShoppingBag";
import { ShoppingCart as ShoppingCartSource } from "reicon-react/icons/ShoppingCart";
import { SidebarBottom as SidebarBottomSource } from "reicon-react/icons/SidebarBottom";
import { SidebarLeft as SidebarLeftSource } from "reicon-react/icons/SidebarLeft";
import { SidebarLeft2 as SidebarLeft2Source } from "reicon-react/icons/SidebarLeft2";
import { SidebarRight as SidebarRightSource } from "reicon-react/icons/SidebarRight";
import { SidebarRight2 as SidebarRight2Source } from "reicon-react/icons/SidebarRight2";
import { SignalStream as SignalStreamSource } from "reicon-react/icons/SignalStream";
import { Signpost as SignpostSource } from "reicon-react/icons/Signpost";
import { Simcard as SimcardSource } from "reicon-react/icons/Simcard";
import { Siren as SirenSource } from "reicon-react/icons/Siren";
import { Sitemap as SitemapSource } from "reicon-react/icons/Sitemap";
import { SkipNext as SkipNextSource } from "reicon-react/icons/SkipNext";
import { SkipPrev as SkipPrevSource } from "reicon-react/icons/SkipPrev";
import { SlashCircle as SlashCircleSource } from "reicon-react/icons/SlashCircle";
import { Sort3 as Sort3Source } from "reicon-react/icons/Sort3";
import { SortAsc as SortAscSource } from "reicon-react/icons/SortAsc";
import { SortDesc as SortDescSource } from "reicon-react/icons/SortDesc";
import { Soundwave as SoundwaveSource } from "reicon-react/icons/Soundwave";
import { Sparkles as SparklesSource } from "reicon-react/icons/Sparkles";
import { Squares as SquaresSource } from "reicon-react/icons/Squares";
import { Star as StarSource } from "reicon-react/icons/Star";
import { Stethoscope as StethoscopeSource } from "reicon-react/icons/Stethoscope";
import { Stickynote as StickynoteSource } from "reicon-react/icons/Stickynote";
import { StopCircle as StopCircleSource } from "reicon-react/icons/StopCircle";
import { StopwatchOff as StopwatchOffSource } from "reicon-react/icons/StopwatchOff";
import { Store as StoreSource } from "reicon-react/icons/Store";
import { Sun as SunSource } from "reicon-react/icons/Sun";
import { Tablet as TabletSource } from "reicon-react/icons/Tablet";
import { Tag as TagSource } from "reicon-react/icons/Tag";
import { Tags as TagsSource } from "reicon-react/icons/Tags";
import { Target as TargetSource } from "reicon-react/icons/Target";
import { Task as TaskSource } from "reicon-react/icons/Task";
import { TerminalSquare as TerminalSquareSource } from "reicon-react/icons/TerminalSquare";
import { TestTube2 as TestTube2Source } from "reicon-react/icons/TestTube2";
import { Text as TextSource } from "reicon-react/icons/Text";
import { TextalignCenter as TextalignCenterSource } from "reicon-react/icons/TextalignCenter";
import { TextalignJustifycenter as TextalignJustifycenterSource } from "reicon-react/icons/TextalignJustifycenter";
import { TextalignLeft as TextalignLeftSource } from "reicon-react/icons/TextalignLeft";
import { TextalignRight as TextalignRightSource } from "reicon-react/icons/TextalignRight";
import { TextHighlight as TextHighlightSource } from "reicon-react/icons/TextHighlight";
import { TextX as TextXSource } from "reicon-react/icons/TextX";
import { ThumbsDown as ThumbsDownSource } from "reicon-react/icons/ThumbsDown";
import { ThumbsUp as ThumbsUpSource } from "reicon-react/icons/ThumbsUp";
import { Thumbtack as ThumbtackSource } from "reicon-react/icons/Thumbtack";
import { Ticket as TicketSource } from "reicon-react/icons/Ticket";
import { TicketPercent as TicketPercentSource } from "reicon-react/icons/TicketPercent";
import { TimeBack as TimeBackSource } from "reicon-react/icons/TimeBack";
import { Timer as TimerSource } from "reicon-react/icons/Timer";
import { Tower as TowerSource } from "reicon-react/icons/Tower";
import { TransferH as TransferHSource } from "reicon-react/icons/TransferH";
import { Trash2 as Trash2Source } from "reicon-react/icons/Trash2";
import { Triangle as TriangleSource } from "reicon-react/icons/Triangle";
import { Trophy as TrophySource } from "reicon-react/icons/Trophy";
import { Truck as TruckSource } from "reicon-react/icons/Truck";
import { Tuning2 as Tuning2Source } from "reicon-react/icons/Tuning2";
import { Tuning4 as Tuning4Source } from "reicon-react/icons/Tuning4";
import { Underline as UnderlineSource } from "reicon-react/icons/Underline";
import { Undo as UndoSource } from "reicon-react/icons/Undo";
import { Unlock as UnlockSource } from "reicon-react/icons/Unlock";
import { Upload as UploadSource } from "reicon-react/icons/Upload";
import { User as UserSource } from "reicon-react/icons/User";
import { UserAdd as UserAddSource } from "reicon-react/icons/UserAdd";
import { UserCheck as UserCheckSource } from "reicon-react/icons/UserCheck";
import { UserCircle as UserCircleSource } from "reicon-react/icons/UserCircle";
import { UserEdit as UserEditSource } from "reicon-react/icons/UserEdit";
import { UserMinus as UserMinusSource } from "reicon-react/icons/UserMinus";
import { Users as UsersSource } from "reicon-react/icons/Users";
import { UserSearch as UserSearchSource } from "reicon-react/icons/UserSearch";
import { UserX as UserXSource } from "reicon-react/icons/UserX";
import { VectorSquare as VectorSquareSource } from "reicon-react/icons/VectorSquare";
import { Verified as VerifiedSource } from "reicon-react/icons/Verified";
import { Video as VideoSource } from "reicon-react/icons/Video";
import { VideoOff as VideoOffSource } from "reicon-react/icons/VideoOff";
import { Volleyball as VolleyballSource } from "reicon-react/icons/Volleyball";
import { VolumeHigh as VolumeHighSource } from "reicon-react/icons/VolumeHigh";
import { VolumeOff as VolumeOffSource } from "reicon-react/icons/VolumeOff";
import { VolumeX as VolumeXSource } from "reicon-react/icons/VolumeX";
import { Wallet as WalletSource } from "reicon-react/icons/Wallet";
import { WavePulse as WavePulseSource } from "reicon-react/icons/WavePulse";
import { Widget as WidgetSource } from "reicon-react/icons/Widget";
import { Wifi as WifiSource } from "reicon-react/icons/Wifi";
import { WifiOff as WifiOffSource } from "reicon-react/icons/WifiOff";
import { Window2 as Window2Source } from "reicon-react/icons/Window2";
import { X as XSource } from "reicon-react/icons/X";
import { XCircle as XCircleSource } from "reicon-react/icons/XCircle";

export type { IconComponent, IconProps, IconWeight } from "reicon-react/createIcon";
/** Lucide type names, kept for code written against `lucide-react`. */
export type {
  IconComponent as LucideIcon,
  IconProps as LucideProps,
} from "reicon-react/createIcon";

const strokeWidth = 1.75;

/**
 * Hides an icon from assistive technology unless the caller names it, as Lucide does, and sets
 * the outline weight. Filled glyphs keep their shape: a stroke would only swell them.
 */
function decorative(Glyph: IconComponent): IconComponent {
  return forwardRef<SVGSVGElement, IconProps>((props, ref) => {
    const named = Object.keys(props).some(
      (prop) => prop.startsWith("aria-") || prop === "role" || prop === "title"
    );
    return createElement(Glyph, {
      ...(named ? null : { "aria-hidden": true }),
      ...(props.weight === "Filled" ? null : { strokeWidth }),
      ...props,
      ref,
    });
  });
}

export const CopyPlus = /*#__PURE__*/ decorative(AdditemSource);
export { CopyPlus as CopyPlusIcon };
export const BookUser = /*#__PURE__*/ decorative(AddressBookSource);
export { BookUser as BookUserIcon };
export const PlaneTakeoff = /*#__PURE__*/ decorative(AirplaneSource);
export { PlaneTakeoff as PlaneTakeoffIcon };
export const ClockCheck = /*#__PURE__*/ decorative(AlarmCheckSource);
export { ClockCheck as ClockCheckIcon };
export const OctagonAlert = /*#__PURE__*/ decorative(AlertSource);
export { OctagonAlert as OctagonAlertIcon };
export const AlertCircle = /*#__PURE__*/ decorative(AlertCircleSource);
export {
  AlertCircle as AlertCircleIcon,
  AlertCircle as CircleAlert,
  AlertCircle as CircleAlertIcon,
};
export const AlertTriangle = /*#__PURE__*/ decorative(AlertTriangleSource);
export {
  AlertTriangle as AlertTriangleIcon,
  AlertTriangle as TriangleAlert,
  AlertTriangle as TriangleAlertIcon,
};
export const SeparatorHorizontal = /*#__PURE__*/ decorative(AlignVSpacingSource);
export { SeparatorHorizontal as SeparatorHorizontalIcon };
export const Anchor = /*#__PURE__*/ decorative(AnchorSource);
export { Anchor as AnchorIcon };
export const ChevronFirst = /*#__PURE__*/ decorative(AnglesLeftSource);
export { ChevronFirst as ChevronFirstIcon };
export const ChevronLast = /*#__PURE__*/ decorative(AnglesRightSource);
export {
  ChevronLast as ChevronLastIcon,
  ChevronLast as ChevronsRight,
  ChevronLast as ChevronsRightIcon,
};
export const Archive = /*#__PURE__*/ decorative(ArchiveSource);
export { Archive as ArchiveIcon };
export const ArchiveRestore = /*#__PURE__*/ decorative(ArchiveUpSource);
export { ArchiveRestore as ArchiveRestoreIcon };
export const ArrowLeftRight = /*#__PURE__*/ decorative(Arrow2Source);
export {
  ArrowLeftRight as ArrowLeftRightIcon,
  ArrowLeftRight as ArrowRightLeft,
  ArrowLeftRight as ArrowRightLeftIcon,
};
export const ArrowDownUp = /*#__PURE__*/ decorative(Arrow3Source);
export {
  ArrowDownUp as ArrowDownUpIcon,
  ArrowDownUp as ArrowUpDown,
  ArrowDownUp as ArrowUpDownIcon,
};
export const ArrowDown = /*#__PURE__*/ decorative(ArrowDownSource);
export { ArrowDown as ArrowDownIcon };
export const ArrowDownRight = /*#__PURE__*/ decorative(ArrowDownRightSource);
export { ArrowDownRight as ArrowDownRightIcon };
export const ArrowLeft = /*#__PURE__*/ decorative(ArrowLeftSource);
export { ArrowLeft as ArrowLeftIcon };
export const ArrowRight = /*#__PURE__*/ decorative(ArrowRightSource);
export { ArrowRight as ArrowRightIcon };
export const MoveRight = /*#__PURE__*/ decorative(ArrowRight3Source);
export { MoveRight as MoveRightIcon };
export const ArrowUp = /*#__PURE__*/ decorative(ArrowUpSource);
export { ArrowUp as ArrowUpIcon };
export const ArrowUpRight = /*#__PURE__*/ decorative(ArrowUpRightSource);
export { ArrowUpRight as ArrowUpRightIcon };
export const AtSign = /*#__PURE__*/ decorative(AtSignSource);
export { AtSign as AtSignIcon };
export const Ban = /*#__PURE__*/ decorative(BanSource);
export { Ban as BanIcon };
export const Landmark = /*#__PURE__*/ decorative(BankSource);
export { Landmark as LandmarkIcon };
export const Banknote = /*#__PURE__*/ decorative(BanknoteSource);
export { Banknote as BanknoteIcon };
export const BatteryCharging = /*#__PURE__*/ decorative(BatteryChargingSource);
export { BatteryCharging as BatteryChargingIcon };
export const Bell = /*#__PURE__*/ decorative(BellSource);
export { Bell as BellIcon };
export const BellOff = /*#__PURE__*/ decorative(BellOff2Source);
export { BellOff as BellOffIcon };
export const BellRing = /*#__PURE__*/ decorative(BellRingSource);
export { BellRing as BellRingIcon };
export const Combine = /*#__PURE__*/ decorative(BlendSource);
export { Combine as CombineIcon };
export const Bluetooth = /*#__PURE__*/ decorative(BluetoothSource);
export { Bluetooth as BluetoothIcon };
export const Bold = /*#__PURE__*/ decorative(BoldSource);
export { Bold as BoldIcon };
export const Zap = /*#__PURE__*/ decorative(BoltSource);
export { Zap as ZapIcon };
export const Book = /*#__PURE__*/ decorative(BookSource);
export { Book as BookIcon };
export const BookMarked = /*#__PURE__*/ decorative(BookBookmarkSource);
export { BookMarked as BookMarkedIcon };
export const Bookmark = /*#__PURE__*/ decorative(BookmarkSource);
export { Bookmark as BookmarkIcon };
export const BookmarkCheck = /*#__PURE__*/ decorative(BookmarkCheckSource);
export { BookmarkCheck as BookmarkCheckIcon };
export const BookOpen = /*#__PURE__*/ decorative(BookOpenSource);
export { BookOpen as BookOpenIcon, BookOpen as BookOpenText, BookOpen as BookOpenTextIcon };
export const Box = /*#__PURE__*/ decorative(BoxSource);
export { Box as BoxIcon };
export const Boxes = /*#__PURE__*/ decorative(Box2Source);
export { Boxes as BoxesIcon };
export const PackagePlus = /*#__PURE__*/ decorative(BoxAddSource);
export { PackagePlus as PackagePlusIcon };
export const PackageCheck = /*#__PURE__*/ decorative(BoxTickSource);
export { PackageCheck as PackageCheckIcon };
export const Split = /*#__PURE__*/ decorative(BranchUpSource);
export { Split as SplitIcon };
export const Briefcase = /*#__PURE__*/ decorative(BriefcaseSource);
export { Briefcase as BriefcaseIcon };
export const BriefcaseBusiness = /*#__PURE__*/ decorative(Briefcase2Source);
export { BriefcaseBusiness as BriefcaseBusinessIcon };
export const BrushCleaning = /*#__PURE__*/ decorative(BroomSource);
export { BrushCleaning as BrushCleaningIcon };
export const Github = /*#__PURE__*/ decorative(BrowserCodeSource);
export { Github as GithubIcon };
export const Bug = /*#__PURE__*/ decorative(BugSource);
export { Bug as BugIcon };
export const Building = /*#__PURE__*/ decorative(BuildingSource);
export { Building as BuildingIcon };
export const Building2 = /*#__PURE__*/ decorative(BuildingsSource);
export { Building2 as Building2Icon };
export const Megaphone = /*#__PURE__*/ decorative(BullhornSource);
export { Megaphone as MegaphoneIcon };
export const Cake = /*#__PURE__*/ decorative(CakeSource);
export { Cake as CakeIcon };
export const Calculator = /*#__PURE__*/ decorative(CalculatorSource);
export { Calculator as CalculatorIcon };
export const Calendar = /*#__PURE__*/ decorative(CalendarSource);
export { Calendar as CalendarIcon };
export const CalendarRange = /*#__PURE__*/ decorative(Calendar4Source);
export { CalendarRange as CalendarRangeIcon };
export const CalendarCheck = /*#__PURE__*/ decorative(CalendarCheckSource);
export { CalendarCheck as CalendarCheckIcon };
export const CalendarDays = /*#__PURE__*/ decorative(CalendarDaysSource);
export { CalendarDays as CalendarDaysIcon };
export const CalendarPlus = /*#__PURE__*/ decorative(CalendarPlusSource);
export { CalendarPlus as CalendarPlusIcon };
export const CalendarSearch = /*#__PURE__*/ decorative(CalendarSearchSource);
export { CalendarSearch as CalendarSearchIcon };
export const CalendarOff = /*#__PURE__*/ decorative(CalendarXSource);
export { CalendarOff as CalendarOffIcon, CalendarOff as CalendarX, CalendarOff as CalendarXIcon };
export const Camera = /*#__PURE__*/ decorative(CameraSource);
export { Camera as CameraIcon };
export const Car = /*#__PURE__*/ decorative(CarSource);
export { Car as CarIcon };
export const BarChart = /*#__PURE__*/ decorative(Chart2Source);
export {
  BarChart as BarChartIcon,
  BarChart as BarChart2,
  BarChart as BarChart2Icon,
  BarChart as ChartNoAxesColumn,
  BarChart as ChartNoAxesColumnIcon,
};
export const ChartNoAxesColumnDecreasing = /*#__PURE__*/ decorative(Chart4Source);
export { ChartNoAxesColumnDecreasing as ChartNoAxesColumnDecreasingIcon };
export const BarChart3 = /*#__PURE__*/ decorative(ChartBarSource);
export {
  BarChart3 as BarChart3Icon,
  BarChart3 as ChartBar,
  BarChart3 as ChartBarIcon,
  BarChart3 as ChartColumn,
  BarChart3 as ChartColumnIcon,
};
export const ChartNoAxesCombined = /*#__PURE__*/ decorative(ChartBarTrendUpSource);
export { ChartNoAxesCombined as ChartNoAxesCombinedIcon };
export const ChartLine = /*#__PURE__*/ decorative(ChartLineSource);
export { ChartLine as ChartLineIcon };
export const ChartPie = /*#__PURE__*/ decorative(ChartPieSource);
export { ChartPie as ChartPieIcon, ChartPie as PieChart, ChartPie as PieChartIcon };
export const MessageCircle = /*#__PURE__*/ decorative(ChatRoundSource);
export { MessageCircle as MessageCircleIcon };
export const Check = /*#__PURE__*/ decorative(CheckSource);
export { Check as CheckIcon };
export const CheckCircle = /*#__PURE__*/ decorative(CheckCircleSource);
export {
  CheckCircle as CheckCircleIcon,
  CheckCircle as CheckCircle2,
  CheckCircle as CheckCircle2Icon,
  CheckCircle as CircleCheck,
  CheckCircle as CircleCheckIcon,
  CheckCircle as CircleCheckBig,
  CheckCircle as CircleCheckBigIcon,
};
export const ListChecks = /*#__PURE__*/ decorative(ChecklistSource);
export { ListChecks as ListChecksIcon };
export const CheckCheck = /*#__PURE__*/ decorative(CheckReadSource);
export { CheckCheck as CheckCheckIcon };
export const CheckSquare = /*#__PURE__*/ decorative(CheckSquareSource);
export {
  CheckSquare as CheckSquareIcon,
  CheckSquare as SquareCheck,
  CheckSquare as SquareCheckIcon,
};
export const ChevronDown = /*#__PURE__*/ decorative(ChevronDownSource);
export { ChevronDown as ChevronDownIcon };
export const ChevronsUpDown = /*#__PURE__*/ decorative(ChevronExpandYSource);
export { ChevronsUpDown as ChevronsUpDownIcon };
export const ChevronLeft = /*#__PURE__*/ decorative(ChevronLeftSource);
export { ChevronLeft as ChevronLeftIcon };
export const ChevronRight = /*#__PURE__*/ decorative(ChevronRightSource);
export { ChevronRight as ChevronRightIcon };
export const ChevronUp = /*#__PURE__*/ decorative(ChevronUpSource);
export { ChevronUp as ChevronUpIcon };
export const Clapperboard = /*#__PURE__*/ decorative(ClapperboardSource);
export {
  Clapperboard as ClapperboardIcon,
  Clapperboard as FileVideo,
  Clapperboard as FileVideoIcon,
};
export const Clipboard = /*#__PURE__*/ decorative(ClipboardSource);
export { Clipboard as ClipboardIcon };
export const ClipboardCheck = /*#__PURE__*/ decorative(ClipboardCheckSource);
export { ClipboardCheck as ClipboardCheckIcon };
export const ClipboardList = /*#__PURE__*/ decorative(ClipboardListSource);
export { ClipboardList as ClipboardListIcon };
export const Clock = /*#__PURE__*/ decorative(ClockSource);
export { Clock as ClockIcon, Clock as Clock3, Clock as Clock3Icon };
export const CloudCheck = /*#__PURE__*/ decorative(CloudCheckSource);
export { CloudCheck as CloudCheckIcon };
export const CloudDownload = /*#__PURE__*/ decorative(CloudDownloadSource);
export { CloudDownload as CloudDownloadIcon };
export const CloudUpload = /*#__PURE__*/ decorative(CloudUploadSource);
export {
  CloudUpload as CloudUploadIcon,
  CloudUpload as UploadCloud,
  CloudUpload as UploadCloudIcon,
};
export const Code = /*#__PURE__*/ decorative(CodeSource);
export { Code as CodeIcon, Code as Code2, Code as Code2Icon, Code as CodeXml, Code as CodeXmlIcon };
export const SquareCode = /*#__PURE__*/ decorative(CodeSquareSource);
export { SquareCode as SquareCodeIcon };
export const Coffee = /*#__PURE__*/ decorative(CoffeeSource);
export { Coffee as CoffeeIcon };
export const Coins = /*#__PURE__*/ decorative(CoinsSource);
export { Coins as CoinsIcon };
export const Command = /*#__PURE__*/ decorative(CommandSource);
export { Command as CommandIcon };
export const Compass = /*#__PURE__*/ decorative(CompassSource);
export { Compass as CompassIcon };
export const Component = /*#__PURE__*/ decorative(ComponentSource);
export { Component as ComponentIcon };
export const Diamond = /*#__PURE__*/ decorative(Component2Source);
export { Diamond as DiamondIcon };
export const Replace = /*#__PURE__*/ decorative(ConvertshapeSource);
export { Replace as ReplaceIcon };
export const Copy = /*#__PURE__*/ decorative(CopySource);
export { Copy as CopyIcon };
export const TrendingDown = /*#__PURE__*/ decorative(CourseDownSource);
export { TrendingDown as TrendingDownIcon };
export const TrendingUp = /*#__PURE__*/ decorative(CourseUpSource);
export { TrendingUp as TrendingUpIcon };
export const Cpu = /*#__PURE__*/ decorative(CpuSource);
export { Cpu as CpuIcon };
export const CreditCard = /*#__PURE__*/ decorative(CreditCardSource);
export { CreditCard as CreditCardIcon };
export const Crop = /*#__PURE__*/ decorative(CropSource);
export { Crop as CropIcon };
export const MousePointer2 = /*#__PURE__*/ decorative(CursorSource);
export {
  MousePointer2 as MousePointer2Icon,
  MousePointer2 as MousePointerClick,
  MousePointer2 as MousePointerClickIcon,
};
export const SquareDashedMousePointer = /*#__PURE__*/ decorative(CursorSquareSource);
export { SquareDashedMousePointer as SquareDashedMousePointerIcon };
export const SunMoon = /*#__PURE__*/ decorative(DarkLightSource);
export { SunMoon as SunMoonIcon };
export const Database = /*#__PURE__*/ decorative(DatabaseSource);
export { Database as DatabaseIcon, Database as DatabaseZap, Database as DatabaseZapIcon };
export const ListTree = /*#__PURE__*/ decorative(DiagramTreeSource);
export { ListTree as ListTreeIcon };
export const ScrollText = /*#__PURE__*/ decorative(DocTextSource);
export { ScrollText as ScrollTextIcon };
export const FileBracesCorner = /*#__PURE__*/ decorative(DocumentCodeSource);
export {
  FileBracesCorner as FileBracesCornerIcon,
  FileBracesCorner as FileCode,
  FileBracesCorner as FileCodeIcon,
  FileBracesCorner as FileCodeCorner,
  FileBracesCorner as FileCodeCornerIcon,
  FileBracesCorner as FileJson,
  FileBracesCorner as FileJsonIcon,
};
export const CircleDollarSign = /*#__PURE__*/ decorative(DollarCircleSource);
export { CircleDollarSign as CircleDollarSignIcon };
export const DollarSign = /*#__PURE__*/ decorative(DollarSignSource);
export { DollarSign as DollarSignIcon };
export const Download = /*#__PURE__*/ decorative(DownloadSource);
export { Download as DownloadIcon };
export const LayoutDashboard = /*#__PURE__*/ decorative(ElementSource);
export { LayoutDashboard as LayoutDashboardIcon };
export const LayoutPanelLeft = /*#__PURE__*/ decorative(Element2Source);
export { LayoutPanelLeft as LayoutPanelLeftIcon };
export const LayoutTemplate = /*#__PURE__*/ decorative(Element4Source);
export { LayoutTemplate as LayoutTemplateIcon };
export const Mail = /*#__PURE__*/ decorative(EnvelopeSource);
export { Mail as MailIcon };
export const MailCheck = /*#__PURE__*/ decorative(EnvelopeCheckSource);
export { MailCheck as MailCheckIcon };
export const Eraser = /*#__PURE__*/ decorative(EraserSource);
export { Eraser as EraserIcon };
export const ExternalLink = /*#__PURE__*/ decorative(Export5Source);
export { ExternalLink as ExternalLinkIcon };
export const Eye = /*#__PURE__*/ decorative(EyeSource);
export { Eye as EyeIcon };
export const EyeOff = /*#__PURE__*/ decorative(EyeOffSource);
export { EyeOff as EyeOffIcon };
export const SmilePlus = /*#__PURE__*/ decorative(FacePlusSource);
export { SmilePlus as SmilePlusIcon };
export const Smile = /*#__PURE__*/ decorative(FaceSmileSource);
export { Smile as SmileIcon };
export const File = /*#__PURE__*/ decorative(FileSource);
export { File as FileIcon };
export const FileCheck = /*#__PURE__*/ decorative(FileCheckSource);
export { FileCheck as FileCheckIcon, FileCheck as FileCheck2, FileCheck as FileCheck2Icon };
export const FileSpreadsheet = /*#__PURE__*/ decorative(FileContentSource);
export { FileSpreadsheet as FileSpreadsheetIcon };
export const FileDown = /*#__PURE__*/ decorative(FileDownSource);
export { FileDown as FileDownIcon };
export const FilePlus = /*#__PURE__*/ decorative(FilePlusSource);
export { FilePlus as FilePlusIcon, FilePlus as FilePlus2, FilePlus as FilePlus2Icon };
export const Files = /*#__PURE__*/ decorative(FilesSource);
export { Files as FilesIcon };
export const FileText = /*#__PURE__*/ decorative(FileTextSource);
export { FileText as FileTextIcon };
export const FileUp = /*#__PURE__*/ decorative(FileUpSource);
export { FileUp as FileUpIcon };
export const FileArchive = /*#__PURE__*/ decorative(FileZipSource);
export { FileArchive as FileArchiveIcon };
export const Film = /*#__PURE__*/ decorative(FilmSource);
export { Film as FilmIcon };
export const Filter = /*#__PURE__*/ decorative(FilterSource);
export { Filter as FilterIcon, Filter as Funnel, Filter as FunnelIcon };
export const ListFilterPlus = /*#__PURE__*/ decorative(FilterAddSource);
export { ListFilterPlus as ListFilterPlusIcon };
export const FunnelX = /*#__PURE__*/ decorative(FilterRemoveSource);
export { FunnelX as FunnelXIcon };
export const Fingerprint = /*#__PURE__*/ decorative(FingerprintSource);
export {
  Fingerprint as FingerprintIcon,
  Fingerprint as FingerprintPattern,
  Fingerprint as FingerprintPatternIcon,
};
export const Flag = /*#__PURE__*/ decorative(FlagSource);
export { Flag as FlagIcon };
export const Flame = /*#__PURE__*/ decorative(FlameSource);
export { Flame as FlameIcon };
export const FlaskConical = /*#__PURE__*/ decorative(FlaskSource);
export { FlaskConical as FlaskConicalIcon };
export const FlipHorizontal = /*#__PURE__*/ decorative(FlipHSource);
export { FlipHorizontal as FlipHorizontalIcon };
export const FlipVertical = /*#__PURE__*/ decorative(FlipVSource);
export { FlipVertical as FlipVerticalIcon };
export const Save = /*#__PURE__*/ decorative(Floppy2Source);
export { Save as SaveIcon };
export const Folder = /*#__PURE__*/ decorative(FolderSource);
export { Folder as FolderIcon };
export const FolderGit2 = /*#__PURE__*/ decorative(FolderLinkSource);
export { FolderGit2 as FolderGit2Icon };
export const FolderInput = /*#__PURE__*/ decorative(FolderMoveSource);
export { FolderInput as FolderInputIcon };
export const FolderOpen = /*#__PURE__*/ decorative(FolderOpenSource);
export { FolderOpen as FolderOpenIcon };
export const FolderPlus = /*#__PURE__*/ decorative(FolderPlusSource);
export { FolderPlus as FolderPlusIcon };
export const OctagonX = /*#__PURE__*/ decorative(Forbidden2Source);
export { OctagonX as OctagonXIcon };
export const CornerUpRight = /*#__PURE__*/ decorative(ForwardSource);
export { CornerUpRight as CornerUpRightIcon };
export const CornerDownRight = /*#__PURE__*/ decorative(Forward2Source);
export { CornerDownRight as CornerDownRightIcon };
export const Fuel = /*#__PURE__*/ decorative(FuelSource);
export { Fuel as FuelIcon };
export const Focus = /*#__PURE__*/ decorative(FullscreenCircleSource);
export { Focus as FocusIcon };
export const FileImage = /*#__PURE__*/ decorative(GallerySource);
export { FileImage as FileImageIcon };
export const ImageOff = /*#__PURE__*/ decorative(GallerySlashSource);
export { ImageOff as ImageOffIcon };
export const Gauge = /*#__PURE__*/ decorative(GaugeSource);
export { Gauge as GaugeIcon };
export const Globe = /*#__PURE__*/ decorative(GlobeSource);
export { Globe as GlobeIcon };
export const Globe2 = /*#__PURE__*/ decorative(Globe2Source);
export { Globe2 as Globe2Icon };
export const LandPlot = /*#__PURE__*/ decorative(GolfSource);
export { LandPlot as LandPlotIcon };
export const LocateFixed = /*#__PURE__*/ decorative(GpsSource);
export { LocateFixed as LocateFixedIcon };
export const GraduationCap = /*#__PURE__*/ decorative(GraduationCapSource);
export { GraduationCap as GraduationCapIcon };
export const SquareActivity = /*#__PURE__*/ decorative(GraphSource);
export { SquareActivity as SquareActivityIcon };
export const Grid2x2 = /*#__PURE__*/ decorative(GridSource);
export {
  Grid2x2 as Grid2x2Icon,
  Grid2x2 as Grid2X2,
  Grid2x2 as Grid2X2Icon,
  Grid2x2 as Grid2x2Check,
  Grid2x2 as Grid2x2CheckIcon,
};
export const Table2 = /*#__PURE__*/ decorative(Grid2Source);
export { Table2 as Table2Icon };
export const Table = /*#__PURE__*/ decorative(Grid8Source);
export { Table as TableIcon };
export const Hand = /*#__PURE__*/ decorative(HandSource);
export { Hand as HandIcon };
export const HandHelping = /*#__PURE__*/ decorative(HandHeartSource);
export { HandHelping as HandHelpingIcon };
export const Hash = /*#__PURE__*/ decorative(HashtagSource);
export { Hash as HashIcon };
export const Headphones = /*#__PURE__*/ decorative(HeadphonesSource);
export { Headphones as HeadphonesIcon };
export const Heart = /*#__PURE__*/ decorative(HeartSource);
export { Heart as HeartIcon };
export const HeartPulse = /*#__PURE__*/ decorative(HeartPulseSource);
export { HeartPulse as HeartPulseIcon };
export const CircleHelp = /*#__PURE__*/ decorative(HelpCircleSource);
export {
  CircleHelp as CircleHelpIcon,
  CircleHelp as CircleQuestionMark,
  CircleHelp as CircleQuestionMarkIcon,
  CircleHelp as HelpCircle,
  CircleHelp as HelpCircleIcon,
};
export const GitBranch = /*#__PURE__*/ decorative(HierarchySource);
export { GitBranch as GitBranchIcon };
export const GitFork = /*#__PURE__*/ decorative(Hierarchy2Source);
export { GitFork as GitForkIcon };
export const GitMerge = /*#__PURE__*/ decorative(Hierarchy3Source);
export { GitMerge as GitMergeIcon };
export const FileClock = /*#__PURE__*/ decorative(HistorySource);
export { FileClock as FileClockIcon, FileClock as History, FileClock as HistoryIcon };
export const Hospital = /*#__PURE__*/ decorative(HospitalSource);
export { Hospital as HospitalIcon };
export const Hourglass = /*#__PURE__*/ decorative(HourglassSource);
export { Hourglass as HourglassIcon };
export const Home = /*#__PURE__*/ decorative(HouseSource);
export { Home as HomeIcon, Home as House, Home as HouseIcon };
export const Image = /*#__PURE__*/ decorative(ImageSource);
export { Image as ImageIcon };
export const ImagePlus = /*#__PURE__*/ decorative(ImagePlusSource);
export { ImagePlus as ImagePlusIcon };
export const ImageUp = /*#__PURE__*/ decorative(ImageUpSource);
export { ImageUp as ImageUpIcon };
export const Inbox = /*#__PURE__*/ decorative(InboxSource);
export { Inbox as InboxIcon };
export const Factory = /*#__PURE__*/ decorative(IndustrySource);
export { Factory as FactoryIcon };
export const Info = /*#__PURE__*/ decorative(InfoCircleSource);
export { Info as InfoIcon };
export const Italic = /*#__PURE__*/ decorative(ItalicSource);
export { Italic as ItalicIcon };
export const Kanban = /*#__PURE__*/ decorative(KanbanSource);
export {
  Kanban as KanbanIcon,
  Kanban as KanbanSquare,
  Kanban as KanbanSquareIcon,
  Kanban as SquareKanban,
  Kanban as SquareKanbanIcon,
};
export const Key = /*#__PURE__*/ decorative(KeySource);
export { Key as KeyIcon, Key as KeyRound, Key as KeyRoundIcon };
export const Keyboard = /*#__PURE__*/ decorative(KeyboardSource);
export { Keyboard as KeyboardIcon };
export const KeySquare = /*#__PURE__*/ decorative(KeySquareSource);
export { KeySquare as KeySquareIcon };
export const Laptop = /*#__PURE__*/ decorative(LaptopSource);
export { Laptop as LaptopIcon };
export const Layers = /*#__PURE__*/ decorative(LayersSource);
export { Layers as LayersIcon };
export const Layout = /*#__PURE__*/ decorative(LayoutSource);
export { Layout as LayoutIcon };
export const Leaf = /*#__PURE__*/ decorative(LeafSource);
export { Leaf as LeafIcon };
export const LifeBuoy = /*#__PURE__*/ decorative(LifebuoySource);
export { LifeBuoy as LifeBuoyIcon };
export const Brain = /*#__PURE__*/ decorative(LightbulbSource);
export { Brain as BrainIcon, Brain as Lightbulb, Brain as LightbulbIcon };
export const Link = /*#__PURE__*/ decorative(LinkSource);
export { Link as LinkIcon };
export const Link2 = /*#__PURE__*/ decorative(Link2Source);
export { Link2 as Link2Icon };
export const Unlink = /*#__PURE__*/ decorative(LinkBrokenSource);
export { Unlink as UnlinkIcon };
export const List = /*#__PURE__*/ decorative(List3Source);
export { List as ListIcon };
export const MapPinCheckInside = /*#__PURE__*/ decorative(LocationTickSource);
export { MapPinCheckInside as MapPinCheckInsideIcon };
export const Lock = /*#__PURE__*/ decorative(LockSource);
export { Lock as LockIcon };
export const LockKeyhole = /*#__PURE__*/ decorative(LockKeyholeSource);
export { LockKeyhole as LockKeyholeIcon };
export const LogIn = /*#__PURE__*/ decorative(LoginSource);
export { LogIn as LogInIcon };
export const LogOut = /*#__PURE__*/ decorative(LogoutSource);
export { LogOut as LogOutIcon };
export const Map = /*#__PURE__*/ decorative(MapSource);
export { Map as MapIcon };
export const Navigation = /*#__PURE__*/ decorative(MapArrowUpSource);
export { Navigation as NavigationIcon };
export const MapPinned = /*#__PURE__*/ decorative(MapPointSource);
export { MapPinned as MapPinnedIcon };
export const Maximize = /*#__PURE__*/ decorative(MaximizeSource);
export { Maximize as MaximizeIcon, Maximize as Maximize2, Maximize as Maximize2Icon };
export const ListPlus = /*#__PURE__*/ decorative(MemoPlusSource);
export { ListPlus as ListPlusIcon };
export const Menu = /*#__PURE__*/ decorative(MenuSource);
export { Menu as MenuIcon };
export const MessageSquare = /*#__PURE__*/ decorative(MessageSource);
export { MessageSquare as MessageSquareIcon };
export const MessageSquareWarning = /*#__PURE__*/ decorative(MessageNotifSource);
export { MessageSquareWarning as MessageSquareWarningIcon };
export const MessageSquarePlus = /*#__PURE__*/ decorative(MessagePlusSource);
export { MessageSquarePlus as MessageSquarePlusIcon };
export const MailQuestion = /*#__PURE__*/ decorative(MessageQuestionSource);
export {
  MailQuestion as MailQuestionIcon,
  MailQuestion as MessageCircleQuestion,
  MailQuestion as MessageCircleQuestionIcon,
};
export const MessagesSquare = /*#__PURE__*/ decorative(Messages4Source);
export { MessagesSquare as MessagesSquareIcon };
export const MessageSquareQuote = /*#__PURE__*/ decorative(MessageText2Source);
export {
  MessageSquareQuote as MessageSquareQuoteIcon,
  MessageSquareQuote as MessageSquareText,
  MessageSquareQuote as MessageSquareTextIcon,
};
export const MessageCircleOff = /*#__PURE__*/ decorative(MessageXSource);
export { MessageCircleOff as MessageCircleOffIcon };
export const Mic = /*#__PURE__*/ decorative(MicrophoneSource);
export { Mic as MicIcon };
export const Minimize2 = /*#__PURE__*/ decorative(MinimizeSource);
export { Minimize2 as Minimize2Icon };
export const Minus = /*#__PURE__*/ decorative(MinusSource);
export { Minus as MinusIcon };
export const CircleMinus = /*#__PURE__*/ decorative(MinusCircleSource);
export { CircleMinus as CircleMinusIcon };
export const Smartphone = /*#__PURE__*/ decorative(MobileSource);
export { Smartphone as SmartphoneIcon };
export const Monitor = /*#__PURE__*/ decorative(MonitorSource);
export { Monitor as MonitorIcon, Monitor as MonitorCog, Monitor as MonitorCogIcon };
export const MonitorSmartphone = /*#__PURE__*/ decorative(MonitorPhoneSource);
export { MonitorSmartphone as MonitorSmartphoneIcon };
export const Moon = /*#__PURE__*/ decorative(MoonSource);
export { Moon as MoonIcon };
export const Ellipsis = /*#__PURE__*/ decorative(MoreHSource);
export { Ellipsis as EllipsisIcon, Ellipsis as MoreHorizontal, Ellipsis as MoreHorizontalIcon };
export const Music = /*#__PURE__*/ decorative(MusicSource);
export { Music as MusicIcon };
export const Music4 = /*#__PURE__*/ decorative(MusicNotesSource);
export { Music4 as Music4Icon };
export const ListMusic = /*#__PURE__*/ decorative(MusicPlaylistSource);
export { ListMusic as ListMusicIcon };
export const Webhook = /*#__PURE__*/ decorative(NodesSource);
export { Webhook as WebhookIcon };
export const ScanSearch = /*#__PURE__*/ decorative(ObjectScanSource);
export { ScanSearch as ScanSearchIcon };
export const ListOrdered = /*#__PURE__*/ decorative(OrderedListSource);
export { ListOrdered as ListOrderedIcon };
export const Package = /*#__PURE__*/ decorative(PackageSource);
export { Package as PackageIcon };
export const Palette = /*#__PURE__*/ decorative(PaletteSource);
export { Palette as PaletteIcon };
export const Paperclip = /*#__PURE__*/ decorative(PaperclipSource);
export { Paperclip as PaperclipIcon };
export const Pause = /*#__PURE__*/ decorative(PauseSource);
export { Pause as PauseIcon };
export const CirclePause = /*#__PURE__*/ decorative(PauseCircleSource);
export {
  CirclePause as CirclePauseIcon,
  CirclePause as PauseCircle,
  CirclePause as PauseCircleIcon,
};
export const Pencil = /*#__PURE__*/ decorative(PenSource);
export { Pencil as PencilIcon };
export const FileSignature = /*#__PURE__*/ decorative(PenLineSource);
export {
  FileSignature as FileSignatureIcon,
  FileSignature as PencilLine,
  FileSignature as PencilLineIcon,
};
export const SquarePen = /*#__PURE__*/ decorative(PenSquareSource);
export { SquarePen as SquarePenIcon };
export const PenTool = /*#__PURE__*/ decorative(PenToolSource);
export { PenTool as PenToolIcon };
export const ContactRound = /*#__PURE__*/ decorative(PersonalcardSource);
export { ContactRound as ContactRoundIcon };
export const Phone = /*#__PURE__*/ decorative(PhoneSource);
export { Phone as PhoneIcon };
export const MapPin = /*#__PURE__*/ decorative(PinSource);
export { MapPin as MapPinIcon };
export const PinOff = /*#__PURE__*/ decorative(PinOffSource);
export { PinOff as PinOffIcon };
export const Pipette = /*#__PURE__*/ decorative(PipetteSource);
export { Pipette as PipetteIcon };
export const Plane = /*#__PURE__*/ decorative(PlaneSource);
export { Plane as PlaneIcon };
export const Play = /*#__PURE__*/ decorative(PlaySource);
export { Play as PlayIcon };
export const PlayCircle = /*#__PURE__*/ decorative(PlayCircleSource);
export { PlayCircle as PlayCircleIcon };
export const Plug = /*#__PURE__*/ decorative(PlugSource);
export { Plug as PlugIcon };
export const Unplug = /*#__PURE__*/ decorative(Plug2Source);
export { Unplug as UnplugIcon };
export const PlugZap = /*#__PURE__*/ decorative(PlugCircleSource);
export { PlugZap as PlugZapIcon };
export const Plus = /*#__PURE__*/ decorative(PlusSource);
export { Plus as PlusIcon };
export const CirclePlus = /*#__PURE__*/ decorative(PlusCircleSource);
export { CirclePlus as CirclePlusIcon };
export const Power = /*#__PURE__*/ decorative(PowerSource);
export { Power as PowerIcon };
export const Presentation = /*#__PURE__*/ decorative(PresentationSource);
export { Presentation as PresentationIcon };
export const Printer = /*#__PURE__*/ decorative(PrinterSource);
export { Printer as PrinterIcon };
export const Terminal = /*#__PURE__*/ decorative(ProgrammingSource);
export { Terminal as TerminalIcon };
export const GitPullRequestArrow = /*#__PURE__*/ decorative(ProgrammingArrowSource);
export { GitPullRequestArrow as GitPullRequestArrowIcon };
export const Puzzle = /*#__PURE__*/ decorative(PuzzleSource);
export { Puzzle as PuzzleIcon };
export const QrCode = /*#__PURE__*/ decorative(QrSource);
export { QrCode as QrCodeIcon };
export const Quote = /*#__PURE__*/ decorative(QuoteUpSource);
export { Quote as QuoteIcon };
export const Radar = /*#__PURE__*/ decorative(RadarSource);
export { Radar as RadarIcon };
export const MemoryStick = /*#__PURE__*/ decorative(RamSource);
export { MemoryStick as MemoryStickIcon };
export const Receipt = /*#__PURE__*/ decorative(ReceiptSource);
export { Receipt as ReceiptIcon };
export const FileSearch = /*#__PURE__*/ decorative(ReceiptSearchSource);
export { FileSearch as FileSearchIcon };
export const ReceiptText = /*#__PURE__*/ decorative(ReceiptTextSource);
export { ReceiptText as ReceiptTextIcon };
export const Redo2 = /*#__PURE__*/ decorative(RedoSource);
export { Redo2 as Redo2Icon };
export const RefreshCw = /*#__PURE__*/ decorative(RefreshSource);
export { RefreshCw as RefreshCwIcon };
export const Repeat = /*#__PURE__*/ decorative(RepeatSource);
export { Repeat as RepeatIcon };
export const Repeat2 = /*#__PURE__*/ decorative(Repeat3Source);
export { Repeat2 as Repeat2Icon };
export const CornerUpLeft = /*#__PURE__*/ decorative(ReplySource);
export { CornerUpLeft as CornerUpLeftIcon };
export const CornerDownLeft = /*#__PURE__*/ decorative(Reply2Source);
export { CornerDownLeft as CornerDownLeftIcon };
export const Rocket = /*#__PURE__*/ decorative(RocketSource);
export { Rocket as RocketIcon };
export const RotateCcw = /*#__PURE__*/ decorative(RotateLeftSource);
export { RotateCcw as RotateCcwIcon };
export const RotateCw = /*#__PURE__*/ decorative(RotateRightSource);
export { RotateCw as RotateCwIcon };
export const Route = /*#__PURE__*/ decorative(RouteTrackSource);
export { Route as RouteIcon };
export const Waypoints = /*#__PURE__*/ decorative(RoutingSource);
export { Waypoints as WaypointsIcon };
export const Columns2 = /*#__PURE__*/ decorative(RowHorizontalSource);
export { Columns2 as Columns2Icon };
export const Scan = /*#__PURE__*/ decorative(ScanSource);
export { Scan as ScanIcon };
export const ScanLine = /*#__PURE__*/ decorative(ScannerSource);
export { ScanLine as ScanLineIcon };
export const Scissors = /*#__PURE__*/ decorative(ScissorsSource);
export { Scissors as ScissorsIcon };
export const Search = /*#__PURE__*/ decorative(SearchSource);
export { Search as SearchIcon };
export const SearchCheck = /*#__PURE__*/ decorative(SearchStatusSource);
export { SearchCheck as SearchCheckIcon };
export const ZoomIn = /*#__PURE__*/ decorative(SearchZoomInSource);
export { ZoomIn as ZoomInIcon };
export const ZoomOut = /*#__PURE__*/ decorative(SearchZoomOutSource);
export { ZoomOut as ZoomOutIcon };
export const Send = /*#__PURE__*/ decorative(SendSource);
export { Send as SendIcon };
export const Server = /*#__PURE__*/ decorative(ServerSource);
export { Server as ServerIcon };
export const Wrench = /*#__PURE__*/ decorative(SettingsSource);
export { Wrench as WrenchIcon };
export const Settings = /*#__PURE__*/ decorative(Settings2Source);
export { Settings as SettingsIcon };
export const Share2 = /*#__PURE__*/ decorative(ShareSource);
export { Share2 as Share2Icon };
export const ShieldQuestionMark = /*#__PURE__*/ decorative(ShieldSource);
export { ShieldQuestionMark as ShieldQuestionMarkIcon };
export const Shield = /*#__PURE__*/ decorative(Shield2Source);
export { Shield as ShieldIcon };
export const ShieldAlert = /*#__PURE__*/ decorative(ShieldAlertSource);
export { ShieldAlert as ShieldAlertIcon };
export const ShieldCheck = /*#__PURE__*/ decorative(ShieldCheckSource);
export { ShieldCheck as ShieldCheckIcon };
export const ShieldOff = /*#__PURE__*/ decorative(ShieldOffSource);
export { ShieldOff as ShieldOffIcon };
export const ShoppingBag = /*#__PURE__*/ decorative(ShoppingBagSource);
export { ShoppingBag as ShoppingBagIcon };
export const ShoppingCart = /*#__PURE__*/ decorative(ShoppingCartSource);
export { ShoppingCart as ShoppingCartIcon };
export const PanelBottom = /*#__PURE__*/ decorative(SidebarBottomSource);
export { PanelBottom as PanelBottomIcon };
export const PanelLeft = /*#__PURE__*/ decorative(SidebarLeftSource);
export { PanelLeft as PanelLeftIcon, PanelLeft as PanelLeftOpen, PanelLeft as PanelLeftOpenIcon };
export const PanelLeftClose = /*#__PURE__*/ decorative(SidebarLeft2Source);
export { PanelLeftClose as PanelLeftCloseIcon };
export const PanelRight = /*#__PURE__*/ decorative(SidebarRightSource);
export { PanelRight as PanelRightIcon };
export const PanelRightOpen = /*#__PURE__*/ decorative(SidebarRight2Source);
export { PanelRightOpen as PanelRightOpenIcon };
export const Radio = /*#__PURE__*/ decorative(SignalStreamSource);
export { Radio as RadioIcon };
export const Milestone = /*#__PURE__*/ decorative(SignpostSource);
export { Milestone as MilestoneIcon, Milestone as Signpost, Milestone as SignpostIcon };
export const CardSim = /*#__PURE__*/ decorative(SimcardSource);
export { CardSim as CardSimIcon };
export const Siren = /*#__PURE__*/ decorative(SirenSource);
export { Siren as SirenIcon };
export const Network = /*#__PURE__*/ decorative(SitemapSource);
export { Network as NetworkIcon };
export const SkipForward = /*#__PURE__*/ decorative(SkipNextSource);
export { SkipForward as SkipForwardIcon };
export const SkipBack = /*#__PURE__*/ decorative(SkipPrevSource);
export { SkipBack as SkipBackIcon };
export const CircleSlash = /*#__PURE__*/ decorative(SlashCircleSource);
export { CircleSlash as CircleSlashIcon };
export const ListFilter = /*#__PURE__*/ decorative(Sort3Source);
export { ListFilter as ListFilterIcon };
export const ArrowUpNarrowWide = /*#__PURE__*/ decorative(SortAscSource);
export { ArrowUpNarrowWide as ArrowUpNarrowWideIcon };
export const ArrowDownWideNarrow = /*#__PURE__*/ decorative(SortDescSource);
export { ArrowDownWideNarrow as ArrowDownWideNarrowIcon };
export const AudioLines = /*#__PURE__*/ decorative(SoundwaveSource);
export { AudioLines as AudioLinesIcon };
export const Sparkles = /*#__PURE__*/ decorative(SparklesSource);
export { Sparkles as SparklesIcon };
export const Ungroup = /*#__PURE__*/ decorative(SquaresSource);
export { Ungroup as UngroupIcon };
export const Star = /*#__PURE__*/ decorative(StarSource);
export { Star as StarIcon };
export const Stethoscope = /*#__PURE__*/ decorative(StethoscopeSource);
export { Stethoscope as StethoscopeIcon };
export const StickyNote = /*#__PURE__*/ decorative(StickynoteSource);
export { StickyNote as StickyNoteIcon };
export const CircleStop = /*#__PURE__*/ decorative(StopCircleSource);
export { CircleStop as CircleStopIcon };
export const TimerOff = /*#__PURE__*/ decorative(StopwatchOffSource);
export { TimerOff as TimerOffIcon };
export const Store = /*#__PURE__*/ decorative(StoreSource);
export { Store as StoreIcon };
export const Sun = /*#__PURE__*/ decorative(SunSource);
export { Sun as SunIcon };
export const Tablet = /*#__PURE__*/ decorative(TabletSource);
export { Tablet as TabletIcon };
export const Tag = /*#__PURE__*/ decorative(TagSource);
export { Tag as TagIcon };
export const Tags = /*#__PURE__*/ decorative(TagsSource);
export { Tags as TagsIcon };
export const Target = /*#__PURE__*/ decorative(TargetSource);
export { Target as TargetIcon };
export const ListTodo = /*#__PURE__*/ decorative(TaskSource);
export { ListTodo as ListTodoIcon };
export const SquareTerminal = /*#__PURE__*/ decorative(TerminalSquareSource);
export { SquareTerminal as SquareTerminalIcon };
export const TestTube2 = /*#__PURE__*/ decorative(TestTube2Source);
export { TestTube2 as TestTube2Icon };
export const Type = /*#__PURE__*/ decorative(TextSource);
export { Type as TypeIcon };
export const AlignCenter = /*#__PURE__*/ decorative(TextalignCenterSource);
export { AlignCenter as AlignCenterIcon };
export const AlignJustify = /*#__PURE__*/ decorative(TextalignJustifycenterSource);
export { AlignJustify as AlignJustifyIcon };
export const AlignLeft = /*#__PURE__*/ decorative(TextalignLeftSource);
export { AlignLeft as AlignLeftIcon };
export const AlignRight = /*#__PURE__*/ decorative(TextalignRightSource);
export { AlignRight as AlignRightIcon };
export const Highlighter = /*#__PURE__*/ decorative(TextHighlightSource);
export { Highlighter as HighlighterIcon };
export const Strikethrough = /*#__PURE__*/ decorative(TextXSource);
export { Strikethrough as StrikethroughIcon };
export const ThumbsDown = /*#__PURE__*/ decorative(ThumbsDownSource);
export { ThumbsDown as ThumbsDownIcon };
export const ThumbsUp = /*#__PURE__*/ decorative(ThumbsUpSource);
export { ThumbsUp as ThumbsUpIcon };
export const Pin = /*#__PURE__*/ decorative(ThumbtackSource);
export { Pin as PinIcon };
export const Ticket = /*#__PURE__*/ decorative(TicketSource);
export { Ticket as TicketIcon };
export const TicketPercent = /*#__PURE__*/ decorative(TicketPercentSource);
export { TicketPercent as TicketPercentIcon };
export const TimerReset = /*#__PURE__*/ decorative(TimeBackSource);
export { TimerReset as TimerResetIcon };
export const Timer = /*#__PURE__*/ decorative(TimerSource);
export { Timer as TimerIcon };
export const RadioTower = /*#__PURE__*/ decorative(TowerSource);
export { RadioTower as RadioTowerIcon };
export const GitCompare = /*#__PURE__*/ decorative(TransferHSource);
export {
  GitCompare as GitCompareIcon,
  GitCompare as GitCompareArrows,
  GitCompare as GitCompareArrowsIcon,
};
export const Trash = /*#__PURE__*/ decorative(Trash2Source);
export { Trash as TrashIcon, Trash as Trash2, Trash as Trash2Icon };
export const Triangle = /*#__PURE__*/ decorative(TriangleSource);
export { Triangle as TriangleIcon };
export const Trophy = /*#__PURE__*/ decorative(TrophySource);
export { Trophy as TrophyIcon };
export const Truck = /*#__PURE__*/ decorative(TruckSource);
export { Truck as TruckIcon };
export const Settings2 = /*#__PURE__*/ decorative(Tuning2Source);
export { Settings2 as Settings2Icon };
export const SlidersHorizontal = /*#__PURE__*/ decorative(Tuning4Source);
export { SlidersHorizontal as SlidersHorizontalIcon };
export const Underline = /*#__PURE__*/ decorative(UnderlineSource);
export { Underline as UnderlineIcon };
export const Undo2 = /*#__PURE__*/ decorative(UndoSource);
export { Undo2 as Undo2Icon };
export const Unlock = /*#__PURE__*/ decorative(UnlockSource);
export { Unlock as UnlockIcon };
export const Upload = /*#__PURE__*/ decorative(UploadSource);
export { Upload as UploadIcon };
export const User = /*#__PURE__*/ decorative(UserSource);
export { User as UserIcon, User as UserRound, User as UserRoundIcon };
export const UserPlus = /*#__PURE__*/ decorative(UserAddSource);
export { UserPlus as UserPlusIcon, UserPlus as UserRoundPlus, UserPlus as UserRoundPlusIcon };
export const UserCheck = /*#__PURE__*/ decorative(UserCheckSource);
export { UserCheck as UserCheckIcon, UserCheck as UserRoundCheck, UserCheck as UserRoundCheckIcon };
export const CircleUser = /*#__PURE__*/ decorative(UserCircleSource);
export {
  CircleUser as CircleUserIcon,
  CircleUser as CircleUserRound,
  CircleUser as CircleUserRoundIcon,
  CircleUser as UserCircle,
  CircleUser as UserCircleIcon,
};
export const UserRoundCog = /*#__PURE__*/ decorative(UserEditSource);
export {
  UserRoundCog as UserRoundCogIcon,
  UserRoundCog as UserRoundPen,
  UserRoundCog as UserRoundPenIcon,
};
export const UserMinus = /*#__PURE__*/ decorative(UserMinusSource);
export { UserMinus as UserMinusIcon };
export const Users = /*#__PURE__*/ decorative(UsersSource);
export { Users as UsersIcon, Users as UsersRound, Users as UsersRoundIcon };
export const UserRoundSearch = /*#__PURE__*/ decorative(UserSearchSource);
export {
  UserRoundSearch as UserRoundSearchIcon,
  UserRoundSearch as UserSearch,
  UserRoundSearch as UserSearchIcon,
};
export const UserRoundX = /*#__PURE__*/ decorative(UserXSource);
export { UserRoundX as UserRoundXIcon };
export const Frame = /*#__PURE__*/ decorative(VectorSquareSource);
export { Frame as FrameIcon };
export const BadgeCheck = /*#__PURE__*/ decorative(VerifiedSource);
export { BadgeCheck as BadgeCheckIcon };
export const Video = /*#__PURE__*/ decorative(VideoSource);
export { Video as VideoIcon };
export const VideoOff = /*#__PURE__*/ decorative(VideoOffSource);
export { VideoOff as VideoOffIcon };
export const Volleyball = /*#__PURE__*/ decorative(VolleyballSource);
export { Volleyball as VolleyballIcon };
export const Volume2 = /*#__PURE__*/ decorative(VolumeHighSource);
export { Volume2 as Volume2Icon };
export const VolumeOff = /*#__PURE__*/ decorative(VolumeOffSource);
export { VolumeOff as VolumeOffIcon };
export const VolumeX = /*#__PURE__*/ decorative(VolumeXSource);
export { VolumeX as VolumeXIcon };
export const Wallet = /*#__PURE__*/ decorative(WalletSource);
export { Wallet as WalletIcon };
export const Activity = /*#__PURE__*/ decorative(WavePulseSource);
export { Activity as ActivityIcon };
export const Blocks = /*#__PURE__*/ decorative(WidgetSource);
export { Blocks as BlocksIcon, Blocks as LayoutGrid, Blocks as LayoutGridIcon };
export const Wifi = /*#__PURE__*/ decorative(WifiSource);
export { Wifi as WifiIcon };
export const WifiOff = /*#__PURE__*/ decorative(WifiOffSource);
export { WifiOff as WifiOffIcon };
export const AppWindow = /*#__PURE__*/ decorative(Window2Source);
export { AppWindow as AppWindowIcon };
export const X = /*#__PURE__*/ decorative(XSource);
export { X as XIcon };
export const CircleX = /*#__PURE__*/ decorative(XCircleSource);
export { CircleX as CircleXIcon, CircleX as XCircle, CircleX as XCircleIcon };

/** Drawn locally: Reicon has no ArrowLeftToLine glyph. */
export const ArrowLeftToLine = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("ArrowLeftToLine", {
    O: '<path d="M3.75 4.75v14.5M20.25 12H8.25M12.25 7.75 8 12l4.25 4.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { ArrowLeftToLine as ArrowLeftToLineIcon };

/** Drawn locally: Reicon has no ArrowRightToLine glyph. */
export const ArrowRightToLine = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("ArrowRightToLine", {
    O: '<path d="M20.25 4.75v14.5M3.75 12h12M11.75 7.75 16 12l-4.25 4.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { ArrowRightToLine as ArrowRightToLineIcon };

/** Drawn locally: Reicon has no Bot glyph. */
export const Bot = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("Bot", {
    O: '<rect x="4.75" y="7.75" width="14.5" height="11.5" rx="3.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7.75V4.75M2.75 12.25v2.5M21.25 12.25v2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="3.75" r="1" fill="currentColor"/><circle cx="9.25" cy="13.25" r="1.5" fill="currentColor"/><circle cx="14.75" cy="13.25" r="1.5" fill="currentColor"/>',
  })
);
export { Bot as BotIcon };

/** Drawn locally: Reicon has no Braces glyph. */
export const Braces = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("Braces", {
    O: '<path d="M8.5 3.75H8A2.25 2.25 0 0 0 5.75 6v3.5c0 1.243-1.007 2.5-2.25 2.5 1.243 0 2.25 1.257 2.25 2.5V18A2.25 2.25 0 0 0 8 20.25h.5M15.5 3.75h.5A2.25 2.25 0 0 1 18.25 6v3.5c0 1.243 1.007 2.5 2.25 2.5-1.243 0-2.25 1.257-2.25 2.5V18A2.25 2.25 0 0 1 16 20.25h-.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { Braces as BracesIcon };

/** Drawn locally: Reicon has no CalendarClock glyph. */
export const CalendarClock = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("CalendarClock", {
    O: '<path d="M20.25 11V7.75a2.5 2.5 0 0 0-2.5-2.5H6.25a2.5 2.5 0 0 0-2.5 2.5v10.5a2.5 2.5 0 0 0 2.5 2.5H11M3.75 9.75h16.5M8 3.25v4M16 3.25v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17" cy="17" r="4.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 15v2.1l1.4.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { CalendarClock as CalendarClockIcon };

/** Drawn locally: Reicon has no ChevronsDown glyph. */
export const ChevronsDown = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("ChevronsDown", {
    O: '<path d="M7.75 6.75 12 11l4.25-4.25M7.75 12.75 12 17l4.25-4.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { ChevronsDown as ChevronsDownIcon };

/** Drawn locally: Reicon has no Circle glyph. */
export const Circle = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("Circle", {
    O: '<circle cx="12" cy="12" r="9.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    F: '<circle cx="12" cy="12" r="10" fill="currentColor"/>',
  })
);
export { Circle as CircleIcon };

/** Drawn locally: Reicon has no CircleDashed glyph. */
export const CircleDashed = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("CircleDashed", {
    O: '<circle cx="12" cy="12" r="9.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3.5 3.765"/>',
  })
);
export { CircleDashed as CircleDashedIcon };

/** Drawn locally: Reicon has no CircleDot glyph. */
export const CircleDot = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("CircleDot", {
    O: '<circle cx="12" cy="12" r="9.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="2" fill="currentColor"/>',
  })
);
export { CircleDot as CircleDotIcon };

/** Drawn locally: Reicon has no Columns3 glyph. */
export const Columns3 = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("Columns3", {
    O: '<rect x="3.25" y="3.25" width="17.5" height="17.5" rx="4.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.25 3.5v17M14.75 3.5v17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { Columns3 as Columns3Icon };

/** Drawn locally: Reicon has no EllipsisVertical glyph. */
export const EllipsisVertical = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("EllipsisVertical", {
    O: '<circle cx="12" cy="5.5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="18.5" r="1.5" fill="currentColor"/>',
  })
);
export {
  EllipsisVertical as EllipsisVerticalIcon,
  EllipsisVertical as MoreVertical,
  EllipsisVertical as MoreVerticalIcon,
};

/** Drawn locally: Reicon has no FolderSearch glyph. */
export const FolderSearch = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("FolderSearch", {
    O: '<path d="M11 19.25H5.75a2 2 0 0 1-2-2V6.75a2 2 0 0 1 2-2h3.5l2 2.5h7a2 2 0 0 1 2 2V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16.25" cy="15.75" r="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="m18.5 18 1.75 1.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { FolderSearch as FolderSearchIcon };

/** Drawn locally: Reicon has no Gavel glyph. */
export const Gavel = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("Gavel", {
    O: '<rect x="10.5" y="2.5" width="7" height="12" rx="1.75" transform="rotate(-45 14 8.5)" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.5 11 3.75 18.75M12.75 20.25h7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { Gavel as GavelIcon };

/** Drawn locally: Reicon has no GripHorizontal glyph. */
export const GripHorizontal = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("GripHorizontal", {
    O: '<circle cx="5.5" cy="9" r="1.5" fill="currentColor"/><circle cx="12" cy="9" r="1.5" fill="currentColor"/><circle cx="18.5" cy="9" r="1.5" fill="currentColor"/><circle cx="5.5" cy="15" r="1.5" fill="currentColor"/><circle cx="12" cy="15" r="1.5" fill="currentColor"/><circle cx="18.5" cy="15" r="1.5" fill="currentColor"/>',
  })
);
export { GripHorizontal as GripHorizontalIcon };

/** Drawn locally: Reicon has no GripVertical glyph. */
export const GripVertical = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("GripVertical", {
    O: '<circle cx="9" cy="5.5" r="1.5" fill="currentColor"/><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="9" cy="18.5" r="1.5" fill="currentColor"/><circle cx="15" cy="5.5" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="18.5" r="1.5" fill="currentColor"/>',
  })
);
export { GripVertical as GripVerticalIcon };

/** Drawn locally: Reicon has no Handshake glyph. */
export const Handshake = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("Handshake", {
    O: '<path d="M2.75 8.25h2.5l3.6-2.4a2 2 0 0 1 2.2 0l.45.3M21.25 8.25h-2.5l-3.4-2.2a2 2 0 0 0-2.2.05L9.4 8.6a1.4 1.4 0 0 0 1.7 2.2l2.1-1.3 5.55 5M5.25 8.25v6l5.1 4.3a2 2 0 0 0 2.7 0l5.7-4.6V8.25M10.25 15.25l1.9 1.65M12.75 13.25l2.1 1.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { Handshake as HandshakeIcon };

/** Drawn locally: Reicon has no Heading3 glyph. */
export const Heading3 = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("Heading3", {
    O: '<path d="M3.75 5.75v12.5M12.25 5.75v12.5M3.75 12h8.5M16.25 7.25h4l-2.5 3.5a2.25 2.25 0 1 1-1.75 4.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { Heading3 as Heading3Icon };

/** Drawn locally: Reicon has no IndentDecrease glyph. */
export const IndentDecrease = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("IndentDecrease", {
    O: '<path d="M20.25 5.75h-9M20.25 12h-9M20.25 18.25h-9M7 8.75 3.75 12 7 15.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { IndentDecrease as IndentDecreaseIcon };

/** Drawn locally: Reicon has no IndentIncrease glyph. */
export const IndentIncrease = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("IndentIncrease", {
    O: '<path d="M20.25 5.75h-9M20.25 12h-9M20.25 18.25h-9M3.75 8.75 7 12l-3.25 3.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { IndentIncrease as IndentIncreaseIcon };

/** Drawn locally: Reicon has no Loader2 glyph. */
export const Loader2 = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("Loader2", {
    O: '<path d="M21 12a9 9 0 1 1-9-9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { Loader2 as Loader2Icon, Loader2 as LoaderCircle, Loader2 as LoaderCircleIcon };

/** Drawn locally: Reicon has no PanelsTopLeft glyph. */
export const PanelsTopLeft = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("PanelsTopLeft", {
    O: '<rect x="3.75" y="3.75" width="16.5" height="16.5" rx="3.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.75 9.25h16.5M9.25 9.25v11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { PanelsTopLeft as PanelsTopLeftIcon };

/** Drawn locally: Reicon has no PowerOff glyph. */
export const PowerOff = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("PowerOff", {
    O: '<path d="M12 3.75V9M6.6 6.1a8.25 8.25 0 1 0 10.8 0M3.75 3.75l16.5 16.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { PowerOff as PowerOffIcon };

/** Drawn locally: Reicon has no RouteOff glyph. */
export const RouteOff = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("RouteOff", {
    O: '<circle cx="6" cy="18.5" r="2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="5.5" r="2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.5 18.5H15a3.5 3.5 0 0 0 1.6-6.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.5 12H9a3.25 3.25 0 0 1-3.2-3.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 5.5H10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { RouteOff as RouteOffIcon };

/** Drawn locally: Reicon has no Rows3 glyph. */
export const Rows3 = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("Rows3", {
    O: '<rect x="3.25" y="3.25" width="17.5" height="17.5" rx="4.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 9.25h17M3.5 14.75h17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { Rows3 as Rows3Icon };

/** Drawn locally: Reicon has no Scale glyph. */
export const Scale = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("Scale", {
    O: '<path d="M12 3.5v17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 20.5h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 7.5h2.75c2 0 3.95-.8 5.75-1.75 1.8.95 3.75 1.75 5.75 1.75h2.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.75 7.75 2.75 15c.75.8 1.85 1.25 3 1.25s2.25-.45 3-1.25l-3-7.25Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.25 7.75l-3 7.25c.75.8 1.85 1.25 3 1.25s2.25-.45 3-1.25l-3-7.25Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { Scale as ScaleIcon };

/** Drawn locally: Reicon has no SearchX glyph. */
export const SearchX = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("SearchX", {
    O: '<circle cx="11.25" cy="11.25" r="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="m17 17 3.25 3.25M9 9l4.5 4.5M13.5 9 9 13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { SearchX as SearchXIcon };

/** Drawn locally: Reicon has no ShieldEllipsis glyph. */
export const ShieldEllipsis = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("ShieldEllipsis", {
    O: '<path d="M12 3 5 5.6a1.1 1.1 0 0 0-.75 1V12c0 4.6 3.4 7.4 7.75 9 4.35-1.6 7.75-4.4 7.75-9V6.6a1.1 1.1 0 0 0-.75-1L12 3Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8.75" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="15.25" cy="12" r="1" fill="currentColor"/>',
  })
);
export { ShieldEllipsis as ShieldEllipsisIcon };

/** Drawn locally: Reicon has no Signal glyph. */
export const Signal = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("Signal", {
    O: '<path d="M4 20h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 20v-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 20v-8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 20V8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 20V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { Signal as SignalIcon };

/** Drawn locally: Reicon has no Square glyph. */
export const Square = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("Square", {
    O: '<rect x="3.25" y="3.25" width="17.5" height="17.5" rx="4.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    F: '<rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="currentColor"/>',
  })
);
export { Square as SquareIcon };

/** Drawn locally: Reicon has no Workflow glyph. */
export const Workflow = /*#__PURE__*/ decorative(
  /*#__PURE__*/ createIcon("Workflow", {
    O: '<rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 11v3a3 3 0 0 0 3 3h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  })
);
export { Workflow as WorkflowIcon };
