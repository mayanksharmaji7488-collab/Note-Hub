import { Layout } from "@/components/Layout";
import { MyLibraryCard } from "@/components/MyLibraryCard";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";

export default function LibraryPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) {
    setLocation("/auth");
    return null;
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold">My Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your uploaded and downloaded notes.
          </p>
        </div>
        <Link href="/upload">
          <Button>Upload Note</Button>
        </Link>
      </div>
      <MyLibraryCard />
    </Layout>
  );
}

