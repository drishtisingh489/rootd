import {
  Ban,
  CircleQuestionMark,
  ThumbsUp,
  TriangleExclamationPoint,
  type LucideIcon,
} from 'lucide-react'
import type { ItemStatus, Verdict } from '../types'

export interface StatusMeta {
  label: string
  short: string
  tone: 'green' | 'yellow' | 'red' | 'gray'
  Icon: LucideIcon
}

export const VERDICT_META: Record<Verdict, StatusMeta> = {
  green: { label: 'Good Match', short: 'Good Match', tone: 'green', Icon: ThumbsUp },
  yellow: { label: 'Mixed Fit', short: 'Mixed Fit', tone: 'yellow', Icon: TriangleExclamationPoint },
  red: { label: 'Strong Conflict', short: 'Conflict', tone: 'red', Icon: Ban },
  unknown: { label: 'Insufficient Data', short: 'Unknown', tone: 'gray', Icon: CircleQuestionMark },
}

export const ITEM_META: Record<ItemStatus, StatusMeta> = {
  green: { label: 'Aligned', short: 'Aligned', tone: 'green', Icon: ThumbsUp },
  yellow: { label: 'Caution', short: 'Caution', tone: 'yellow', Icon: TriangleExclamationPoint },
  red: { label: 'Conflict', short: 'Conflict', tone: 'red', Icon: Ban },
  gray: { label: 'Unknown', short: 'Unknown', tone: 'gray', Icon: CircleQuestionMark },
}

export const EVIDENCE_LEVEL: Record<string, string> = {
  verified: 'Verified product record',
  partial: 'Partial evidence',
  estimated: 'Estimate',
  unknown: 'Not enough data',
}
