// ============================================================================
// Form Filler Module - Profile-to-Field Matching Service
// Maps candidate profile fields to form field labels via keyword matching
// Falls back to AI for unmatched fields
// ============================================================================

import { CandidateProfile, FormField, FillFieldResponse, BatchFillRequest, BatchFillResponse } from './form-filler.types';
import { executeFormFillerFallbackText, AIProviderConfig } from './form-filler.ai';
import { logger } from '../../core/utils/logger';

// ---------------------------------------------------------------------------
// Keyword mappings: profile key -> array of label patterns to match
// ---------------------------------------------------------------------------
const PROFILE_FIELD_MAP: Record<keyof CandidateProfile, string[]> = {
  fullName:         ['full name', 'name', 'your name', 'applicant name', 'candidate name'],
  firstName:        ['first name', 'given name'],
  lastName:         ['last name', 'surname', 'family name'],
  email:            ['email', 'e-mail', 'email address', 'mail'],
  phone:            ['phone', 'mobile', 'contact number', 'telephone', 'cell', 'phone number', 'mobile number'],
  location:         ['location', 'city', 'current city', 'current location', 'address', 'where are you based'],
  linkedin:         ['linkedin', 'linkedin profile', 'linkedin url'],
  github:           ['github', 'github profile', 'github url'],
  portfolio:        ['portfolio', 'website', 'personal website', 'portfolio url'],
  currentEmployer:  ['current employer', 'current company', 'company', 'employer', 'organization', 'organisation', 'where do you work'],
  currentRole:      ['current role', 'current designation', 'job title', 'designation', 'position', 'current position', 'current title'],
  totalExperience:  ['total experience', 'years of experience', 'experience', 'work experience', 'how many years'],
  noticePeriod:     ['notice period', 'joining availability', 'when can you join', 'availability'],
  currentCTC:       ['current ctc', 'current salary', 'current package', 'ctc', 'current compensation'],
  expectedCTC:      ['expected ctc', 'expected salary', 'salary expectation', 'expected package', 'expected compensation'],
  workAuthorization:['work authorization', 'authorized to work', 'visa', 'work permit', 'right to work'],
  pastInternships:  ['past internship', 'previous internship', 'internship experience', 'previous employer', 'work history'],
  skills:           ['skills', 'technical skills', 'key skills', 'technologies', 'tech stack'],
  college:          ['college', 'university', 'institution', 'school', 'alma mater', 'educational institution'],
  degree:           ['degree', 'qualification', 'highest qualification'],
  major:            ['major', 'branch', 'specialization', 'stream', 'field of study'],
  cgpa:             ['cgpa', 'gpa', 'percentage', 'marks', 'grade'],
  gradYear:         ['graduation year', 'year of graduation', 'passing year', 'pass out year', 'grad year'],
  codeforcesRating: ['codeforces', 'codeforces rating', 'cf rating'],
  codechefRating:   ['codechef', 'codechef rating', 'cc rating'],
  leetcodeRating:   ['leetcode', 'leetcode rating', 'lc rating'],
};

