
import type { IStorage } from "./storage";
import { hashPassword } from "./auth";

export async function seed(storage: IStorage) {
  const existingUser = await storage.getUserByUsername("student");
  if (!existingUser) {
    console.log("Seeding database...");
    const password = await hashPassword("password123");
    const user = await storage.createUser({
      username: "student",
      nickName: "Student",
      fullName: "Demo Student",
      email: "student@example.com",
      isEmailVerified: true,
      role: "student",
      password,
      department: "CSE",
      year: 1,
    });
    
    await storage.createNote({
      title: "Introduction to Calculus",
      subject: "Mathematics",
      semester: "Sem 1",
      description: "Basic limits and derivatives notes.",
      fileName: "calculus_intro.pdf",
      fileUrl: "#", // Placeholder
      userId: user.id,
    });
    
    await storage.createNote({
      title: "Data Structures",
      subject: "Computer Science",
      semester: "Sem 3",
      description: "Linked lists, stacks, and queues.",
      fileName: "ds_notes.pdf",
      fileUrl: "#", // Placeholder
      userId: user.id,
    });
    
    console.log("Seeding complete!");
  }
}
