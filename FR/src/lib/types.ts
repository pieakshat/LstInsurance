export interface Protocol {
  _id: string;
  protocol_id: number;
  protocol_name: string;
  insurance_name: string;
  logo_url: string;
  description: string;
  vault_address: string;
  premium_module_address: string;
  coverage_cap: string;
  premium_rate: number;
  chain: string;
  active: boolean;
}

export interface CoveragePosition {
  token_id: number;
  protocol_id: number;
  protocol_name: string;
  logo_url: string;
  coverage_amount: string; // wei
  premium_paid: string; // wei
  start_time: number; // unix seconds
  end_time: number; // unix seconds
}

export type ClaimStatus = "pending" | "approved" | "rejected";

export interface Claim {
  claim_id: number;
  token_id: number;
  protocol_name: string;
  logo_url: string;
  coverage_amount: string; // wei
  status: ClaimStatus;
  submitted_at: number; // unix seconds
  resolved_at: number | null; // unix seconds or null
}
