import { Globe, Database, Code, Palette, Cpu, Brain, ShieldCheck, Briefcase, Layers } from 'lucide-react';

export interface Specialization {
  id: string;
  label: string;
  icon: any;
  suggestedSkills: string[];
  requiredSkills: string[];
  minRequiredCount: number;
  validationRules?: {
    type: 'simple' | 'balanced';
    requirements: {
      category: string;
      count: number;
    }[];
  };
}

export const SPECIALIZATIONS: Specialization[] = [
  { 
    id: 'frontend', 
    label: 'Frontend Developer', 
    icon: Globe, 
    suggestedSkills: ['React', 'Next.js', 'Tailwind', 'TypeScript', 'UI Components', 'Responsive Design'],
    requiredSkills: ['React', 'Next.js', 'JavaScript', 'TypeScript', 'HTML/CSS', 'Tailwind CSS', 'UI Components', 'Responsive Design', 'Frontend Development', 'Vue.js', 'Angular', 'Svelte'],
    minRequiredCount: 3
  },
  { 
    id: 'backend', 
    label: 'Backend Developer', 
    icon: Database, 
    suggestedSkills: ['Node.js', 'PostgreSQL', 'API Development', 'Authentication', 'Database Design'],
    requiredSkills: ['Node.js', 'PostgreSQL', 'API Development', 'Authentication', 'Database Design', 'Backend Development', 'PHP / Laravel', 'Python / Django / FastAPI', 'Java / Spring', 'Go (Golang)', 'Rust', 'MongoDB', 'Redis', 'SQL'],
    minRequiredCount: 3
  },
  { 
    id: 'fullstack', 
    label: 'Full Stack Developer', 
    icon: Layers, 
    suggestedSkills: ['React', 'Node.js', 'PostgreSQL', 'API Development', 'TypeScript'],
    requiredSkills: ['React', 'Next.js', 'JavaScript', 'TypeScript', 'HTML/CSS', 'Tailwind CSS', 'Node.js', 'PostgreSQL', 'API Development', 'Authentication', 'Database Design', 'Frontend Development', 'Backend Development', 'Full Stack Development', 'PHP / Laravel', 'Python / Django / FastAPI', 'Java / Spring', 'Go (Golang)', 'Rust', 'MongoDB', 'Redis', 'SQL'],
    minRequiredCount: 4
  },
  { 
    id: 'design', 
    label: 'UI/UX Designer', 
    icon: Palette, 
    suggestedSkills: ['Figma', 'User Research', 'Prototyping', 'Visual Design', 'Design Systems'],
    requiredSkills: ['Figma', 'User Research', 'Prototyping', 'Visual Design', 'Design Systems', 'UI/UX Design', 'Wireframing', 'UX Research', 'Adobe XD', 'Sketch', 'Interaction Design', 'Product Design'],
    minRequiredCount: 3
  },
  { 
    id: 'devops', 
    label: 'DevOps Engineer', 
    icon: Cpu, 
    suggestedSkills: ['Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Terraform', 'Linux'],
    requiredSkills: ['Docker', 'Kubernetes', 'AWS', 'CI/CD', 'Terraform', 'Linux', 'DevOps', 'Cloud Computing (AWS/GCP/Azure)', 'System Administration', 'Serverless', 'Jenkins', 'GitHub Actions', 'Azure DevOps', 'Infrastructure as Code'],
    minRequiredCount: 3
  },
  { 
    id: 'data', 
    label: 'Data & AI Developer', 
    icon: Brain, 
    suggestedSkills: ['Python', 'Machine Learning', 'Data Analysis', 'SQL', 'PyTorch', 'TensorFlow'],
    requiredSkills: ['Python', 'Machine Learning', 'Data Analysis', 'SQL', 'PyTorch', 'TensorFlow', 'Data Science', 'Data Analytics', 'Artificial Intelligence', 'Deep Learning', 'Natural Language Processing', 'Computer Vision', 'Big Data'],
    minRequiredCount: 3
  },
  { 
    id: 'security', 
    label: 'Security Engineer', 
    icon: ShieldCheck, 
    suggestedSkills: ['Ethical Hacking', 'Network Security', 'Penetration Testing', 'Cryptography'],
    requiredSkills: ['Ethical Hacking', 'Network Security', 'Penetration Testing', 'Cryptography', 'Cybersecurity', 'Application Security', 'Incident Response', 'Security Compliance'],
    minRequiredCount: 3
  },
  { 
    id: 'pm', 
    label: 'Project Manager', 
    icon: Briefcase, 
    suggestedSkills: ['Agile', 'Scrum', 'Documentation', 'Product Roadmap', 'Stakeholder Management'],
    requiredSkills: ['Agile', 'Scrum', 'Documentation', 'Product Roadmap', 'Stakeholder Management', 'Project Management', 'Technical Writing', 'Research & Documentation'],
    minRequiredCount: 3
  }
];
