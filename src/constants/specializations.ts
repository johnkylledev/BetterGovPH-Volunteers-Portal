import { Globe, Database, Code, Palette, Cpu, Brain, ShieldCheck, Briefcase, Layers, Clapperboard, Newspaper, GraduationCap, Scale, Megaphone, FileSearch, HandHeart, HardHat, Ruler, Calculator } from 'lucide-react';

export interface Specialization {
  id: string;
  label: string;
  icon: any;
  suggestedSkills: string[];
  requiredSkills: string[];
  minRequiredCount: number;
  /** Which part of the role picker it sits in. Defaults to 'tech'. */
  group?: 'tech' | 'community' | 'profession';
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
  },

  // Non-tech roles. Civic work needs storytellers, teachers, lawyers and organizers as much as code,
  // so these ask for fewer matching skills (2) to confirm the role.
  {
    id: 'content',
    label: 'Content Creator',
    icon: Clapperboard,
    group: 'community',
    suggestedSkills: ['Video Editing', 'Social Media', 'Content Writing', 'Photography', 'Canva'],
    requiredSkills: ['Video Editing', 'Social Media', 'Content Writing', 'Photography', 'Canva', 'Copywriting', 'Podcasting', 'Livestreaming', 'Illustration', 'Graphic Design', 'Motion Graphics'],
    minRequiredCount: 2
  },
  {
    id: 'writer',
    label: 'Writer & Journalist',
    icon: Newspaper,
    group: 'community',
    suggestedSkills: ['Writing', 'Journalism', 'Fact-Checking', 'Editing & Proofreading', 'Translation (Filipino/English)'],
    requiredSkills: ['Writing', 'Journalism', 'Fact-Checking', 'Editing & Proofreading', 'Translation (Filipino/English)', 'Content Writing', 'Copywriting', 'Technical Writing', 'Research & Documentation'],
    minRequiredCount: 2
  },
  {
    id: 'educator',
    label: 'Educator & Trainer',
    icon: GraduationCap,
    group: 'community',
    suggestedSkills: ['Teaching', 'Curriculum Design', 'Workshop Facilitation', 'Public Speaking', 'Digital Literacy Training'],
    requiredSkills: ['Teaching', 'Curriculum Design', 'Workshop Facilitation', 'Public Speaking', 'Digital Literacy Training', 'Mentoring', 'Documentation'],
    minRequiredCount: 2
  },
  {
    id: 'legal',
    label: 'Lawyer & Policy Expert',
    icon: Scale,
    group: 'community',
    suggestedSkills: ['Legal Research', 'Policy Analysis', 'Legislative Drafting', 'Data Privacy (DPA)', 'FOI Requests'],
    requiredSkills: ['Legal Research', 'Policy Analysis', 'Legislative Drafting', 'Data Privacy (DPA)', 'FOI Requests', 'Contract Review', 'Policy Research'],
    minRequiredCount: 2
  },
  {
    id: 'advocate',
    label: 'Advocate & Organizer',
    icon: Megaphone,
    group: 'community',
    suggestedSkills: ['Community Organizing', 'Campaign Strategy', 'Volunteer Coordination', 'Social Media', 'Event Organizing'],
    requiredSkills: ['Community Organizing', 'Campaign Strategy', 'Volunteer Coordination', 'Social Media', 'Event Organizing', 'Grassroots Outreach', 'Fundraising', 'Community Building', 'Public Speaking'],
    minRequiredCount: 2
  },
  {
    id: 'researcher',
    label: 'Researcher & Analyst',
    icon: FileSearch,
    group: 'community',
    suggestedSkills: ['Policy Research', 'Budget Analysis', 'Data Analysis', 'Survey Design', 'Fact-Checking'],
    requiredSkills: ['Policy Research', 'Budget Analysis', 'Data Analysis', 'Survey Design', 'Fact-Checking', 'Research & Documentation', 'Data Analytics', 'Writing'],
    minRequiredCount: 2
  },
  {
    id: 'general',
    label: 'General Volunteer',
    icon: HandHeart,
    group: 'community',
    suggestedSkills: ['Volunteer Coordination', 'Translation (Filipino/English)', 'Event Organizing', 'Social Media'],
    requiredSkills: [
      'Volunteer Coordination', 'Translation (Filipino/English)', 'Event Organizing', 'Social Media', 'Community Organizing',
      'Community Building', 'Writing', 'Teaching', 'Mentoring', 'Fundraising', 'Grassroots Outreach', 'Photography',
      'Public Speaking', 'Documentation', 'Research & Documentation', 'Project Management'
    ],
    minRequiredCount: 1
  },

  // Licensed and other professions. Public data is about roads, buildings and budgets as much as it
  // is about code: an engineer can say whether an infrastructure dataset is plausible, an accountant
  // whether a budget adds up. Two matching skills confirm the role, as with the community roles.
  {
    id: 'engineer',
    label: 'Engineer',
    icon: HardHat,
    group: 'profession',
    suggestedSkills: ['Civil Engineering', 'Structural Engineering', 'Construction Management', 'CAD / BIM', 'Occupational Safety'],
    requiredSkills: [
      'Civil Engineering', 'Structural Engineering', 'Mechanical Engineering', 'Electrical Engineering',
      'Geodetic Engineering & Surveying', 'Construction Management', 'CAD / BIM', 'Environmental Planning',
      'Occupational Safety', 'GIS & Mapping'
    ],
    minRequiredCount: 2
  },
  {
    id: 'architect',
    label: 'Architect & Urban Planner',
    icon: Ruler,
    group: 'profession',
    suggestedSkills: ['Architecture', 'Urban & Regional Planning', 'CAD / BIM', 'GIS & Mapping', 'Environmental Planning'],
    requiredSkills: [
      'Architecture', 'Urban & Regional Planning', 'CAD / BIM', 'GIS & Mapping', 'Environmental Planning',
      'Construction Management', 'Civil Engineering'
    ],
    minRequiredCount: 2
  },
  {
    id: 'accountant',
    label: 'Accountant & Auditor',
    icon: Calculator,
    group: 'profession',
    suggestedSkills: ['Accounting', 'Auditing', 'Budget Analysis', 'Financial Reporting', 'Government Procurement'],
    requiredSkills: [
      'Accounting', 'Bookkeeping', 'Auditing', 'Internal Controls', 'Financial Reporting', 'Taxation (BIR)',
      'Government Procurement', 'Grants & Compliance', 'Budget Analysis', 'Data Analytics'
    ],
    minRequiredCount: 2
  }
];

/** The parts of the role picker, so non-tech volunteers find their place without scrolling past code roles. */
export const ROLE_GROUPS = [
  { id: 'tech', label: 'Tech & design' },
  { id: 'community', label: 'Community, content & policy' },
  { id: 'profession', label: 'Engineering, planning & finance' },
] as const;
