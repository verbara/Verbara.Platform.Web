export interface TourStep {
  targetSelector: string;
  titleKey: string;
  descriptionKey: string;
  position: 'right' | 'left' | 'bottom';
}

export const TOUR_STEPS: TourStep[] = [
  {
    targetSelector: '[data-tour="inbox"]',
    titleKey: 'agent:tour.inbox',
    descriptionKey: 'agent:tour.inboxDesc',
    position: 'right',
  },
  {
    targetSelector: '[data-tour="conversation"]',
    titleKey: 'agent:tour.chat',
    descriptionKey: 'agent:tour.chatDesc',
    position: 'bottom',
  },
  {
    targetSelector: '[data-tour="context"]',
    titleKey: 'agent:tour.context',
    descriptionKey: 'agent:tour.contextDesc',
    position: 'left',
  },
];
