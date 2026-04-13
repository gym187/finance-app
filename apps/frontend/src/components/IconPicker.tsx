'use client';

import { useState, useMemo } from 'react';
import {
  Briefcase, Laptop, TrendingUp, Utensils, Car, Heart, Gamepad2,
  Book, Home, MoreHorizontal, ShoppingCart, Gift, Plane, Music,
  Coffee, Wifi, Phone, Tv, Shirt, Baby, Dog, Dumbbell, Pill,
  Banknote, CreditCard, PiggyBank, Wallet, Receipt, Building2,
  Lightbulb, Droplets, Flame, Bus, Fuel, Wrench, Scissors, Film,
  Camera, Palette, GraduationCap, Stethoscope, Scale, Gavel, Bike,
  TreePine, Umbrella, Snowflake, Sun, Moon, Star, Zap, Globe, MapPin,
  type LucideIcon,
} from 'lucide-react';

export interface IconOption {
  name: string;
  icon: LucideIcon;
}

export const ICON_OPTIONS: IconOption[] = [
  { name: 'briefcase', icon: Briefcase },
  { name: 'laptop', icon: Laptop },
  { name: 'trending-up', icon: TrendingUp },
  { name: 'utensils', icon: Utensils },
  { name: 'car', icon: Car },
  { name: 'heart', icon: Heart },
  { name: 'gamepad-2', icon: Gamepad2 },
  { name: 'book', icon: Book },
  { name: 'home', icon: Home },
  { name: 'more-horizontal', icon: MoreHorizontal },
  { name: 'shopping-cart', icon: ShoppingCart },
  { name: 'gift', icon: Gift },
  { name: 'plane', icon: Plane },
  { name: 'music', icon: Music },
  { name: 'coffee', icon: Coffee },
  { name: 'wifi', icon: Wifi },
  { name: 'phone', icon: Phone },
  { name: 'tv', icon: Tv },
  { name: 'shirt', icon: Shirt },
  { name: 'baby', icon: Baby },
  { name: 'dog', icon: Dog },
  { name: 'dumbbell', icon: Dumbbell },
  { name: 'pill', icon: Pill },
  { name: 'banknote', icon: Banknote },
  { name: 'credit-card', icon: CreditCard },
  { name: 'piggy-bank', icon: PiggyBank },
  { name: 'wallet', icon: Wallet },
  { name: 'receipt', icon: Receipt },
  { name: 'building-2', icon: Building2 },
  { name: 'lightbulb', icon: Lightbulb },
  { name: 'droplets', icon: Droplets },
  { name: 'flame', icon: Flame },
  { name: 'bus', icon: Bus },
  { name: 'fuel', icon: Fuel },
  { name: 'wrench', icon: Wrench },
  { name: 'scissors', icon: Scissors },
  { name: 'film', icon: Film },
  { name: 'camera', icon: Camera },
  { name: 'palette', icon: Palette },
  { name: 'graduation-cap', icon: GraduationCap },
  { name: 'stethoscope', icon: Stethoscope },
  { name: 'scale', icon: Scale },
  { name: 'gavel', icon: Gavel },
  { name: 'bike', icon: Bike },
  { name: 'tree-pine', icon: TreePine },
  { name: 'umbrella', icon: Umbrella },
  { name: 'snowflake', icon: Snowflake },
  { name: 'sun', icon: Sun },
  { name: 'moon', icon: Moon },
  { name: 'star', icon: Star },
  { name: 'zap', icon: Zap },
  { name: 'globe', icon: Globe },
  { name: 'map-pin', icon: MapPin },
];

const ICON_MAP = new Map(ICON_OPTIONS.map((o) => [o.name, o.icon]));

export function getIconComponent(name?: string | null): LucideIcon | null {
  if (!name) return null;
  return ICON_MAP.get(name) ?? null;
}

interface IconPickerProps {
  value?: string;
  onChange: (iconName: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return ICON_OPTIONS;
    const q = search.toLowerCase();
    return ICON_OPTIONS.filter((o) => o.name.includes(q));
  }, [search]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar ícone..."
        className="w-full rounded-lg border bg-background px-3 py-1.5 text-sm outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
      <div className="grid max-h-40 grid-cols-6 gap-1 overflow-y-auto rounded-lg border p-2 sm:grid-cols-8">
        {filtered.map((opt) => {
          const Icon = opt.icon;
          const isSelected = value === opt.name;
          return (
            <button
              key={opt.name}
              type="button"
              title={opt.name}
              onClick={() => onChange(opt.name)}
              className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-accent ${
                isSelected ? 'bg-primary text-primary-foreground' : ''
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-8 py-2 text-center text-xs text-muted-foreground">
            Nenhum ícone encontrado
          </p>
        )}
      </div>
    </div>
  );
}
