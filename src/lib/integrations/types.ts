/**
 * Types for the Integrations Service Layer (OAuth, Profile Fetching & Document Export)
 */

export interface OAuthProfileExperience {
  title: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current?: boolean;
  bullets: string[];
}

export interface OAuthProfileEducation {
  institution: string;
  degree: string;
  field?: string;
  startDate?: string;
  endDate?: string;
}

export interface OAuthProfile {
  name: string;
  firstName?: string;
  lastName?: string;
  headline: string;
  email: string;
  phone?: string;
  location: string;
  linkedinUrl?: string;
  summary: string;
  experience: OAuthProfileExperience[];
  education: OAuthProfileEducation[];
  skills: string[];
  languages?: Array<{ name: string; proficiency?: string }>;
  profilePictureUrl?: string;
  vanityName?: string;
  rawJson?: any;
}

export interface OAuthTokenResponse {
  accessToken: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
}

export interface OAuthAuthResult {
  ok: boolean;
  profile?: OAuthProfile;
  error?: string;
  provider: "linkedin" | "github" | string;
}

export interface Html2PdfOptions {
  filename?: string;
  scale?: number;
  marginMm?: number;
  quality?: number;
}