// ---------------------------------------------------------------------------
// Match a field label to a profile key using keyword matching
// ---------------------------------------------------------------------------
function matchFieldToProfile(label: string, profile: Partial<CandidateProfile>): string | null {
  const normalized = label.toLowerCase().trim();

  for (const [profileKey, patterns] of Object.entries(PROFILE_FIELD_MAP)) {
    const key = profileKey as keyof CandidateProfile;
    const profileValue = profile[key];
    if (!profileValue) continue;

    for (const pattern of patterns) {
      if (normalized.includes(pattern) || pattern.includes(normalized)) {
        return String(profileValue);
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Build the candidate system prompt for AI field answering
// ---------------------------------------------------------------------------
function buildSystemPrompt(profile: Partial<CandidateProfile>): string {
  return (
    `You are filling a job application form on behalf of candidate ${profile.fullName || 'Aditya Agarwal'}.\n` +
    `Candidate verified background:\n` +
    `- Full Name: ${profile.fullName || 'Aditya Agarwal'}\n` +
    `- Email: ${profile.email || 'aditya@example.com'}\n` +
    `- Phone: ${profile.phone || '+91-9876543210'}\n` +
    `- Location: ${profile.location || 'Bangalore, India'}\n` +
    `- Current Employer: ${profile.currentEmployer || 'PayPal'}\n` +
    `- Current Role: ${profile.currentRole || 'Software Engineer Intern'}\n` +
    `- Past Internships: ${profile.pastInternships || 'Software Engineer Intern at PayPal, React Developer Intern at NS Apps Innovation'}\n` +
    `- Education: ${profile.degree || 'B.Tech'} in ${profile.major || 'Computer Science and Engineering'} from ${profile.college || 'Birla Institute of Technology (BIT) Mesra'} (CGPA: ${profile.cgpa || '8.7'}/10, Grad: ${profile.gradYear || '2027'})\n` +
    `- Skills: ${profile.skills || 'Java, C++, JavaScript, TypeScript, Python, SQL, React, Next.js, Node.js, Express, Spring Boot, Redis, MongoDB, PostgreSQL, AWS, Docker, Kubernetes'}\n` +
    `- Notice Period: ${profile.noticePeriod || 'Immediate'}\n` +
    `- Work Authorization: ${profile.workAuthorization || 'Authorized in India, no visa sponsorship required'}\n` +
    `- Codeforces Rating: ${profile.codeforcesRating || '1000'}\n` +
    `- Codechef Rating: ${profile.codechefRating || '1400'}\n` +
    `\nRules:\n` +
    `- Answer directly, truthfully, professionally, and concisely.\n` +
    `- For Yes/No questions based on the candidate's background, answer ONLY "Yes" or "No".\n` +
    `- For dropdown/radio, return EXACTLY one of the given options.\n` +
    `- For free-text, answer in 1-2 sentences or give the exact value.\n` +
    `- Return ONLY the final answer text. No quotes, no markdown, no commentary.`
  );
}

// ---------------------------------------------------------------------------
// Answer a single field using AI
// ---------------------------------------------------------------------------
async function answerFieldWithAI(
  field: FormField,
  profile: Partial<CandidateProfile>,
  jobContext: { title?: string; company?: string; jdText?: string } = {},
  aiConfig?: AIProviderConfig,
): Promise<{ text: string; provider: string; model: string }> {
  const systemPrompt = buildSystemPrompt(profile);

  let optionsInstruction = '';
  if (field.options && field.options.length > 0) {
    const optLabels = field.options.map((o) => o.text || o.value);
    if (field.type === 'checkbox') {
      optionsInstruction = `\nTHIS IS A CHECKBOX. Return ONLY "Yes" to check it or "No" to leave it unchecked.`;
    } else {
      optionsInstruction = `\nTHIS IS A ${field.type === 'radio' || field.type === 'aria-radio' ? 'RADIO BUTTON' : 'DROPDOWN'} FIELD. Choose EXACTLY one from: ${JSON.stringify(optLabels)}. Return ONLY the chosen text.`;
    }
  } else {
    const isYesNo = /\b(are you|do you|have you|will you|can you|did you|would you|is your|authorize|eligible|agree|confirm|accept|sponsor|veteran|disability|authorized|currently|legally)\b/i.test(field.label);
    if (isYesNo) {
      optionsInstruction = `\nThis appears to be a Yes/No question. Return ONLY "Yes" or "No".`;
    }
  }

  const userPrompt =
    `Job: ${jobContext.title || 'Software Engineer'} at ${jobContext.company || 'Company'}\n` +
    `JD Snippet: ${(jobContext.jdText || '').slice(0, 800)}\n\n` +
    `Form Question/Label: ${field.label}\n` +
    (field.placeholder ? `Placeholder hint: ${field.placeholder}\n` : '') +
    optionsInstruction +
    `\n\nDirect Answer:`;

  return await executeFormFillerFallbackText({ systemPrompt, userPrompt, temperature: 0.1, maxTokens: 300, config: aiConfig });
}

// ---------------------------------------------------------------------------
// Batch fill: profile matching + AI fallback
// ---------------------------------------------------------------------------
export async function batchFillFields(req: BatchFillRequest, aiConfig?: AIProviderConfig): Promise<BatchFillResponse> {
  const { fields, jobContext = {}, profile = {} } = req;

  const results: FillFieldResponse[] = [];
  let fromProfile = 0;
  let fromAI = 0;
  let failed = 0;
  let lastProvider: string | undefined;

  for (const field of fields) {
    // 1. Try profile matching first
    const profileMatch = matchFieldToProfile(field.label, profile);
    if (profileMatch) {
      results.push({ fieldId: field.id, answer: profileMatch, source: 'profile' });
      fromProfile++;
      continue;
    }

    // 2. If the field already has a value, skip AI
    if (field.value && field.value.trim().length > 0) {
      results.push({ fieldId: field.id, answer: field.value, source: 'profile' });
      fromProfile++;
      continue;
    }

    // 3. Fall back to AI
    try {
      const { text, provider, model } = await answerFieldWithAI(field, profile, jobContext, aiConfig);
      results.push({ fieldId: field.id, answer: text, source: 'ai', provider, model });
      lastProvider = provider;
      fromAI++;
    } catch (err: unknown) {
      const error = err as Error;
      logger.error({ fieldId: field.id, label: field.label, error: error.message }, '[FormFiller] AI failed for field');
      results.push({ fieldId: field.id, answer: '', source: 'ai' });
      failed++;
    }
  }

  return {
    results,
    stats: { total: fields.length, fromProfile, fromAI, failed },
    provider: lastProvider,
  };
}
