import { UserSkill } from '../types';

export function detectPrimaryRole(skills: UserSkill[]): string {
  if (!skills || skills.length === 0) return 'Contributor';

  const skillNames = skills.map(s => s.name.toLowerCase());

  // Logic based on requirements
  
  // Frontend + Backend -> Full Stack Developer
  if ((skillNames.includes('frontend development') || skillNames.includes('react / next.js')) && 
      (skillNames.includes('backend development') || skillNames.includes('php') || skillNames.includes('python'))) {
    return 'Full Stack Developer';
  }

  // Flutter + Mobile -> Mobile App Developer
  if (skillNames.includes('flutter') || skillNames.includes('mobile')) {
    return 'Mobile App Developer';
  }

  // DevOps + Docker + Kubernetes -> DevOps Engineer
  if (skillNames.includes('devops') || skillNames.includes('docker') || skillNames.includes('kubernetes')) {
    return 'DevOps Engineer';
  }

  // UI/UX + Design -> UI/UX Designer
  if (skillNames.includes('ui/ux design') || skillNames.includes('graphic design')) {
    return 'UI/UX Designer';
  }

  // Cybersecurity + Security Tools -> Cybersecurity Specialist
  if (skillNames.includes('cybersecurity')) {
    return 'Cybersecurity Specialist';
  }

  // Artificial Intelligence + Machine Learning + Data Science
  if (skillNames.includes('artificial intelligence') || skillNames.includes('machine learning') || skillNames.includes('data science')) {
    if (skillNames.includes('data science')) return 'Data Scientist';
    return 'AI/ML Engineer';
  }

  // Frontend Development
  if (skillNames.includes('frontend development') || skillNames.includes('react / next.js')) {
    return 'Frontend Developer';
  }

  // Backend Development
  if (skillNames.includes('backend development') || skillNames.includes('php') || skillNames.includes('python')) {
    return 'Backend Developer';
  }

  // Research + Documentation -> Researcher
  if (skillNames.includes('research & documentation')) {
    return 'Researcher';
  }

  // Community + Organizing -> Community Contributor
  if (skillNames.includes('community building')) {
    return 'Community Contributor';
  }

  // Default fallback
  return 'Contributor';
}
