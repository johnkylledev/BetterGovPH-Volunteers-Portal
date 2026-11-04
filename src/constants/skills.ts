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
  'Content & Media': [
    'Video Editing', 'Social Media', 'Content Writing', 'Photography', 'Canva',
    'Copywriting', 'Podcasting', 'Livestreaming', 'Illustration'
  ],
  'Writing & Research': [
    'Writing', 'Journalism', 'Fact-Checking', 'Editing & Proofreading',
    'Translation (Filipino/English)', 'Policy Research', 'Budget Analysis', 'Survey Design'
  ],
  'Education & Training': [
    'Teaching', 'Curriculum Design', 'Workshop Facilitation', 'Public Speaking',
    'Digital Literacy Training', 'Mentoring'
  ],
  'Law & Policy': [
    'Legal Research', 'Policy Analysis', 'Legislative Drafting', 'Data Privacy (DPA)',
    'FOI Requests', 'Contract Review'
  ],
  'Advocacy & Community': [
    'Community Organizing', 'Campaign Strategy', 'Volunteer Coordination', 'Event Organizing',
    'Grassroots Outreach', 'Fundraising', 'Community Building'
  ],
  'Professional & Others': [
    'Project Management', 'Technical Writing', 'Research & Documentation',
    'Open Source Contributor'
  ]
};

export type SkillCategory = keyof typeof SKILL_CATEGORIES;
