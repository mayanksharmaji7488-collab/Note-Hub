import { useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/Layout";
import { useCreateNote } from "@/hooks/use-notes";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertNoteSchema } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, File as FileIcon, X, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";

// Backend derives fileName/fileUrl from the uploaded file, so they must not block form submit.
// Also, the DB allows nullable description, but form inputs should never be null.
const uploadNoteSchema = insertNoteSchema
  .omit({ fileName: true, fileUrl: true })
  .extend({ description: z.string().optional() });
type UploadFormValues = z.infer<typeof uploadNoteSchema>;

export default function UploadPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { mutateAsync: createNote, isPending } = useCreateNote();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadNoteSchema),
    defaultValues: {
      title: "",
      subject: "",
      semester: "",
      description: "",
    },
  });

  if (!user) {
    setLocation("/auth");
    return null;
  }

  const onSubmit = async (data: UploadFormValues) => {
    if (!selectedFile) {
      alert("Please select a file");
      return;
    }

    const formData = new FormData();
    formData.append("title", data.title);
    formData.append("subject", data.subject);
    formData.append("semester", data.semester);
    if (data.description) formData.append("description", data.description);
    formData.append("file", selectedFile);

    try {
      await createNote(formData);
      setLocation("/");
    } catch (error) {
      console.error("Upload failed", error);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 fade-up">
          <h1 className="text-4xl font-display font-bold text-balance">Upload a note</h1>
          <p className="text-muted-foreground">
            Share study material in minutes. We will store the file and index it for search.
          </p>
        </div>

        <Card className="glass-card rounded-3xl border-border/60 fade-up" style={{ animationDelay: "60ms" }}>
          <CardContent className="p-8">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                {/* File Upload */}
                <div>
                  <label className="font-medium">Document</label>

                  {!selectedFile ? (
                    <label className="mt-2 flex flex-col items-center justify-center w-full h-44 rounded-2xl cursor-pointer border border-dashed border-border/70 bg-card/50 backdrop-blur hover:bg-card/70 transition-colors">
                      <Upload className="w-9 h-9 mb-2 text-primary" />
                      <span className="font-medium">Click to choose a file</span>
                      <span className="text-xs text-muted-foreground mt-1">
                        PDF, DOCX, PPTX up to 10MB
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.ppt,.pptx"
                        onChange={(e) => {
                          if (e.target.files?.length) {
                            setSelectedFile(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  ) : (
                    <div className="flex justify-between items-center border border-border/60 bg-card/60 backdrop-blur rounded-2xl p-4 mt-2">
                      <div className="flex items-center gap-3">
                        <FileIcon className="w-5 h-5" />
                        <div className="flex flex-col">
                          <span className="font-medium">{selectedFile.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                          </span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setSelectedFile(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Title */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Subject */}
                <FormField
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject Code</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Semester */}
                <FormField
                  control={form.control}
                  name="semester"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Semester</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select semester" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                            <SelectItem
                              key={sem}
                              value={`Semester ${sem}`}
                            >
                              Semester {sem}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/")}
                  >
                    Cancel
                  </Button>

                  <Button type="submit" disabled={isPending}>
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      "Upload Note"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
