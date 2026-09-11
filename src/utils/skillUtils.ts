import React from 'react';
import {
  Layers, Search, Palette, Cpu, Zap, BookOpen, Server, Globe,
  Smartphone, Brain, Code, ShieldCheck, Briefcase, Terminal, Sparkles,
  FileText, Database, Cloud, Lock, CheckCircle, Share2, BarChart3,
  Flame, HardDrive, Feather, Compass, Award, Star
} from 'lucide-react';

const sanitizeSkillSlug = (value: string): string | null => {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '');
  return sanitized.length > 0 ? sanitized : null;
};

export const getSkillFallbackIcon = (skillName: string, size: number = 20) => {
  const lowerSkill = (skillName || '').toLowerCase().trim();

  if (lowerSkill.includes('prototyp') || lowerSkill.includes('component')) return React.createElement(Layers, { size });
  if (lowerSkill.includes('research') || lowerSkill.includes('analysis')) return React.createElement(Search, { size });
  if (lowerSkill.includes('visual') || lowerSkill.includes('design') || lowerSkill.includes('ui') || lowerSkill.includes('ux') || lowerSkill.includes('graphic')) return React.createElement(Palette, { size });
  if (lowerSkill.includes('system') || lowerSkill.includes('devops') || lowerSkill.includes('infra') || lowerSkill.includes('architecture')) return React.createElement(Cpu, { size });
  if (lowerSkill.includes('agile') || lowerSkill.includes('scrum') || lowerSkill.includes('fast')) return React.createElement(Zap, { size });
  if (lowerSkill.includes('doc') || lowerSkill.includes('write') || lowerSkill.includes('writing') || lowerSkill.includes('content')) return React.createElement(BookOpen, { size });
  if (lowerSkill.includes('api') || lowerSkill.includes('backend') || lowerSkill.includes('server')) return React.createElement(Server, { size });
  if (lowerSkill.includes('frontend') || lowerSkill.includes('web') || lowerSkill.includes('browser')) return React.createElement(Globe, { size });
  if (lowerSkill.includes('mobile') || lowerSkill.includes('app') || lowerSkill.includes('ios') || lowerSkill.includes('android')) return React.createElement(Smartphone, { size });
  if (lowerSkill.includes('data') || lowerSkill.includes('ai') || lowerSkill.includes('ml') || lowerSkill.includes('learning') || lowerSkill.includes('model')) return React.createElement(Brain, { size });
  if (lowerSkill.includes('sec') || lowerSkill.includes('hack') || lowerSkill.includes('auth')) return React.createElement(Lock, { size });
  if (lowerSkill.includes('database') || lowerSkill.includes('sql') || lowerSkill.includes('db')) return React.createElement(Database, { size });
  if (lowerSkill.includes('cloud')) return React.createElement(Cloud, { size });
  if (lowerSkill.includes('community') || lowerSkill.includes('social')) return React.createElement(Share2, { size });
  if (lowerSkill.includes('verify') || lowerSkill.includes('check')) return React.createElement(CheckCircle, { size });
  if (lowerSkill.includes('budget') || lowerSkill.includes('finance') || lowerSkill.includes('stat')) return React.createElement(BarChart3, { size });

  return React.createElement(Code, { size });
};

