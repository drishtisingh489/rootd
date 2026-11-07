// Mirrors the FastAPI response shapes (backend/app/main.py, verdict.py, insights.py).

export type Verdict = 'red' | 'yellow' | 'green' | 'unknown'
export type ItemStatus = 'red' | 'yellow' | 'green' | 'gray'

export type GroupId =
  | 'allergens'
  | 'dietary_patterns'
  | 'dietary_restrictions'
  | 'religious_dietary_requirements'
  | 'nutrition_goals'
  | 'ethical_values'
  | 'environmental_priorities'

export type Level = 'preference' | 'strict' | 'important' | 'must_have'

export interface Preferences {
  allergens: string[]
  dietary_patterns: string[]
  dietary_restrictions: string[]
  religious_dietary_requirements: string[]
  nutrition_goals: string[]
  ethical_values: string[]
  environmental_priorities: string[]
  allergy_cross_contact: boolean
  levels: Record<string, Level>
}

export interface Profile {
  display_name: string
  email: string
  phone: string
  profile_image_url: string
  preferences: Preferences
  onboarding_completed: boolean
  updated_at: string
}

export interface ProfileUpdate {
  display_name?: string
  email?: string
  phone?: string
  profile_image_url?: string
  preferences?: Preferences
  onboarding_completed?: boolean
}

export interface EvidenceSource {
  title: string
  publisher?: string
  url: string | null
  checked_at?: string | null
  record_details?: Record<string, string | null | undefined>
}

export interface BreakdownItem {
  id: string
  group: string
  label: string
  status: ItemStatus
  short_reason: string
  detail: string
  evidence_level: 'verified' | 'partial' | 'estimated' | 'unknown'
  evidence_sources: EvidenceSource[]
  no_source_note: string | null
  hard: boolean
}

export interface OverallResult {
  status: Verdict
  label: string
  alignment_score: number | null
  score_label: string
  summary_short: string
  summary_points: string[]
  counts?: Record<ItemStatus, number>
}

export interface RecallCheck {
  status: 'verified_match' | 'past_recall' | 'possible_match' | 'no_match_found' | 'not_verified'
  verdict: ItemStatus
  checked_at: string
  message: string
  sources: EvidenceSource[]
  coverage_note: string
}

export interface ScanProduct {
  name: string
  brand: string
  barcode: string | null
  package_size: string | null
  variant: string | null
  image_url: string | null
  identity_confirmed: boolean
  data_source: string | null
  source_url: string | null
}

export interface Scan {
  scan_id: string
  product: ScanProduct
  overall_result: OverallResult
  preference_breakdown: BreakdownItem[]
  recall_check: RecallCheck
  sources: EvidenceSource[]
  data_gaps: string[]
  is_demo: boolean
  created_at: string
}

export interface Candidate {
  name: string
  brand: string
  variant: string | null
  package_size: string | null
  barcode: string | null
  confidence: number
}

export interface Identification {
  candidates: Candidate[]
  visible_text: string | null
  visible_ingredients: string | null
  cannot_determine: string[]
  ambiguity_notes: string | null
  is_food_product: boolean
}

export interface ProductMatch {
  name: string
  brand: string
  barcode: string | null
  package_size: string | null
  image_url: string | null
  source_url: string | null
}

export interface DemoProduct {
  id: string
  name: string
  brand: string
  package_size: string
}

export interface AnalyzeRequest {
  name?: string
  brand?: string
  barcode?: string | null
  package_size?: string | null
  variant?: string | null
  visible_ingredients?: string | null
  demo_fixture_id?: string
}

export interface DailyBranch {
  id: string
  headline: string
  summary: string
  source_title: string
  publisher: string
  source_url: string
  published_at: string
  topic_tags: string[]
  media_type: string
  verified_at: string
  context_label: string
}

export type ValueStatus = 'strong' | 'needs_attention' | 'more_data_needed'

export interface InsightEntry {
  scan_id: string
  product: string | null
  item: BreakdownItem
}

export interface Insights {
  period_days: number
  alignment: { percent: number | null; aligned: number; rated: number; unknown: number; definition: string }
  counts: { scans: number; aligned_scans: number }
  values: { id: string; label: string; status: ValueStatus; checked_scans: number }[]
  topics: { id: string; title: string; subtitle: string; count: number }[]
  details: {
    deforestation: InsightEntry[]
    'food-safety': InsightEntry[]
    evidence: {
      sources: (EvidenceSource & { scan_id: string; product: string | null })[]
      gaps: { scan_id: string; product: string | null; gap: string }[]
    }
  }
  milestones: {
    id: string
    title: string
    description: string
    achieved: boolean
    achieved_at: string | null
    scan_id: string | null
    progress: number
    target: number
  }[]
  disclaimer: string
}
