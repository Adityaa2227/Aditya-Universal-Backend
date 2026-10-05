// ============================================================================
// Form Filler Module - Type Definitions
// ============================================================================

export interface CandidateProfile {
  // Personal
  fullName: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;

  // Professional
  currentEmployer?: string;
  currentRole?: string;
  totalExperience?: string;
  noticePeriod?: string;
  currentCTC?: string;
  expectedCTC?: string;
  workAuthorization?: string;
  pastInternships?: string;
  skills?: string;

  // Education
  college?: string;
  degree?: string;
  major?: string;
  cgpa?: string;
  gradYear?: string;

  // Competitive Programming
  codeforcesRating?: string;
  codechefRating?: string;
  leetcodeRating?: string;

  // Allows arbitrary extra fields
  [key: string]: string | undefined;
}

export interface FormField {
  id: string;
  name?: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'date' | 'url' | 'aria-radio';
  value?: string;
  options?: Array<{ text: string; value: string }>;
  required?: boolean;
  placeholder?: string;
}

export interface BatchFillRequest {
  fields: FormField[];
  jobContext?: {
    title?: string;
    company?: string;
    jdText?: string;
  };
  profile?: Partial<CandidateProfile>;
}

export interface FillFieldResponse {
  fieldId: string;
  answer: string;
  source: 'profile' | 'ai';
  provider?: string;
  model?: string;
}

export interface BatchFillResponse {
  results: FillFieldResponse[];
  stats: {
    total: number;
    fromProfile: number;
    fromAI: number;
    failed: number;
  };
  provider?: string;
}
