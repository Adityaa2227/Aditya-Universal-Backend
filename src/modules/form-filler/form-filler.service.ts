// ============================================================================
// Form Filler Module - Single-Call AI Auto-Fill Service
// Processes the entire form in ONE single AI call using Aditya Agarwal's full resume
// ============================================================================

import { CandidateProfile, FillFieldResponse, BatchFillRequest, BatchFillResponse } from './form-filler.types';
import { executeFormFillerFallbackText, AIProviderConfig } from './form-filler.ai';
import { logger } from '../../core/utils/logger';

export const ADITYA_FULL_RESUME_TEXT = `
ADITYA AGARWAL
Software Development Engineer (SDE) | Full Stack Developer | Backend Developer | Software Engineer (SWE)
Phone: +91 9508664027
Email: adityaagar324@gmail.com
Location: Garhwa, Jharkhand, India (Open to Relocation)
LinkedIn: https://www.linkedin.com/in/aditya2227/
GitHub: https://github.com/Adityaa2227
LeetCode: https://leetcode.com/u/aditya2227
Portfolio: https://adityaagarwalportfolio.vercel.app/

PROFESSIONAL SUMMARY
Software Engineer and final-year B.Tech Computer Science student (CGPA 8.7/10, graduating 2027) with hands-on full stack and backend experience in Java, Node.js, React.js, REST APIs, SQL/NoSQL databases, and Generative AI (LLM APIs, RAG, prompt engineering). Software Engineer Intern at PayPal; shipped production apps including JobGrid (500+ daily users). 1000+ DSA problems solved; hackathon team lead.

TECHNICAL SKILLS
- Languages: Java, C++, C, JavaScript, TypeScript, SQL
- Backend & APIs: Node.js, Express.js, Spring Boot, RESTful APIs, Microservices, Authentication and Authorization (JWT, OAuth 2.0, RBAC), bcrypt, CORS, Middleware, WebSockets (Socket.io), Rate Limiting, Cron Jobs, Web Scraping, Razorpay API, WhatsApp API, Telegram Bot API
- Databases: MySQL, PostgreSQL, MongoDB (Mongoose), Redis, Firebase
- Frontend: React.js, Next.js, Redux, HTML5, CSS3, Responsive Design, Tailwind CSS, Bootstrap, Chakra UI
- Cloud & DevOps: AWS, Docker, Kubernetes, CI/CD (TeamCity, Octopus Deploy), Terraform (Infrastructure as Code), Vercel, Render
- Testing: Unit Testing, API Testing, Test Automation, JUnit, TestNG, RestAssured, Cucumber (BDD), Feign, Postman
- Generative AI: LLM API Integration (Groq, Gemini, Claude), Prompt Engineering, RAG, Embeddings, Vector Databases, Claude Code, MCP
- CS Fundamentals: Data Structures and Algorithms (DSA), Object-Oriented Programming (OOP), System Design, Low-Level Design (LLD), High-Level Design (HLD), Database Management Systems (DBMS), Operating Systems, Computer Networks
- Practices & Tools: Agile, Scrum, Code Reviews, Technical Documentation, Git, GitHub, Jira, Vite
- Familiar With: Python, Linux, Bash, Maven, Gradle, Splunk, Datadog

PROFESSIONAL EXPERIENCE
1. Software Engineer (SWE) Intern – PayPal (May 2026 – Aug 2026)
   Credit (Buy Now, Pay Later) Team, Bangalore, India
   - Migrated 100+ functional test scenarios from TestNG and RestAssured to Cucumber (BDD) with Feign clients in Java, adding multi-tenant API test automation coverage across Apache Fineract services.
   - Reduced flaky CI test failures to 0% by fixing timezone mismatches between tenants (UTC vs partner-product timezone) in functional tests.
   - Created a PR reviewer assignment and workload-checker tool across 23+ repositories that suggests reviewers and sends pending-review DM reminders.
   - Integrated Claude (AI) into the review workflow to generate code review feedback and requested changes on pull requests.
   - Analyzed 25+ CI builds to identify recurring failure windows and developed Jira JQL dashboards to triage and track live issues.
   - Collaborated in an Agile/Scrum team using Jira and Git pull-request code reviews, and maintained technical documentation.

2. React Developer Intern – NS Apps Innovation (Jan 2026 – May 2026)
   Bihar Government Projects and ERP Platform, Patna, Bihar, India (Hybrid)
   - Developed a contractor ERP platform covering materials, costs, bills, and expenses, with a mobile-friendly interface for workers to track usage.
   - Automated delivery of bills and purchase orders to suppliers through the WhatsApp API.
   - Secured multiple Bihar government projects with Role-Based Access Control (RBAC) and delivered responsive portals and admin dashboards, including Bihar Films, using React.js and JavaScript.
   - Created interactive puzzle games for Bihar Diwas and implemented validated form workflows connected to REST APIs.

PROJECTS
1. JobGrid – AI-Powered Engineering Job Portal (March 2026)
   Tech Stack: Next.js 15, React.js, Node.js, Express.js, MongoDB, Groq AI (Llama 3), Telegram Bot, Capacitor
   - Built and deployed a full stack AI job portal aggregating listings from 10+ sources via scrapers, a Telegram bot, and cron-scheduled ingestion, serving 500+ daily users.
   - Integrated Groq (Llama 3) LLM API with crafted system/user prompts to auto-parse job descriptions for smart filters and AI recommendations.
   - Added a real-time analytics dashboard, community forum, admin moderation panel, and Capacitor mobile app with push notifications.

2. FlexPass – Pay-Per-Use Microservices Marketplace (June 2025)
   Tech Stack: React.js, Node.js, Express.js, MongoDB, Redis, Socket.io, JWT, Google OAuth 2.0, Razorpay, Groq AI
   - Architected a pay-per-use marketplace with a unified wallet and Razorpay integration, supporting 5+ digital service types with usage-based access control via a Node.js/Express.js REST API.
   - Introduced Redis distributed locking and rate limiting, eliminating wallet race conditions and cutting unauthorized auth attempts by 80%.
   - Established JWT, Google OAuth 2.0, and email OTP authentication with real-time usage tracking, cutting invalid session errors by 60%.
   - Delivered a real-time admin dashboard (Recharts), referral system, and Socket.io live support chat with Groq AI.

3. WhereIsMyBitBus – Real-Time Bus Tracking Platform (May 2025)
   Tech Stack: React.js (Vite), JavaScript, Firebase, Chakra UI, OpenStreetMap
   - Launched a real-time bus tracking web application for campus commute, serving 300+ users at BIT Mesra, with OpenStreetMap and Firebase Authentication delivering 98% live location accuracy.
   - Enabled 5-second real-time location updates by storing only current coordinates in Firebase, optimizing database performance.

EDUCATION
- Bachelor of Technology (B.Tech) in Computer Science and Engineering (2023 – 2027)
- Birla Institute of Technology (BIT), Mesra | CGPA: 8.7/10

AWARDS AND ACHIEVEMENTS
- 1st Prize, Web Development, Technika’24 Hackathon, BIT Mesra (Team Lead).
- 2nd Prize among 200+ teams, Innovate-A-Thon 3.0 (36-hour Web3 Hackathon), BIT Mesra; won $200 sponsored by Coinbase (Team Lead).
- Top 5 Teams, Web Development, Hackit’25 (48-hour Hackathon), Amity University (Team Lead).
- Semifinalist, Flipkart GRiD 8.0 and TCS CodeVita Global Coding Competition.
- Twice qualified for the internal college round of Smart India Hackathon (SIH) as Team Lead.
- Solved 1000+ DSA problems on LeetCode, Codeforces, CodeChef, and GeeksforGeeks.
`;

