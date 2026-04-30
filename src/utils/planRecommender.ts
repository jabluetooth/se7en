import { UserProfile } from '../types';
import { PLAN_TEMPLATES } from '../data/planTemplates';

interface ScoredTemplate {
  id: string;
  score: number;
}

export function recommendTemplates(profile: UserProfile): string[] {
  const { goal, experience, daysPerWeek, equipment } = profile;

  const scored: ScoredTemplate[] = PLAN_TEMPLATES.map((template) => {
    let score = 0;

    // Equipment is the hardest constraint — penalize mismatches heavily
    if (equipment === 'bodyweight') {
      if (template.tags.equipment.includes('bodyweight')) {
        score += 100;
      } else {
        score -= 500; // bodyweight user cannot use gym templates
      }
    } else if (equipment === 'home_gym') {
      if (template.tags.equipment.includes('home_gym')) {
        score += 80;
      } else if (template.tags.equipment.includes('full_gym')) {
        score -= 30; // home gym user can partially use full gym templates
      }
    } else {
      // full_gym user can use any template
      if (template.tags.equipment.includes('full_gym')) {
        score += 60;
      } else if (template.tags.equipment.includes('home_gym')) {
        score += 20;
      } else if (template.tags.equipment.includes('bodyweight')) {
        score += 10;
      }
    }

    // Days per week — closest match wins, penalize by distance
    const daysDiff = Math.abs(template.tags.daysPerWeek - daysPerWeek);
    if (daysDiff === 0) {
      score += 50;
    } else {
      score -= daysDiff * 15;
    }

    // Experience match
    if (template.tags.experience.includes(experience)) {
      score += 30;
    } else {
      // Slight penalty for under/over qualification
      if (
        experience === 'advanced' &&
        template.tags.experience.includes('intermediate')
      ) {
        score -= 5; // advanced can run intermediate programs
      } else {
        score -= 20;
      }
    }

    // Goal match
    if (template.tags.goal.includes(goal)) {
      score += 25;
    } else if (goal === 'general' || template.tags.goal.includes('general')) {
      score += 5; // general fitness is flexible
    } else {
      score -= 10;
    }

    return { id: template.id, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map((s) => s.id);
}
