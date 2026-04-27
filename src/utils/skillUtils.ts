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
    'angular': 'angular',
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

  if (map[cleanSkill]) return map[cleanSkill];

  // Fallback: remove common noise words to find the brand slug
  return cleanSkill
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
};
