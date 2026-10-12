import type { LucideIcon } from "lucide-react";
import {
  Award,
  BarChart3,
  BookOpen,
  Clock,
  FilePlus2,
  FolderOpen,
  LayoutDashboard,
  Package,
  Send,
  Settings,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Match only this exact path (used for section roots like /studio). */
  exact?: boolean;
  badge?: string;
};

export type NavGroup = {
  title?: string;
  items: NavItem[];
};

/** Studio (author / admin) navigation — mirrors the iSpring left rail. */
export const studioNav: NavGroup[] = [
  {
    items: [
      { label: "Nuovo", href: "/studio", icon: FilePlus2, exact: true },
      { label: "Recenti", href: "/studio/recent", icon: Clock },
      { label: "Libreria", href: "/studio/library", icon: FolderOpen },
    ],
  },
  {
    title: "Gestione",
    items: [
      { label: "Candidati", href: "/studio/candidates", icon: Users },
      { label: "Assegnazioni", href: "/studio/assignments", icon: Send },
      { label: "Analytics", href: "/studio/analytics", icon: BarChart3 },
      { label: "SCORM", href: "/studio/scorm", icon: Package },
    ],
  },
  {
    title: "Amministrazione",
    items: [
      { label: "Team", href: "/studio/team", icon: UsersRound },
      { label: "Impostazioni", href: "/studio/settings", icon: Settings },
    ],
  },
];

/** Learner portal navigation. */
export const learnNav: NavGroup[] = [
  {
    items: [
      { label: "Dashboard", href: "/learn", icon: LayoutDashboard, exact: true },
      { label: "I miei corsi", href: "/learn/courses", icon: BookOpen },
      { label: "Certificati", href: "/learn/certificates", icon: Award },
      { label: "Portfolio", href: "/learn/portfolio", icon: UserRound },
    ],
  },
];