export const skillToSlug = (skill: string): string | null => {
  if (!skill) return null;
  const cleanSkill = skill.toLowerCase().trim();

  const exactMap: Record<string, string> = {
    // Languages & Runtimes
    'javascript': 'javascript',
    'typescript': 'typescript',
    'python': 'python',
    'python / django / fastapi': 'python',
    'java': 'oracle',
    'java / spring': 'springboot',
    'c#': 'csharp',
    'c++': 'cplusplus',
    'go': 'go',
    'golang': 'go',
    'go (golang)': 'go',
    'rust': 'rust',
    'php': 'php',
    'php / laravel': 'laravel',
    'ruby': 'ruby',
    'ruby on rails': 'rubyonrails',
    'rails': 'rubyonrails',
    'swift': 'swift',
    'kotlin': 'kotlin',
    'dart': 'dart',
    'elixir': 'elixir',
    'html': 'html5',
    'html5': 'html5',
    'css': 'css3',
    'css3': 'css3',
    'sql': 'mysql',
    '.net': 'dotnet',
    'dotnet': 'dotnet',

    // Frameworks & Libraries
    'react': 'react',
    'react.js': 'react',
    'reactjs': 'react',
    'react / next.js': 'react',
    'react/next.js': 'react',
    'next.js': 'nextdotjs',
    'nextjs': 'nextdotjs',
    'vue': 'vuedotjs',
    'vue.js': 'vuedotjs',
    'vuejs': 'vuedotjs',
    'angular': 'angular',
    'svelte': 'svelte',
    'node': 'nodedotjs',
    'node.js': 'nodedotjs',
    'nodejs': 'nodedotjs',
    'node.js or python': 'nodedotjs',
    'express': 'express',
    'django': 'django',
    'flask': 'flask',
    'fastapi': 'fastapi',
    'spring': 'spring',
    'spring boot': 'springboot',
    'laravel': 'laravel',
    'flutter': 'flutter',
    'react native': 'react',

    // Frontend & UI
    'frontend': 'react',
    'frontend development': 'react',
    'tailwind': 'tailwindcss',
    'tailwind css': 'tailwindcss',
    'tailwindcss': 'tailwindcss',
    'sass': 'sass',
    'less': 'less',
    'bootstrap': 'bootstrap',
    'a11y': 'w3c',
    'accessibility': 'w3c',

    // Backend & Infrastructure
    'backend': 'nodedotjs',
    'backend development': 'nodedotjs',
    'full stack': 'react',
    'full stack development': 'react',
    'fullstack': 'react',
    'api': 'postman',
    'apis': 'postman',
    'api design': 'postman',
    'rest api': 'postman',
    'graphql': 'graphql',
    'apollo': 'apollographql',
    'etl': 'apachespark',

    // Databases & Storage
    'postgresql': 'postgresql',
    'postgres': 'postgresql',
    'mysql': 'mysql',
    'mongodb': 'mongodb',
    'redis': 'redis',
    'sqlite': 'sqlite',
    'supabase': 'supabase',
    'firebase': 'firebase',
    'sql / nosql databases': 'postgresql',
    'databases': 'postgresql',

    // DevOps, Cloud & Tools
    'docker': 'docker',
    'kubernetes': 'kubernetes',
    'k8s': 'kubernetes',
    'devops': 'docker',
    'aws': 'amazonwebservices',
    'amazon web services': 'amazonwebservices',
    'cloud computing (aws/gcp/azure)': 'amazonwebservices',
    'azure': 'microsoftazure',
    'google cloud': 'googlecloud',
    'gcp': 'googlecloud',
    'terraform': 'terraform',
    'ansible': 'ansible',
    'jenkins': 'jenkins',
    'ci/cd pipelines': 'githubactions',
    'github actions': 'githubactions',
    'system administration': 'linux',
    'serverless': 'serverless',
    'linux': 'linux',
    'ubuntu': 'ubuntu',
    'git': 'git',
    'github': 'github',
    'prometheus': 'prometheus',
    'grafana': 'grafana',

    // Mobile
    'mobile': 'flutter',
    'mobile development': 'flutter',
    'ios': 'ios',
    'android': 'android',

    // Data & AI
    'data science': 'python',
    'data analytics': 'tableau',
    'machine learning': 'scikitlearn',
    'artificial intelligence': 'openai',
    'ai': 'openai',
    'ai / ml': 'openai',
    'deep learning': 'pytorch',
    'natural language processing': 'huggingface',
    'nlp': 'huggingface',
    'computer vision': 'opencv',
    'big data': 'apachespark',
    'data pipelines': 'apacheairflow',
    'pipelines': 'apacheairflow',
    'web scraping': 'puppeteer',
    'scraping': 'puppeteer',
    'data processing': 'pandas',

    // Design & Creative
    'figma': 'figma',
    'figma / adobe xd': 'figma',
    'ui/ux': 'figma',
    'ui/ux design': 'figma',
    'graphic design': 'adobe',
    'motion graphics': 'adobeaftereffects',
    'product design': 'sketch',
    'brand identity': 'adobe',
    'adobe photoshop': 'adobephotoshop',
    'photoshop': 'adobephotoshop',
    'adobe illustrator': 'adobeillustrator',
    'illustrator': 'adobeillustrator',
    'adobe xd': 'adobexd',
    'canva': 'canva',
    'info design': 'canva',
    'information design': 'canva',

    // Cybersecurity
    'ethical hacking': 'kalilinux',
    'network security': 'wireshark',
    'application security': 'owasp',
    'penetration testing': 'kalilinux',
    'cybersecurity': 'kalilinux',

    // Management, Writing & Others
    'project management': 'jira',
    'jira': 'jira',
    'trello': 'trello',
    'notion': 'notion',
    'technical writing': 'markdown',
    'writing': 'markdown',
    'research & documentation': 'notion',
    'research': 'notion',
    'community building': 'discourse',
    'community': 'discourse',
    'social media': 'discord',
    'public speaking': 'ted',
    'open source contributor': 'github',
    'budget analysis': 'microsoftexcel',
    'verification': 'microsoftexcel',
    'data verification': 'microsoftexcel',
    'slack': 'slack',
    'discord': 'discord',
    'stripe': 'stripe',
    'wordpress': 'wordpress',
    'webflow': 'webflow',
  };

  if (exactMap[cleanSkill]) return exactMap[cleanSkill];

  // Token fallback search for partial matches
  if (cleanSkill.includes('react')) return 'react';
  if (cleanSkill.includes('typescript')) return 'typescript';
  if (cleanSkill.includes('javascript')) return 'javascript';
  if (cleanSkill.includes('python')) return 'python';
  if (cleanSkill.includes('node')) return 'nodedotjs';
  if (cleanSkill.includes('vue')) return 'vuedotjs';
  if (cleanSkill.includes('figma')) return 'figma';
  if (cleanSkill.includes('docker')) return 'docker';
  if (cleanSkill.includes('postgres')) return 'postgresql';
  if (cleanSkill.includes('mongo')) return 'mongodb';
  if (cleanSkill.includes('aws') || cleanSkill.includes('amazon')) return 'amazonwebservices';
  if (cleanSkill.includes('azure')) return 'microsoftazure';
  if (cleanSkill.includes('google cloud') || cleanSkill.includes('gcp')) return 'googlecloud';
  if (cleanSkill.includes('tailwind')) return 'tailwindcss';
  if (cleanSkill.includes('flutter')) return 'flutter';
  if (cleanSkill.includes('git')) return 'git';
  if (cleanSkill.includes('github')) return 'github';
  if (cleanSkill.includes('laravel')) return 'laravel';
  if (cleanSkill.includes('django')) return 'django';
  if (cleanSkill.includes('spring')) return 'springboot';
  if (cleanSkill.includes('linux')) return 'linux';
  if (cleanSkill.includes('security') || cleanSkill.includes('hack')) return 'kalilinux';

  // Sanitize fallback string
  const fallbackSlug = cleanSkill
    .replace(/development|developer|design|fullstack|frontend|backend|mobile|cloud|\/|\(|\)|\./g, '')
    .trim();

  return sanitizeSkillSlug(fallbackSlug);
};

export const formatExternalUrl = (url?: string) => {
  if (!url) return '#';
  const trimmed = url.trim();
  if (!trimmed) return '#';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};


