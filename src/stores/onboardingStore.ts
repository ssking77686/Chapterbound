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
  advance: () => void
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

  advance: () => {
    const { currentStep } = get()
    const next = currentStep + 1
    // Step 4 (start-exploring) → Step 5 (page-turn): signal to navigate to reader
    if (next === 5) {
      set({ currentStep: next, pendingNavigation: 'reader' })
    } else if (next >= 9) {
      // All 9 steps done — just hide, don't persist
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