export const DEFAULT_CANDIDATE_PROFILE: CandidateProfile = {
  fullName: 'Aditya Agarwal',
  firstName: 'Aditya',
  lastName: 'Agarwal',
  email: 'adityaagar324@gmail.com',
  phone: '9508664027',
  location: 'Garhwa, Jharkhand, India (Open to Relocation)',
  linkedin: 'https://www.linkedin.com/in/aditya2227/',
  github: 'https://github.com/Adityaa2227',
  portfolio: 'https://adityaagarwalportfolio.vercel.app/',
  currentEmployer: 'PayPal',
  currentRole: 'Software Engineer Intern',
  totalExperience: '1 year',
  noticePeriod: 'Immediate',
  currentCTC: '0',
  expectedCTC: '12 LPA',
  workAuthorization: 'Authorized in India, no visa sponsorship required',
  pastInternships: 'Software Engineer Intern at PayPal (BNPL team), React Developer Intern at NS Apps Innovation',
  skills: 'Java, C++, JavaScript, TypeScript, Python, SQL, React, Next.js, Node.js, Express, Spring Boot, Redis, MongoDB, PostgreSQL, AWS (EC2, S3, EKS, Lambda), Docker, Kubernetes, CI/CD, Microservices, DSA',
  college: 'Birla Institute of Technology (BIT) Mesra',
  degree: 'Bachelor of Technology',
  major: 'Computer Science and Engineering',
  cgpa: '8.7',
  gradYear: '2027',
  codeforcesRating: '1000',
  codechefRating: '1400',
  leetcodeRating: '1600',
};

