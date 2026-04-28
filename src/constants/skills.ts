export const SKILL_CATEGORIES = {
  'Software Engineering': [
    'Frontend Development', 'Backend Development', 'Full Stack Development',
    'Mobile Development', 'Flutter', 'React / Next.js', 'Vue.js', 'Angular',
    'Node.js', 'PHP / Laravel', 'Python / Django / FastAPI', 'Java / Spring',
    'Go (Golang)', 'Rust', 'TypeScript', 'JavaScript'
  ],
  'Design & Creative': [
    'UI/UX Design', 'Graphic Design', 'Motion Graphics', 'Product Design',
    'Brand Identity', 'Figma / Adobe XD', 'Adobe Photoshop', 'Adobe Illustrator'
  ],
  'Data & AI': [
    'Data Science', 'Data Analytics', 'Machine Learning', 'Artificial Intelligence',
    'Deep Learning', 'Natural Language Processing', 'Computer Vision',
    'Big Data', 'SQL / NoSQL Databases'
  ],
  'DevOps & Infrastructure': [
    'DevOps', 'Cloud Computing (AWS/GCP/Azure)', 'Docker', 'Kubernetes',
    'CI/CD Pipelines', 'System Administration', 'Terraform', 'Serverless'
  ],
  'Cybersecurity': [
    'Ethical Hacking', 'Network Security', 'Application Security',
    'Penetration Testing', 'Incident Response', 'Security Compliance'
  ],
  'Professional & Others': [
    'Project Management', 'Technical Writing', 'Research & Documentation',
    'Community Building', 'Public Speaking', 'Open Source Contributor'
  ]
};

export type SkillCategory = keyof typeof SKILL_CATEGORIES;
