import { type MouseEvent } from "react";
import { Link } from "wouter";
import { LayoutGrid } from "lucide-react";
import { SidebarHeader } from "@/components/ui/sidebar";

export interface SidebarProjectHeaderProps {
  handleLinkClick: (event?: MouseEvent, href?: string) => void;
  projectName: string | undefined;
  username: string | undefined;
  visibleRole: string | null;
}

export function SidebarProjectHeader({
  handleLinkClick,
  projectName,
  username,
  visibleRole,
}: SidebarProjectHeaderProps) {
  return (
    <SidebarHeader className="p-4 border-b border-white/10 bg-[#1e293b]">
              <Link
                href="/projects"
                onClick={(event) => handleLinkClick(event, "/projects")}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity mb-4 group"
              >
                <div className="bg-primary/20 p-2 rounded-lg group-hover:bg-primary/30 transition-colors">
                  <LayoutGrid className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider block leading-none mb-1">
                    Workspace
                  </span>
                  <h1 className="font-bold text-sm truncate max-w-[140px] leading-tight text-white">
                    {projectName || "Loading..."}
                  </h1>
                </div>
              </Link>
    
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="truncate opacity-80 text-white/80">
                  {username}
                </span>
                {visibleRole ? (
                  <span className="ml-auto rounded border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/50">
                    {visibleRole}
                  </span>
                ) : null}
              </div>
            </SidebarHeader>
  );
}
