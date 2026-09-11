import React from 'react';
import {
  Layers, Search, Palette, Cpu, Zap, BookOpen, Server, Globe,
  Smartphone, Brain, Code, ShieldCheck, Briefcase
} from 'lucide-react';

const sanitizeSkillSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '') || 'code';

const SKILL_CATEGORIES: Record<string, string[]> = {
  'Software Engineering': [],
  'Design & Creative': [],
  'Data & AI': [],
  'DevOps & Infrastructure': [],
  'Cybersecurity': [],
};

export const getSkillFallbackIcon = (skillName: string, size: number = 20) => {
  const lowerSkill = skillName.toLowerCase();
  if (lowerSkill.includes('prototyp')) return React.createElement(Layers, { size });
  if (lowerSkill.includes('research')) return React.createElement(Search, { size });
  if (lowerSkill.includes('visual') || lowerSkill.includes('design')) return React.createElement(Palette, { size });
  if (lowerSkill.includes('system')) return React.createElement(Cpu, { size });
  if (lowerSkill.includes('agile') || lowerSkill.includes('scrum')) return React.createElement(Zap, { size });
  if (lowerSkill.includes('doc') || lowerSkill.includes('write')) return React.createElement(BookOpen, { size });
  if (lowerSkill.includes('api') || lowerSkill.includes('backend')) return React.createElement(Server, { size });
  if (lowerSkill.includes('frontend') || lowerSkill.includes('ui')) return React.createElement(Globe, { size });
  if (lowerSkill.includes('mobile') || lowerSkill.includes('app')) return React.createElement(Smartphone, { size });
  if (lowerSkill.includes('data') || lowerSkill.includes('ai')) return React.createElement(Brain, { size });
  for (const [category] of Object.entries(SKILL_CATEGORIES)) {
    if (category === 'Software Engineering') return React.createElement(Code, { size });
    if (category === 'Design & Creative') return React.createElement(Palette, { size });
    if (category === 'Data & AI') return React.createElement(Brain, { size });
    if (category === 'DevOps & Infrastructure') return React.createElement(Cpu, { size });
    if (category === 'Cybersecurity') return React.createElement(ShieldCheck, { size });
  }
  return React.createElement(Briefcase, { size });
};

export const skillToSlug = (skill: string) => {
  const cleanSkill = skill.toLowerCase().trim();
  
  const map: Record<string, string> = {
    'c#': 'csharp',
    'c++': 'cplusplus',
    'javascript': 'javascript',
    'typescript': 'typescript',
    '.net': 'dotnet',
    'node.js': 'nodedotjs',
    'vue.js': 'vuedotjs',
    'next.js': 'nextdotjs',
    'react': 'react',
    'react / next.js': 'react',
    'react/next.js': 'react',
    'reactnextjs': 'react',
    'artificial intelligence': 'openai',
    'artificialintelligence': 'openai',
    'ai': 'openai',
    'ai / ml': 'openai',
    'api': 'postman',
    'apis': 'postman',
    'rest api': 'postman',
    'svelte': 'svelte',
    'python': 'python',
    'django': 'django',
    'flask': 'flask',
    'java': 'oracle',
    'spring': 'spring',
    'php': 'php',
    'laravel': 'laravel',
    'go': 'go',
    'rust': 'rust',
    'swift': 'swift',
    'kotlin': 'kotlin',
    'flutter': 'flutter',
    'react native': 'react',
    'sql': 'mysql',
    'postgresql': 'postgresql',
    'mongodb': 'mongodb',
    'redis': 'redis',
    'docker': 'docker',
    'kubernetes': 'kubernetes',
    'aws': 'amazonwebservices',
    'amazon web services': 'amazonwebservices',
    'azure': 'microsoftazure',
    'google cloud': 'googlecloud',
    'gcp': 'googlecloud',
    'firebase': 'firebase',
    'supabase': 'supabase',
    'figma': 'figma',
    'adobe xd': 'adobexd',
    'photoshop': 'adobephotoshop',
    'adobe photoshop': 'adobephotoshop',
    'illustrator': 'adobeillustrator',
    'adobe illustrator': 'adobeillustrator',
    'git': 'git',
    'github': 'github',
    'tailwind': 'tailwindcss',
    'tailwind css': 'tailwindcss',
    'sass': 'sass',
    'less': 'less',
    'graphql': 'graphql',
    'apollo': 'apollographql',
    'jenkins': 'jenkins',
    'github actions': 'githubactions',
    'terraform': 'terraform',
    'ansible': 'ansible',
    'prometheus': 'prometheus',
    'grafana': 'grafana',
    'linux': 'linux',
    'ubuntu': 'ubuntu',
    'debian': 'debian',
    'macos': 'macos',
    'windows': 'windows',
    'ios': 'ios',
    'android': 'android',
    'dart': 'dart',
    'elixir': 'elixir',
    'ruby': 'ruby',
    'rails': 'rubyonrails',
    'ruby on rails': 'rubyonrails',
    'unity': 'unity',
    'unreal engine': 'unrealengine',
    'blender': 'blender',
    'sketch': 'sketch',
    'notion': 'notion',
    'slack': 'slack',
    'discord': 'discord',
    'trello': 'trello',
    'jira': 'jira',
    'stripe': 'stripe',
    'paypal': 'paypal',
    'shopify': 'shopify',
    'wordpress': 'wordpress',
    'webflow': 'webflow',
    'wix': 'wix',
    'canva': 'canva',
    'zapier': 'zapier',
  };

  if (map[cleanSkill]) return sanitizeSkillSlug(map[cleanSkill]);

  // Fallback: remove common noise words to find the brand slug
  const fallbackSlug = cleanSkill
    .replace(/development/g, '')
    .replace(/design/g, '')
    .replace(/developer/g, '')
    .replace(/frontend/g, '')
    .replace(/backend/g, '')
    .replace(/fullstack/g, '')
    .replace(/mobile/g, '')
    .replace(/cloud/g, '')
    .replace(/ /g, '')
    .replace(/[ .]/g, '')
    .replace(/\//g, '')
    .trim();

  return sanitizeSkillSlug(fallbackSlug);
};

export const formatExternalUrl = (url?: string) => {
  if (!url) return '#';
  const trimmed = url.trim();
  if (!trimmed) return '#';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

