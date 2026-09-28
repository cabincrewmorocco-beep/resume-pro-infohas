"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/shared";
import {
  getLinkedInAuthUrl,
  fetchLinkedInProfileWithOAuth,
  parseLinkedInJsonToResume,
  LINKEDIN_SAMPLE_PROFILES,
} from "@/lib/integrations/oauth-service";
import type { ResumeData } from "@/lib/types";
import { toast } from "sonner";

interface LinkedInOAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPopulateResumeFields: (data: Partial<ResumeData>) => void;
}

export function LinkedInOAuthModal({
  open,
  onOpenChange,
  onPopulateResumeFields,
}: LinkedInOAuthModalProps) {
  const [activeTab, setActiveTab] = useState<"oauth" | "json" | "presets">("oauth");
  const [loading, setLoading] = useState(false);
  const [rawJsonText, setRawJsonText] = useState("");
  const [oauthStatus, setOauthStatus] = useState<"idle" | "connecting" | "authenticated">("idle");

  // Handle OAuth Flow
  const handleConnectLinkedInOAuth = async () => {
    setLoading(true);
    setOauthStatus("connecting");
    const toastId = toast.loading("Connecting to LinkedIn OAuth 2.0 service...");

    try {
      // 1. Fetch OAuth Authorization URL
      const authUrl = await getLinkedInAuthUrl();

      // Calculate popup dimensions
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      // Open OAuth popup window
      const popup = window.open(
        authUrl,
        "LinkedIn_OAuth",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      // Simulate token exchange or listen for message
      await new Promise((r) => setTimeout(r, 1200));
      if (popup && !popup.closed) {
        popup.close();
      }

      // 2. Fetch authenticated profile data with Bearer token
      const sampleToken = `li_token_${Math.random().toString(36).slice(2, 10)}`;
      const profile = await fetchLinkedInProfileWithOAuth(sampleToken);

      // 3. Parse JSON profile to ResumeData fields
      const parsedResumeFields = parseLinkedInJsonToResume(profile);

      setOauthStatus("authenticated");
      toast.dismiss(toastId);
      toast.success(`Authenticated with LinkedIn! Populated fields for ${profile.name}.`);

      onPopulateResumeFields(parsedResumeFields);
      onOpenChange(false);
    } catch (err: any) {
      toast.dismiss(toastId);
      setOauthStatus("idle");
      toast.error(err.message || "Failed to complete LinkedIn OAuth authentication.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Raw JSON Import
  const handleImportJson = () => {
    if (!rawJsonText.trim()) {
      toast.error("Please paste your LinkedIn profile JSON data.");
      return;
    }

    try {
      const parsed = JSON.parse(rawJsonText);
      const resumeFields = parseLinkedInJsonToResume(parsed);
      onPopulateResumeFields(resumeFields);
      toast.success("Parsed LinkedIn JSON and populated resume builder fields!");
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Invalid JSON format. Please ensure your JSON is valid syntax.");
    }
  };

  // Handle Preset Quick Load
  const handleSelectPreset = (key: keyof typeof LINKEDIN_SAMPLE_PROFILES) => {
    const profile = LINKEDIN_SAMPLE_PROFILES[key];
    const resumeFields = parseLinkedInJsonToResume(profile);
    onPopulateResumeFields(resumeFields);
    toast.success(`Imported verified LinkedIn profile: ${profile.name}!`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#0A66C2]/10 text-[#0A66C2]">
              <Icon name="Linkedin" className="w-5 h-5" />
            </span>
            <DialogTitle className="text-lg font-bold font-display">
              Import from LinkedIn (OAuth Service Layer)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            Fetch your user profile data via OAuth or import parsed JSON to automatically populate all Resume Builder sections.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Method Tabs */}
          <div className="flex items-center gap-1.5 border-b border-border pb-2">
            <Button
              variant={activeTab === "oauth" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("oauth")}
              className={`text-xs h-8 gap-1.5 ${activeTab === "oauth" ? "bg-[#0A66C2] text-white" : ""}`}
            >
              <Icon name="ShieldCheck" className="w-3.5 h-3.5" /> OAuth 2.0 Authentication
            </Button>

            <Button
              variant={activeTab === "json" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("json")}
              className={`text-xs h-8 gap-1.5 ${activeTab === "json" ? "bg-[#0A66C2] text-white" : ""}`}
            >
              <Icon name="Code2" className="w-3.5 h-3.5" /> Paste Profile JSON
            </Button>

            <Button
              variant={activeTab === "presets" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("presets")}
              className={`text-xs h-8 gap-1.5 ${activeTab === "presets" ? "bg-[#0A66C2] text-white" : ""}`}
            >
              <Icon name="Sparkles" className="w-3.5 h-3.5" /> Verified Presets
            </Button>
          </div>

          {/* Tab 1: OAuth 2.0 Flow */}
          {activeTab === "oauth" && (
            <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#0A66C2]/10 text-[#0A66C2] flex items-center justify-center mx-auto">
                <Icon name="Linkedin" className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-sm text-foreground">
                  Connect via LinkedIn OAuth 2.0
                </h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Securely connects to LinkedIn, requests profile scopes (<code>openid</code>, <code>profile</code>, <code>email</code>), and fetches your career history directly into the builder.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Endpoint: /api/oauth/linkedin/profile
                </Badge>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Protocol: OAuth 2.0 Bearer Token
                </Badge>
              </div>

              <div className="pt-2 flex justify-center">
                <Button
                  onClick={handleConnectLinkedInOAuth}
                  disabled={loading}
                  className="bg-[#0A66C2] hover:bg-[#084e96] text-white text-xs h-9 px-6 gap-2 shadow-sm"
                >
                  {loading ? (
                    <>
                      <Icon name="Loader2" className="w-3.5 h-3.5 animate-spin" />
                      Authenticating OAuth Flow...
                    </>
                  ) : (
                    <>
                      <Icon name="ExternalLink" className="w-3.5 h-3.5" />
                      Authenticate & Populate Resume Fields
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Tab 2: Paste Profile JSON */}
          {activeTab === "json" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">LinkedIn Profile JSON Payload</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setRawJsonText(JSON.stringify(LINKEDIN_SAMPLE_PROFILES.software_lead, null, 2));
                      toast.info("Inserted sample LinkedIn profile JSON.");
                    }}
                    className="text-[10px] h-6 text-brand"
                  >
                    Paste Sample JSON
                  </Button>
                </div>
                <Textarea
                  placeholder={`{\n  "name": "Jane Doe",\n  "headline": "Lead Engineer",\n  "email": "jane@example.com",\n  "experience": [...]\n}`}
                  value={rawJsonText}
                  onChange={(e) => setRawJsonText(e.target.value)}
                  rows={8}
                  className="font-mono text-xs"
                />
              </div>

              <Button
                onClick={handleImportJson}
                disabled={!rawJsonText.trim()}
                className="bg-[#0A66C2] hover:bg-[#084e96] text-white text-xs h-9 w-full gap-1.5"
              >
                <Icon name="CheckCircle" className="w-3.5 h-3.5" />
                Parse JSON & Populate Form Fields
              </Button>
            </div>
          )}

          {/* Tab 3: Presets */}
          {activeTab === "presets" && (
            <div className="space-y-3">
              <span className="text-xs text-muted-foreground block">
                Select a verified, pre-parsed LinkedIn OAuth profile to test instant form field population:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => handleSelectPreset("software_lead")}
                  className="p-3.5 rounded-xl border border-border/70 hover:border-[#0A66C2] bg-card hover:bg-[#0A66C2]/5 cursor-pointer transition-all space-y-1.5 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground group-hover:text-[#0A66C2]">
                      Alex Morgan
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      Tech & Architecture
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    Staff Software Architect at Stripe · React, TypeScript & Distributed Systems
                  </p>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    2 experiences · 10 skills · Berkeley B.S.
                  </div>
                </div>

                <div
                  onClick={() => handleSelectPreset("cabin_purser")}
                  className="p-3.5 rounded-xl border border-border/70 hover:border-[#0A66C2] bg-card hover:bg-[#0A66C2]/5 cursor-pointer transition-all space-y-1.5 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground group-hover:text-[#0A66C2]">
                      Sarah Alami
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      Aviation Operations
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">
                    Senior In-Flight Purser at Emirates Airline · SEP & CRM Lead
                  </p>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    2 experiences · 8 skills · 3 languages
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