// ---------------------------------------------------------------------------
// Strict Exact-Match Fallback (Only used if AI is completely unavailable)
// ---------------------------------------------------------------------------
function strictExactProfileMatch(label: string, profile: CandidateProfile): string | null {
  const clean = label.replace(/^(\d+|q\d+)[\.\s\:\)]+/i, '').trim().toLowerCase();

  if (/^(full\s+name|candidate\s+name|applicant\s+name|your\s+name)$/i.test(clean)) return profile.fullName;
  if (/^(first\s+name|given\s+name)$/i.test(clean)) return profile.firstName || 'Aditya';
  if (/^(last\s+name|surname|family\s+name)$/i.test(clean)) return profile.lastName || 'Agarwal';
  if (/^(email|e-mail|email\s+address|mail\s+id)$/i.test(clean)) return profile.email;
  if (/^(phone|mobile|phone\s+number|mobile\s+number|contact\s+number|contact)$/i.test(clean)) return profile.phone;
  if (/^(current\s+location|current\s+city|city|location)$/i.test(clean)) return profile.location;
  if (/^(linkedin|linkedin\s+profile|linkedin\s+url)$/i.test(clean)) return profile.linkedin || '';
  if (/^(github|github\s+profile|github\s+url)$/i.test(clean)) return profile.github || '';
  if (/^(portfolio|portfolio\s+url|website|personal\s+website)$/i.test(clean)) return profile.portfolio || '';
  if (/^(college|university|institution|college\s+name|institute\s+name)$/i.test(clean)) return profile.college || '';
  if (/^(degree|highest\s+degree|highest\s+qualification)$/i.test(clean)) return profile.degree || '';
  if (/^(major|branch|stream|department)$/i.test(clean)) return profile.major || '';
  if (/^(cgpa|gpa|marks|percentage)$/i.test(clean)) return profile.cgpa || '';
  if (/^(grad\s+year|graduation\s+year|year\s+of\s+graduation|passing\s+year)$/i.test(clean)) return profile.gradYear || '';
  if (/^(current\s+employer|current\s+company|current\s+organization)$/i.test(clean)) return profile.currentEmployer || '';
  if (/^(current\s+role|current\s+designation|job\s+title|current\s+job\s+title)$/i.test(clean)) return profile.currentRole || '';

  return null;
}

// ---------------------------------------------------------------------------
// Build the Single-Call AI System Prompt
// ---------------------------------------------------------------------------
function buildSingleCallSystemPrompt(profile: CandidateProfile): string {
  return (
`You are an expert AI Form Filler assistant for candidate ADITYA AGARWAL.
Here is Aditya Agarwal's verified background and resume:
${ADITYA_FULL_RESUME_TEXT}

PROFILE OVERRIDES (if any):
${JSON.stringify(profile, null, 2)}

YOUR TASK:
You will receive an array of all form fields detected on a web form (Google Forms or Microsoft Forms).
Analyze the ENTIRE form in context and generate the most accurate, truthful, and professional answer for EVERY field in ONE SINGLE RESPONSE.

CRITICAL INSTRUCTIONS:
1. Candidate Identity & Personal Details:
   - Full Name: "Aditya Agarwal" (First: "Aditya", Last: "Agarwal")
   - Email: "adityaagar324@gmail.com"
   - Phone: "+91 9508664027" or "9508664027"
   - Current Location / Address: "Garhwa, Jharkhand, India"
   - Relocation willingness: "Yes" (Always willing to relocate anywhere in India/Abroad)
   - College / University: "Birla Institute of Technology (BIT) Mesra"
   - Degree: "Bachelor of Technology" or "B.Tech"
   - Branch / Specialization: "Computer Science and Engineering"
   - CGPA: "8.7"
   - Graduation Year: "2027"
   - Current / Most Recent Employer: "PayPal" (Software Engineer Intern)
   - Current Role: "Software Engineer Intern"
   - Total Experience: "1 year" (or "0-1 years" / "Fresher with internship experience")
   - Notice Period: "Immediate"
   - Expected CTC: "12 LPA" (or 10-15 LPA option if choice)
   - Current CTC: "0" or "Stipend"
   - Work Authorization: "Yes" (Authorized to work in India)
   - Visa Sponsorship Needed: "No"
   - LinkedIn: "https://www.linkedin.com/in/aditya2227/"
   - GitHub: "https://github.com/Adityaa2227"
   - Portfolio: "https://adityaagarwalportfolio.vercel.app/"
   - LeetCode: "https://leetcode.com/u/aditya2227"

2. Anti-Hallucination & Entity Distinction (STRICT):
   - NEVER put the candidate's name into fields meant for other entities!
   - Father's Name / Mother's Name / Guardian's Name: Leave empty string "" or answer accurately if known. NEVER put "Aditya Agarwal".
   - Project Name / Details: Use one of Aditya's real projects (e.g. "JobGrid - AI Job Portal" or "FlexPass"). NEVER put "Aditya Agarwal".
   - Company / Organization Applying To: Answer with the target company or leave blank. NEVER put "Aditya Agarwal".
   - References / Emergency Contact: Leave blank "" if not in resume.

3. Dropdowns, Radios, and Checkboxes:
   - When "options" are provided for a field, you MUST select EXACTLY ONE option from the provided options list that best matches Aditya.
   - For Yes/No questions (e.g. "Are you open to relocation?", "Can you join immediately?", "Do you have hands-on experience in Java/React?"), answer "Yes".
   - For "Do you require visa sponsorship?", answer "No".

4. Open-ended / Essay / Experience Questions:
   - Write crisp, impressive answers (2-3 sentences) highlighting Aditya's real work at PayPal (Fineract CI/CD test migration, Claude AI code review tool), NS Apps (contractor ERP, WhatsApp API), or his projects (JobGrid, FlexPass).

5. OUTPUT FORMAT:
   Return ONLY a valid JSON object matching this schema. NO markdown wrapping, NO backticks, NO commentary:
   {
     "answers": [
       { "fieldId": "<field id>", "answer": "<answer value>" }
     ]
   }`
  );
}

