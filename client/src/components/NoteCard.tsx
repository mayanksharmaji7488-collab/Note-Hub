import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Download, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import type { Note } from "@shared/schema";
import { useRecordDownload } from "@/hooks/use-notes";

interface NoteCardProps {
  note: Note & { author: string };
}

export function NoteCard({ note }: NoteCardProps) {
  const { mutate: recordDownload } = useRecordDownload();

  const handleDownload = () => {
    // Open immediately to avoid popup blockers, then record the download.
    window.open(note.fileUrl, "_blank", "noopener,noreferrer");
    recordDownload(note.id);
  };

  return (
    <Card className="group glass-card hover:shadow-lg transition-all duration-300 border-border/60 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-4">
          <Badge variant="secondary" className="bg-primary/5 text-primary hover:bg-primary/10 transition-colors">
            {note.subject}
          </Badge>
          <Badge variant="outline" className="text-muted-foreground">
            {note.semester}
          </Badge>
        </div>
        <CardTitle className="mt-4 text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
          {note.title}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pb-3">
        {note.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {note.description}
          </p>
        )}
        
        <div className="flex flex-col gap-2 text-xs text-muted-foreground/80 mt-auto">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5" />
            <span>Shared by {note.author}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            <span>{format(new Date(note.createdAt || new Date()), "MMM d, yyyy")}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t bg-muted/30">
        <Button 
          variant="ghost" 
          className="w-full justify-between hover:bg-primary hover:text-primary-foreground group-hover/btn:translate-x-1 transition-all"
          onClick={handleDownload}
        >
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {note.fileName}
          </span>
          <Download className="h-4 w-4 opacity-50" />
        </Button>
      </CardFooter>
    </Card>
  );
}
