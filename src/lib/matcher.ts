type ProfileExperience = { company?: string; title?: string; location?: string; startDate?: string; endDate?: string; current?: boolean; bullets?: string[] };

const CANONICAL: Record<string, string[]> = {
  aws: ['aws','amazon web services','ec2','vpc','iam','rds','eks','route53','alb'],
  azure: ['azure','microsoft azure','aks','azure devops'],
  gcp: ['gcp','google cloud','google cloud platform','gke'],
  docker: ['docker','docker compose','containerization'],
  kubernetes: ['kubernetes','k8s','eks','aks','gke'],
  terraform: ['terraform','iac','infrastructure as code'],
  ansible: ['ansible'],
  jenkins: ['jenkins'],
  github_actions: ['github actions'],
  gitlab_ci: ['gitlab ci','gitlab ci/cd'],
  linux: ['linux','ubuntu','centos','red hat','rhel'],
  python: ['python'], javascript: ['javascript','js'], typescript: ['typescript','ts'],
  nodejs: ['node.js','nodejs'], react: ['react','react.js'], nextjs: ['next.js','nextjs'],
  sql: ['sql'], postgresql: ['postgresql','postgres'], mysql: ['mysql'], mongodb: ['mongodb','mongo'], redis: ['redis'],
  nginx: ['nginx'], apache: ['apache'], prometheus: ['prometheus'], grafana: ['grafana'],
  elk: ['elk','elasticsearch','logstash','kibana'], cloudwatch: ['cloudwatch','amazon cloudwatch'],
  git: ['git','github','gitlab','bitbucket'], cicd: ['ci/cd','cicd','continuous integration','continuous delivery'],
  helm: ['helm'], argocd: ['argocd','argo cd'], security: ['security','vulnerability','secrets management'],
  networking: ['networking','tcp/ip','dns','load balancer'],
};

const STOP = new Set(['the','and','for','with','from','that','this','your','you','our','are','will','have','has','not','but','job','role','work','team','years','year','into','using','use','required','requirements','preferred','experience','strong','looking','candidate','including','such','their','they','all','about','more','than','over','under','within','across','through','based','must','should','would','can','able','responsible','responsibilities','skills']);

function normalize(value: unknown) { return String(value || '').toLowerCase().replace(/[–—]/g, '-').replace(/[^a-z0-9+#./ -]/g, ' ').replace(/\s+/g, ' ').trim(); }
function hasTerm(source: string, term: string) { return normalize(source).includes(normalize(term)); }
function label(key: string) { const map: Record<string,string> = { github_actions:'GitHub Actions', gitlab_ci:'GitLab CI/CD', nodejs:'Node.js', nextjs:'Next.js', cicd:'CI/CD', cloudwatch:'CloudWatch', postgresql:'PostgreSQL', mysql:'MySQL', mongodb:'MongoDB', kubernetes:'Kubernetes', terraform:'Terraform', ansible:'Ansible', security:'Security', networking:'Networking' }; return map[key] || key.toUpperCase(); }
function tokenize(value: string) { return normalize(value).split(/\s+/).filter(x => x.length > 2 && !STOP.has(x)); }
function cosine(a: string[], b: string[]) { const av = new Map<string,number>(); const bv = new Map<string,number>(); for (const x of a) av.set(x,(av.get(x)||0)+1); for (const x of b) bv.set(x,(bv.get(x)||0)+1); const keys = new Set([...av.keys(),...bv.keys()]); let dot=0, aa=0, bb=0; for (const k of keys) { const x=av.get(k)||0; const y=bv.get(k)||0; dot+=x*y; aa+=x*x; bb+=y*y; } return aa && bb ? dot/(Math.sqrt(aa)*Math.sqrt(bb)) : 0; }
function sourceText(profile: any) { const ex=Array.isArray(profile.experiences)?profile.experiences:[]; const pr=Array.isArray(profile.projects)?profile.projects:[]; return [profile.headline,profile.summary,...(Array.isArray(profile.skills)?profile.skills:[]),...ex.flatMap((x:ProfileExperience)=>[x.company,x.title,x.location,...(x.bullets||[])]),...pr.flatMap((x:any)=>[x.name,x.description,...(x.technologies||[])]),...(profile.certifications||[]),...(profile.education||[])].filter(Boolean).join(' '); }
function extractCanonical(value: string) { const found:string[]=[]; for (const [key,aliases] of Object.entries(CANONICAL)) if (aliases.some(a=>hasTerm(value,a))) found.push(key); return found; }
function yearsFromExperiences(experiences: ProfileExperience[]) { let months=0; for (const x of experiences) { const start=x.startDate?new Date(`${x.startDate}-01`):null; const end=x.current?new Date():x.endDate?new Date(`${x.endDate}-01`):null; if(start&&end&&!Number.isNaN(start.getTime())&&!Number.isNaN(end.getTime())) months+=Math.max(0,(end.getFullYear()-start.getFullYear())*12+end.getMonth()-start.getMonth()); } return Math.round(months/12*10)/10; }

export function analyzeJob(profile:any,jd:string) {
  const resumeText=sourceText(profile); const jdText=jd.trim();
  const jdSkills=extractCanonical(jdText); const resumeSkills=extractCanonical(resumeText); const resumeSet=new Set(resumeSkills);
  const matched=jdSkills.filter(x=>resumeSet.has(x)); const missing=jdSkills.filter(x=>!resumeSet.has(x));
  const jdTokens=[...new Set(tokenize(jdText))]; const resumeTokens=tokenize(resumeText); const matchedKeywords=jdTokens.filter(x=>resumeTokens.includes(x));
  const keywordCoverage=jdTokens.length?Math.round(matchedKeywords.length/jdTokens.length*100):0;
  const skillCoverage=jdSkills.length?Math.round(matched.length/jdSkills.length*100):0;
  const semanticSimilarity=Math.round(cosine(tokenize(jdText),resumeTokens)*100);
  const experiences:Array<ProfileExperience>=Array.isArray(profile.experiences)?profile.experiences:[];
  const experienceYears=yearsFromExperiences(experiences);
  const yearMatches=[...jdText.matchAll(/(?:minimum of\s+|at least\s+)?(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)/gi)].map(m=>Number(m[1])).filter(Number.isFinite);
  const yearsRequired=yearMatches.sort((a,b)=>b-a)[0]||null;
  const experienceFit=yearsRequired?Math.min(100,Math.round(experienceYears/yearsRequired*100)):100;
  const contactScore=(profile.user?.email?10:0)+(profile.phone?10:0);
  const sectionScore=(profile.summary?5:0)+(Array.isArray(profile.skills)&&profile.skills.length?5:0)+(experiences.length?10:0)+(Array.isArray(profile.education)&&profile.education.length?5:0);
  const atsScore=Math.round(skillCoverage*.4+keywordCoverage*.2+semanticSimilarity*.15+experienceFit*.15+Math.min(100,contactScore+sectionScore)*.1);
  return { matchedSkills:matched.map(label), missingSkills:missing.map(label), atsSkills:jdSkills.map(label), keywordCoverage, skillCoverage, semanticSimilarity, experienceYears, yearsRequired, experienceFit, atsScore, source:'deterministic-local' };
}

export function profileFacts(profile:any) { return { experienceCount:Array.isArray(profile.experiences)?profile.experiences.length:0, projectCount:Array.isArray(profile.projects)?profile.projects.length:0, skillCount:Array.isArray(profile.skills)?profile.skills.length:0, certificationCount:Array.isArray(profile.certifications)?profile.certifications.length:0 }; }