// ---------------------------------------------------------------------------
// Single-Call Batch Fill Function
// ---------------------------------------------------------------------------
export async function batchFillFields(req: BatchFillRequest, aiConfig?: AIProviderConfig): Promise<BatchFillResponse> {
  const { fields, jobContext = {}, profile = {} } = req;

  if (!fields || fields.length === 0) {
    return { results: [], stats: { total: 0, fromProfile: 0, fromAI: 0, failed: 0 } };
  }

  const effectiveProfile: CandidateProfile = {
    ...DEFAULT_CANDIDATE_PROFILE,
    ...profile,
  };

  const systemPrompt = buildSingleCallSystemPrompt(effectiveProfile);

  // Format fields for prompt
  const fieldsForPrompt = fields.map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    required: !!f.required,
    placeholder: f.placeholder || undefined,
    options: f.options && f.options.length > 0 ? f.options.map((o) => o.text || o.value) : undefined,
  }));

  const userPrompt =
`Job Context:
Title: ${jobContext.title || 'Software Development Engineer (SDE)'}
Company: ${jobContext.company || 'Hiring Company'}
JD: ${(jobContext.jdText || '').slice(0, 1000)}

Form Fields to fill (${fields.length} total):
${JSON.stringify(fieldsForPrompt, null, 2)}

Provide the JSON response with the "answers" array now:`;

  let aiSuccess = false;
  let parsedAnswers: Record<string, string> = {};
  let lastProvider: string | undefined;
  let lastModel: string | undefined;

  try {
    const aiResult = await executeFormFillerFallbackText({
      systemPrompt,
      userPrompt,
      temperature: 0.1,
      maxTokens: 3000,
      config: aiConfig,
    });

    lastProvider = aiResult.provider;
    lastModel = aiResult.model;

    // Clean JSON if model returned markdown block
    let cleanJson = aiResult.text.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }

    const parsed = JSON.parse(cleanJson) as { answers?: Array<{ fieldId: string; answer: string }> };
    if (parsed && Array.isArray(parsed.answers)) {
      for (const item of parsed.answers) {
        if (item && item.fieldId) {
          parsedAnswers[item.fieldId] = String(item.answer || '').trim();
        }
      }
      aiSuccess = true;
      logger.info({ totalFields: fields.length, answered: Object.keys(parsedAnswers).length, provider: lastProvider }, '[FormFiller] Single-call AI success');
    }
  } catch (err: unknown) {
    const error = err as Error;
    logger.warn({ error: error.message }, '[FormFiller] Single-call AI failed. Falling back to strict exact match.');
  }

  // Assemble final results
  const results: FillFieldResponse[] = [];
  let fromProfile = 0;
  let fromAI = 0;
  let failed = 0;

  for (const field of fields) {
    const aiAnswer = parsedAnswers[field.id];

    if (aiSuccess && aiAnswer !== undefined && aiAnswer.length > 0) {
      results.push({
        fieldId: field.id,
        answer: aiAnswer,
        source: 'ai',
        provider: lastProvider,
        model: lastModel,
      });
      fromAI++;
    } else {
      // Fallback: strict exact match
      const exactMatch = strictExactProfileMatch(field.label, effectiveProfile);
      if (exactMatch) {
        results.push({ fieldId: field.id, answer: exactMatch, source: 'profile' });
        fromProfile++;
      } else {
        results.push({ fieldId: field.id, answer: '', source: 'ai' });
        failed++;
      }
    }
  }

  return {
    results,
    stats: {
      total: fields.length,
      fromProfile,
      fromAI,
      failed,
    },
    provider: lastProvider,
  };
}