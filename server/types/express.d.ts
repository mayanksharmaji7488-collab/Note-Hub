import "express";

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      fullName?: string | null;
      nickName?: string | null;
      email?: string | null;
      phone?: string | null;
      mobileNumber?: string | null;
      role?: "student" | "faculty" | null;
      isEmailVerified?: boolean;
      isMobileVerified?: boolean;
      department?: string | null;
      year?: number | null;
    }

    interface Request {
      file?: {
        originalname: string;
        filename: string;
      };
    }
  }
}

export {};
