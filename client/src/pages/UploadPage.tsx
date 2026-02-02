import { useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/Layout";
import { useCreateNote } from "@/hooks/use-notes";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertNoteSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, File, X, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";

// Extend schema for client-side file validation
const uploadSchema = insertNoteSchema.extend({
  file: z.instanceof(FileList).refine((files) => files.length > 0, "File is required")
});

type UploadFormValues = z.infer<typeof uploadSchema>;

export default function UploadPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { mutateAsync: createNote, isPending } = useCreateNote();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const form = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      title: "",
      subject: "",
      semester: "",
      description: "",
    }
  });

  if (!user) {
    setLocation("/auth");
    return null;
  }

  const onSubmit = async (data: UploadFormValues) => {
    const formData = new FormData();
    formData.append("title", data.title);
    formData.append("subject", data.subject);
    formData.append("semester", data.semester);
    if (data.description) formData.append("description", data.description);
    if (data.file && data.file[0]) {
      formData.append("file", data.file[0]);
    }

    try {
      await createNote(formData);
      setLocation("/");
    } catch (error) {
      console.error("Submission failed", error);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground">Upload Note</h1>
          <p className="text-muted-foreground mt-1">Share your study materials with the community.</p>
        </div>

        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                
                {/* File Upload Area */}
                <FormField
                  control={form.control}
                  name="file"
                  render={({ field: { onChange, value, ...field } }) => (
                    <FormItem>
                      <FormLabel>Document</FormLabel>
                      <FormControl>
                        <div className="flex flex-col items-center justify-center w-full">
                          {!selectedFile ? (
                            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer bg-muted/20 hover:bg-muted/40 hover:border-primary/50 transition-all group">
                              <div className="flex flex-col items-center justify-center pt-5 pb-6 text-muted-foreground group-hover:text-primary transition-colors">
                                <div className="p-4 bg-muted rounded-full mb-3 group-hover:bg-primary/10 transition-colors">
                                  <Upload className="w-8 h-8" />
                                </div>
                                <p className="mb-2 text-sm font-semibold">Click to upload or drag and drop</p>
                                <p className="text-xs">PDF, DOC, PPT up to 10MB</p>
                              </div>
                              <input 
                                type="file" 
                                className="hidden" 
                                accept=".pdf,.doc,.docx,.ppt,.pptx"
                                onChange={(e) => {
                                  const files = e.target.files;
                                  if (files?.length) {
                                    setSelectedFile(files[0]);
                                    onChange(files);
                                  }
                                }}
                                {...field}
                              />
                            </label>
                          ) : (
                            <div className="w-full h-24 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between px-6">
                              <div className="flex items-center gap-4">
                                <div className="p-3 bg-white rounded-lg shadow-sm">
                                  <File className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                  <p className="font-semibold text-sm text-foreground">{selectedFile.name}</p>
                                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                              </div>
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => {
                                  setSelectedFile(null);
                                  onChange(null);
                                }}
                              >
                                <X className="h-5 w-5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Advanced Calculus Notes" className="h-11 bg-white" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject Code</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. MAT201" className="h-11 bg-white" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="semester"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Semester</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11 bg-white">
                              <SelectValue placeholder="Select semester" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                              <SelectItem key={sem} value={`Semester ${sem}`}>
                                Semester {sem}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Briefly describe the contents of this note..." 
                          className="min-h-[100px] resize-none bg-white"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-4 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setLocation("/")}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isPending || !selectedFile}
                    className="min-w-[140px] shadow-lg shadow-primary/25"
                  >
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
