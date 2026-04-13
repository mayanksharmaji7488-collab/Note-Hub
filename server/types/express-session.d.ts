import "express-session";

declare module "express-session" {
  interface SessionData {
    googleOAuthState?: string;
    loginOtp?: {
      identifier: string;
      codeHash: string;
      expiresAt: number;
      lastSentAt: number;
    };
    passwordResetOtp?: {
      identifier: string;
      codeHash: string;
      expiresAt: number;
      lastSentAt: number;
    };
    verifyEmailOtp?: {
      email: string;
      codeHash: string;
      expiresAt: number;
      lastSentAt: number;
    };
    verifyMobileOtp?: {
      mobileNumber: string;
      codeHash: string;
      expiresAt: number;
      lastSentAt: number;
    };
  }
}
