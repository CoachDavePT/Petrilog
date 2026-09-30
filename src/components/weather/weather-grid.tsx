// The six weather tiles of a snapshot (PROJ-3: AC-14, AC-15, EC-6; design.md → „Anzeige der Werte").
// Server-compatible: no hooks, no browser APIs. Tiles on surface-data (Lake), three columns, a missing
// value shows „–". Read as a description list: label = <dt>, reading = <dd> with the full text for
// screen readers.
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Gauge,
  Sun,
  Thermometer,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { weatherTiles, type WeatherTile, type WeatherTileIcon } from '@/lib/weather/format'
import type { WeatherValues } from '@/lib/weather/types'

const ICONS: Record<WeatherTileIcon, LucideIcon> = {
  thermometer: Thermometer,
  gauge: Gauge,
  wind: Wind,
  cloud: Cloud,
  'cloud-rain': CloudRain,
  sun: Sun,
  'cloud-sun': CloudSun,
  'cloud-fog': CloudFog,
  'cloud-drizzle': CloudDrizzle,
  'cloud-snow': CloudSnow,
  'cloud-lightning': CloudLightning,
}

export function WeatherGrid({ values }: { values: WeatherValues }) {
  return (
    <dl className="grid grid-cols-3 gap-2">
      {weatherTiles(values).map((tile) => (
        <WeatherTileCard key={tile.key} tile={tile} />
      ))}
    </dl>
  )
}

function WeatherTileCard({ tile }: { tile: WeatherTile }) {
  const Icon = ICONS[tile.icon]
  // The condition is a word, not a number: smaller, and allowed to wrap („Gefrierender Nieselregen").
  const isText = tile.key === 'condition'
  return (
    <Card className="flex min-w-0 flex-col gap-1.5 rounded-[12px] border-0 bg-lake-100 p-3 text-lake-800 shadow-sm dark:bg-lake-800 dark:text-lake-100 dark:shadow-none">
      <dt className="flex min-w-0 items-center gap-1 text-[12px] font-medium leading-tight">
        <Icon aria-hidden className="size-3.5 shrink-0" />
        <span className="min-w-0 break-words">{tile.label}</span>
      </dt>
      <dd className="m-0 min-w-0">
        <span aria-hidden className="flex flex-wrap items-baseline gap-x-1 break-words hyphens-auto">
          <span
            className={cn(
              'min-w-0 font-medium tabular-nums',
              isText ? 'text-[15px] leading-tight' : 'text-[22px] leading-none',
            )}
          >
            {tile.value}
          </span>
          {tile.unit ? <span className="text-[12px] leading-tight">{tile.unit}</span> : null}
        </span>
        <span className="sr-only">{tile.text}</span>
      </dd>
    </Card>
  )
}
