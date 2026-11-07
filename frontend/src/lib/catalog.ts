import raw from '../../../shared/preferences.json'
import type { GroupId, Level, Preferences } from '../types'

export interface CatalogOption {
  id: string
  label: string
  exclusive?: boolean
}

export interface CatalogGroup {
  id: GroupId
  title: string
  note?: string
  level_type: 'strictness' | 'importance' | null
  allow_other: boolean
  toggle?: { id: 'allergy_cross_contact'; label: string }
  options: CatalogOption[]
}

export interface CatalogCategory {
  id: string
  title: string
  hint: string
  icon: string
  groups: CatalogGroup[]
}

interface Catalog {
  levels: Record<'strictness' | 'importance', { id: Level; label: string }[]>
  categories: CatalogCategory[]
}

/** The same catalog the backend validates against (shared/preferences.json). */
export const catalog = raw as unknown as Catalog

export const OTHER_PREFIX = 'other:'

export const GROUP_IDS: GroupId[] = [
  'allergens',
  'dietary_patterns',
  'dietary_restrictions',
  'religious_dietary_requirements',
  'nutrition_goals',
  'ethical_values',
  'environmental_priorities',
]

export function emptyPreferences(): Preferences {
  return {
    allergens: [],
    dietary_patterns: [],
    dietary_restrictions: [],
    religious_dietary_requirements: [],
    nutrition_goals: [],
    ethical_values: [],
    environmental_priorities: [],
    allergy_cross_contact: false,
    levels: {},
  }
}

export function clonePreferences(prefs: Preferences | null | undefined): Preferences {
  const base = emptyPreferences()
  if (!prefs) return base
  for (const g of GROUP_IDS) base[g] = [...(prefs[g] ?? [])]
  base.allergy_cross_contact = Boolean(prefs.allergy_cross_contact)
  base.levels = { ...(prefs.levels ?? {}) }
  return base
}

export function optionLabel(groupId: GroupId, optionId: string): string {
  if (optionId.startsWith(OTHER_PREFIX)) return optionId.slice(OTHER_PREFIX.length)
  for (const cat of catalog.categories) {
    for (const group of cat.groups) {
      if (group.id === groupId) return group.options.find((o) => o.id === optionId)?.label ?? optionId
    }
  }
  return optionId
}

export function categoryCount(category: CatalogCategory, prefs: Preferences): number {
  return category.groups.reduce((n, g) => n + prefs[g.id].length, 0)
}

export function totalSelected(prefs: Preferences): number {
  return GROUP_IDS.reduce((n, g) => n + prefs[g].length, 0)
}

export function samePreferences(a: Preferences, b: Preferences): boolean {
  const norm = (p: Preferences) =>
    JSON.stringify({
      ...Object.fromEntries(GROUP_IDS.map((g) => [g, [...p[g]].sort()])),
      x: p.allergy_cross_contact,
      l: Object.entries(p.levels).sort(),
    })
  return norm(a) === norm(b)
}
