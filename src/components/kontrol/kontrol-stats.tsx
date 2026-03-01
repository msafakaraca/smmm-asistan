/**
 * KontrolStats Component
 *
 * Mükellef istatistiklerini gösteren badge'ler.
 */

import { Badge } from "@/components/ui/badge";
import type { KontrolStats } from "./types";

interface KontrolStatsProps {
  stats: KontrolStats;
}

export function KontrolStatsDisplay({ stats }: KontrolStatsProps) {
  return (
    <div className="hidden md:flex items-center gap-4 text-sm">
      <div className="flex items-center gap-1">
        <Badge variant="default">{stats.firma}</Badge>
        <span className="text-muted-foreground">Firma</span>
      </div>
      <div className="flex items-center gap-1">
        <Badge variant="secondary">{stats.sahis}</Badge>
        <span className="text-muted-foreground">Şahıs</span>
      </div>
      <div className="flex items-center gap-1">
        <Badge variant="outline">{stats.basit}</Badge>
        <span className="text-muted-foreground">B.Usul</span>
      </div>
    </div>
  );
}
