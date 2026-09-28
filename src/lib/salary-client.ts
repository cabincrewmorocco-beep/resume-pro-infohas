/**
 * Client service for Gemini Search-Grounded Market Salary Insights
 */

export interface SalaryInsightsData {
  role: string;
  location: string;
  currency: string;
  currencySymbol: string;
  payPeriod: string;
  baseSalary: {
    p25: number;
    median: number;
    p75: number;
    p90: number;
  };
  totalCompensation: {
    median: number;
    typicalBonusPct: number;
    typicalEquity: string;
  };
  marketDemand: "High" | "Moderate" | "Surging" | "Stable" | string;
  costOfLivingNote?: string;
  experienceTiers: Array<{
    level: string;
    range: string;
  }>;
  topPayingSkills: Array<{
    skill: string;
    premiumPct: number;
  }>;
  negotiationStrategy: string[];
  marketSummary: string;
}

export interface SalarySource {
  title: string;
  url: string;
}

export interface SalaryInsightsResponse {
  ok: boolean;
  provider?: string;
  grounded?: boolean;
  searchQueries?: string[];
  sources?: SalarySource[];
  data: SalaryInsightsData;
  error?: string;
}

export async function fetchMarketSalaryInsights(params: {
  role: string;
  location?: string;
  experienceLevel?: string;
  skills?: string[];
}): Promise<SalaryInsightsResponse> {
  const res = await fetch("/api/gemini/salary-insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch salary data (HTTP ${res.status})`);
  }

  return await res.json();
}
