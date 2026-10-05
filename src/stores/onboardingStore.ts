import { create } from 'zustand'

const STORAGE_KEY = 'ereader-onboarding-dismissed-v1'

function loadDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function saveDismissed() {
  try {
    localStorage.setItem(STORAGE_KEY, 'true')
  } catch { /* ignore */ }
}

interface OnboardingState {
  dismissedPermanently: boolean
  isActive: boolean
  currentStep: number
  pendingNavigation: 'reader' | null
  start: () => void
  /** total = 当前生效步骤集的总步数（两套步骤集长度不同，由 Overlay 传 activeSteps.length） */
  advance: (total: number) => void
  skip: () => void
  dismissForever: () => void
  clearNavigation: () => void
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  dismissedPermanently: loadDismissed(),
  isActive: false,
  currentStep: 0,
  pendingNavigation: null,

  start: () => set({ isActive: true, currentStep: 0 }),

  advance: (total: number) => {
    const { currentStep } = get()
    const next = currentStep + 1
    // Step 4 (start-exploring) → Step 5 (page-turn): signal to navigate to reader
    // （两套步骤集在索引 0–5 上恒同，见 onboardingSteps.ts 的不变量注释）
    if (next === 5) {
      set({ currentStep: next, pendingNavigation: 'reader' })
    } else if (next >= total) {
      // 走完当前这一套的全部步骤 — 只隐藏，不写入持久化
      set({ isActive: false })
    } else {
      set({ currentStep: next })
    }
  },

  skip: () => {
    set({ isActive: false, pendingNavigation: null })
  },

  dismissForever: () => {
    saveDismissed()
    set({ isActive: false, dismissedPermanently: true, pendingNavigation: null })
  },

  clearNavigation: () => set({ pendingNavigation: null }),
}))
