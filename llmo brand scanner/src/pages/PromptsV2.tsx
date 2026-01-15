import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { 
  Plus, Copy, Play, Edit2, Search, FlaskConical, 
  MessageSquare, Tag as TagIcon, Sparkles, X 
} from "lucide-react";

interface Prompt {
  id: string;
  text: string;
  project_id: string;
  brand_id: string | null;
  topic_id: string | null;
  preferred_model_id: string | null;
  status: "attivo" | "suggerito" | "inattivo";
  category: string | null;
  intent: string | null;
  language: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
}

interface Brand {
  id: string;
  name: string;
}

interface Topic {
  id: string;
  name: string;
  color: string | null;
}

interface Tag {
  id: string;
  name: string;
  color: string | null;
}

interface AIModel {
  id: string;
  name: string;
  display_name: string;
  is_active: boolean;
}

interface PromptTag {
  prompt_id: string;
  tag_id: string;
}

interface AnalysisRun {
  id: string;
  prompt_id: string;
  created_at: string;
}

interface UserProject {
  id: string;
  name: string;
}

const STATUS_OPTIONS = [
  { value: "attivo", label: "ATTIVO", variant: "default" as const },
  { value: "suggerito", label: "SUGGERITO", variant: "secondary" as const },
  { value: "inattivo", label: "INATTIVO", variant: "outline" as const },
];

const PromptsV2 = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<UserProject | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [promptTags, setPromptTags] = useState<PromptTag[]>([]);
  const [analysisRuns, setAnalysisRuns] = useState<AnalysisRun[]>([]);
  
  // Search
  const [searchQuery, setSearchQuery] = useState("");
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [topicDialogOpen, setTopicDialogOpen] = useState(false);
  
  // Form state
  const [editingPrompt, setEditingPrompt] = useState<Partial<Prompt> | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTopicName, setNewTopicName] = useState("");
  
  // Run dialog state
  const [runPrompt, setRunPrompt] = useState<Prompt | null>(null);
  const [runBrandId, setRunBrandId] = useState<string>("");
  const [runModelIds, setRunModelIds] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  
  // Create brand dialog state
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandWebsite, setNewBrandWebsite] = useState("");
  const [creatingBrand, setCreatingBrand] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }
      await fetchData(session.user.id);
    };
    checkAuth();
  }, [navigate]);

  const fetchData = async (userId: string) => {
    setLoading(true);
    try {
      // Fetch user's first project
      const { data: projectData } = await supabase
        .from("user_projects")
        .select("id, name")
        .eq("user_id", userId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (!projectData) {
        setLoading(false);
        return;
      }
      setProject(projectData);

      // Fetch all related data in parallel
      const [
        promptsRes,
        brandsRes,
        topicsRes,
        tagsRes,
        modelsRes,
        promptTagsRes,
        runsRes
      ] = await Promise.all([
        supabase.from("prompts").select("*").eq("project_id", projectData.id),
        supabase.from("brands").select("id, name").eq("project_id", projectData.id),
        supabase.from("topics").select("id, name, color").eq("project_id", projectData.id),
        supabase.from("tags").select("id, name, color").eq("project_id", projectData.id),
        supabase.from("ai_models").select("id, name, display_name, is_active").eq("is_active", true),
        supabase.from("prompt_tags").select("prompt_id, tag_id"),
        supabase.from("analysis_runs").select("id, prompt_id, created_at").eq("project_id", projectData.id)
      ]);

      setPrompts((promptsRes.data as Prompt[]) || []);
      setBrands(brandsRes.data || []);
      setTopics(topicsRes.data || []);
      setTags(tagsRes.data || []);
      setModels(modelsRes.data || []);
      setPromptTags(promptTagsRes.data || []);
      setAnalysisRuns(runsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Errore nel caricamento dei dati");
    } finally {
      setLoading(false);
    }
  };

  // Filter prompts by search
  const filteredPrompts = useMemo(() => {
    return prompts.filter(p =>
      p.text.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [prompts, searchQuery]);

  // Get brand name by id
  const getBrandName = (brandId: string | null) => {
    if (!brandId) return null;
    return brands.find(b => b.id === brandId)?.name || null;
  };

  // Get topic name by id
  const getTopicName = (topicId: string | null) => {
    if (!topicId) return null;
    return topics.find(t => t.id === topicId)?.name || null;
  };

  // Get model name by id
  const getModelName = (modelId: string | null) => {
    if (!modelId) return null;
    return models.find(m => m.id === modelId)?.display_name || null;
  };

  // Get tags for a prompt
  const getPromptTags = (promptId: string) => {
    const tagIds = promptTags.filter(pt => pt.prompt_id === promptId).map(pt => pt.tag_id);
    return tags.filter(t => tagIds.includes(t.id));
  };

  // Get last run date for a prompt
  const getLastRunDate = (promptId: string) => {
    const runs = analysisRuns
      .filter(r => r.prompt_id === promptId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return runs[0]?.created_at || null;
  };

  // Open edit dialog
  const openEditDialog = (prompt?: Prompt) => {
    if (prompt) {
      setEditingPrompt({ ...prompt });
      const tagIds = promptTags.filter(pt => pt.prompt_id === prompt.id).map(pt => pt.tag_id);
      setSelectedTagIds(tagIds);
    } else {
      setEditingPrompt({
        text: "",
        project_id: project?.id,
        status: "attivo",
        brand_id: null,
        topic_id: null,
        preferred_model_id: null,
      });
      setSelectedTagIds([]);
    }
    setEditDialogOpen(true);
  };

  // Duplicate prompt
  const duplicatePrompt = (prompt: Prompt) => {
    setEditingPrompt({
      text: prompt.text,
      project_id: project?.id,
      status: "suggerito",
      brand_id: prompt.brand_id,
      topic_id: prompt.topic_id,
      preferred_model_id: prompt.preferred_model_id,
    });
    const tagIds = promptTags.filter(pt => pt.prompt_id === prompt.id).map(pt => pt.tag_id);
    setSelectedTagIds(tagIds);
    setEditDialogOpen(true);
  };

  // Save prompt
  const savePrompt = async () => {
    if (!editingPrompt || !editingPrompt.text?.trim() || !project) {
      toast.error("Il testo del prompt è obbligatorio");
      return;
    }

    try {
      const isNew = !editingPrompt.id;
      const promptData = {
        text: editingPrompt.text,
        project_id: project.id,
        status: editingPrompt.status || "attivo",
        brand_id: editingPrompt.brand_id || null,
        topic_id: editingPrompt.topic_id || null,
        preferred_model_id: editingPrompt.preferred_model_id || null,
      };

      let savedPromptId: string;

      if (isNew) {
        const { data, error } = await supabase
          .from("prompts")
          .insert(promptData)
          .select("id")
          .single();
        if (error) throw error;
        savedPromptId = data.id;
      } else {
        const { error } = await supabase
          .from("prompts")
          .update(promptData)
          .eq("id", editingPrompt.id);
        if (error) throw error;
        savedPromptId = editingPrompt.id;

        // Delete existing tags
        await supabase.from("prompt_tags").delete().eq("prompt_id", savedPromptId);
      }

      // Insert new tags
      if (selectedTagIds.length > 0) {
        const tagInserts = selectedTagIds.map(tagId => ({
          prompt_id: savedPromptId,
          tag_id: tagId,
        }));
        await supabase.from("prompt_tags").insert(tagInserts);
      }

      toast.success(isNew ? "Prompt creato" : "Prompt aggiornato");
      setEditDialogOpen(false);
      
      // Refresh data
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await fetchData(session.user.id);
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast.error("Errore nel salvataggio");
    }
  };

  // Create new topic
  const createTopic = async () => {
    if (!newTopicName.trim() || !project) return;
    
    try {
      const { data, error } = await supabase
        .from("topics")
        .insert({ name: newTopicName, project_id: project.id })
        .select("id, name, color")
        .single();
      
      if (error) throw error;
      
      setTopics([...topics, data]);
      setEditingPrompt({ ...editingPrompt, topic_id: data.id });
      setNewTopicName("");
      setTopicDialogOpen(false);
      toast.success("Topic creato");
    } catch (error) {
      console.error("Error creating topic:", error);
      toast.error("Errore nella creazione del topic");
    }
  };

  // Open run dialog
  const openRunDialog = (prompt: Prompt) => {
    setRunPrompt(prompt);
    setRunBrandId(prompt.brand_id || "");
    setRunModelIds(prompt.preferred_model_id ? [prompt.preferred_model_id] : []);
    setRunDialogOpen(true);
  };

  // Create new brand
  const createBrand = async () => {
    if (!newBrandName.trim() || !project) return;
    
    setCreatingBrand(true);
    try {
      const { data, error } = await supabase
        .from("brands")
        .insert({ 
          name: newBrandName.trim(), 
          project_id: project.id,
          website_url: newBrandWebsite.trim() || null
        })
        .select("id, name")
        .single();
      
      if (error) throw error;
      
      setBrands([...brands, data]);
      setRunBrandId(data.id); // Auto-select the new brand
      setNewBrandName("");
      setNewBrandWebsite("");
      setBrandDialogOpen(false);
      toast.success(`Brand "${data.name}" creato`);
    } catch (error) {
      console.error("Error creating brand:", error);
      toast.error("Errore nella creazione del brand");
    } finally {
      setCreatingBrand(false);
    }
  };

  // Execute analysis run
  const executeRun = async () => {
    if (!runPrompt || !project) return;
    if (!runBrandId) {
      toast.error("Seleziona un brand");
      return;
    }
    if (runModelIds.length === 0) {
      toast.error("Seleziona almeno un modello");
      return;
    }

    setIsRunning(true);
    try {
      // Create analysis runs for each selected model
      const runs = runModelIds.map(modelId => ({
        project_id: project.id,
        brand_id: runBrandId,
        prompt_id: runPrompt.id,
        model_id: modelId,
        status: "pending",
      }));

      const { data, error } = await supabase
        .from("analysis_runs")
        .insert(runs)
        .select("id");

      if (error) throw error;

      toast.success(`${data.length} analisi avviate, esecuzione in corso...`);
      setRunDialogOpen(false);

      // Execute each analysis run via edge function
      for (const run of data) {
        try {
          const { error: fnError } = await supabase.functions.invoke("run-analysis", {
            body: { run_id: run.id },
          });
          
          if (fnError) {
            console.error("Error running analysis:", fnError);
            toast.error(`Errore nell'analisi: ${fnError.message}`);
          }
        } catch (err) {
          console.error("Error invoking run-analysis:", err);
        }
      }

      toast.success("Analisi completate!");

      // Refresh data
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await fetchData(session.user.id);
    } catch (error) {
      console.error("Error creating analysis runs:", error);
      toast.error("Errore nell'avvio dell'analisi");
    } finally {
      setIsRunning(false);
    }
  };

  // Toggle model selection for run
  const toggleRunModel = (modelId: string) => {
    setRunModelIds(prev =>
      prev.includes(modelId)
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId]
    );
  };

  // Toggle tag selection
  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const getStatusBadge = (status: string) => {
    const opt = STATUS_OPTIONS.find(s => s.value === status);
    return opt ? <Badge variant={opt.variant}>{opt.label}</Badge> : null;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-6 w-6 text-creative" />
            <div>
              <h1 className="text-2xl font-serif font-medium">Prompt V2</h1>
              {project && (
                <p className="text-sm text-muted-foreground">Progetto: {project.name}</p>
              )}
            </div>
            <Badge variant="outline" className="ml-2">Labs</Badge>
          </div>
          <Button onClick={() => openEditDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuovo Prompt
          </Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !project ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Nessun progetto trovato. Crea un progetto per gestire i prompt.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca prompt..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Prompts Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Prompt</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Topic</TableHead>
                      <TableHead>Modello</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Ultimo Run</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPrompts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          {prompts.length === 0 
                            ? "Nessun prompt. Crea il primo!" 
                            : "Nessun prompt trovato con questa ricerca"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPrompts.map(prompt => {
                        const lastRun = getLastRunDate(prompt.id);
                        const promptTagsList = getPromptTags(prompt.id);
                        
                        return (
                          <TableRow key={prompt.id}>
                            <TableCell>
                              <div className="max-w-md">
                                <p className="truncate font-medium">{prompt.text}</p>
                                {promptTagsList.length > 0 && (
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    {promptTagsList.map(tag => (
                                      <Badge 
                                        key={tag.id} 
                                        variant="outline" 
                                        className="text-xs"
                                        style={{ borderColor: tag.color || undefined }}
                                      >
                                        {tag.name}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getBrandName(prompt.brand_id) || (
                                <span className="text-muted-foreground italic">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {getTopicName(prompt.topic_id) || (
                                <span className="text-muted-foreground italic">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {getModelName(prompt.preferred_model_id) || (
                                <span className="text-muted-foreground italic">—</span>
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(prompt.status)}</TableCell>
                            <TableCell>
                              {lastRun ? (
                                new Date(lastRun).toLocaleDateString("it-IT")
                              ) : (
                                <span className="text-muted-foreground italic">Mai</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditDialog(prompt)}
                                  title="Modifica"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => duplicatePrompt(prompt)}
                                  title="Duplica"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openRunDialog(prompt)}
                                  title="Avvia Analisi"
                                  className="text-creative hover:text-creative"
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <Footer />

      {/* Edit/Create Prompt Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPrompt?.id ? "Modifica Prompt" : "Nuovo Prompt"}
            </DialogTitle>
            <DialogDescription>
              Configura il prompt per l'analisi AI
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Prompt Text */}
            <div className="space-y-2">
              <Label htmlFor="prompt-text">Testo del Prompt *</Label>
              <Textarea
                id="prompt-text"
                value={editingPrompt?.text || ""}
                onChange={(e) => setEditingPrompt({ ...editingPrompt, text: e.target.value })}
                placeholder="Scrivi il prompt da inviare ai modelli AI..."
                rows={4}
              />
            </div>

            {/* Brand Selection */}
            <div className="space-y-2">
              <Label>Brand (opzionale)</Label>
              <Select
                value={editingPrompt?.brand_id || "none"}
                onValueChange={(v) => setEditingPrompt({ ...editingPrompt, brand_id: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona brand" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessun brand</SelectItem>
                  {brands.map(brand => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preferred Model */}
            <div className="space-y-2">
              <Label>Modello Preferito (opzionale)</Label>
              <Select
                value={editingPrompt?.preferred_model_id || "none"}
                onValueChange={(v) => setEditingPrompt({ ...editingPrompt, preferred_model_id: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona modello" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessun modello preferito</SelectItem>
                  {models.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Topic Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Topic (opzionale)</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTopicDialogOpen(true)}
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Nuovo Topic
                </Button>
              </div>
              <Select
                value={editingPrompt?.topic_id || "none"}
                onValueChange={(v) => setEditingPrompt({ ...editingPrompt, topic_id: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona topic" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessun topic</SelectItem>
                  {topics.map(topic => (
                    <SelectItem key={topic.id} value={topic.id}>
                      {topic.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tag</Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-md min-h-[60px]">
                {tags.length === 0 ? (
                  <span className="text-muted-foreground text-sm">Nessun tag disponibile</span>
                ) : (
                  tags.map(tag => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <Badge
                        key={tag.id}
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer"
                        style={{ 
                          borderColor: tag.color || undefined,
                          backgroundColor: isSelected ? (tag.color || undefined) : undefined
                        }}
                        onClick={() => toggleTag(tag.id)}
                      >
                        <TagIcon className="h-3 w-3 mr-1" />
                        {tag.name}
                        {isSelected && <X className="h-3 w-3 ml-1" />}
                      </Badge>
                    );
                  })
                )}
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label>Stato</Label>
              <Select
                value={editingPrompt?.status || "attivo"}
                onValueChange={(v) => setEditingPrompt({ ...editingPrompt, status: v as Prompt["status"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={savePrompt}>
              {editingPrompt?.id ? "Salva" : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Topic Dialog */}
      <Dialog open={topicDialogOpen} onOpenChange={setTopicDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo Topic</DialogTitle>
            <DialogDescription>Crea un nuovo topic per organizzare i prompt</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="topic-name">Nome Topic</Label>
            <Input
              id="topic-name"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              placeholder="Es. Acquisto, Supporto, Comparazione..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopicDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={createTopic} disabled={!newTopicName.trim()}>
              Crea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Run Analysis Dialog */}
      <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-creative" />
              Avvia Analisi
            </DialogTitle>
            <DialogDescription>
              Esegui questo prompt sui modelli AI selezionati
            </DialogDescription>
          </DialogHeader>
          
          {runPrompt && (
            <div className="space-y-4 py-4">
              {/* Prompt Preview */}
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm font-medium mb-1">Prompt:</p>
                <p className="text-sm text-muted-foreground line-clamp-3">{runPrompt.text}</p>
              </div>

              {/* Brand Selection */}
              <div className="space-y-2">
                <Label>Brand *</Label>
                <Select value={runBrandId} onValueChange={setRunBrandId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map(brand => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {brands.length === 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setBrandDialogOpen(true)}
                    className="mt-2 w-full gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Crea il primo brand
                  </Button>
                )}
              </div>

              {/* Model Selection */}
              <div className="space-y-2">
                <Label>Modelli AI *</Label>
                <div className="space-y-2 p-3 border rounded-md">
                  {models.map(model => (
                    <div key={model.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`model-${model.id}`}
                        checked={runModelIds.includes(model.id)}
                        onCheckedChange={() => toggleRunModel(model.id)}
                      />
                      <label
                        htmlFor={`model-${model.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {model.display_name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRunDialogOpen(false)}>
              Annulla
            </Button>
            <Button 
              onClick={executeRun} 
              disabled={isRunning || !runBrandId || runModelIds.length === 0}
              className="gap-2"
            >
              {isRunning ? (
                "Avvio in corso..."
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Avvia ({runModelIds.length} {runModelIds.length === 1 ? "modello" : "modelli"})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Brand Dialog */}
      <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crea Brand</DialogTitle>
            <DialogDescription>
              Aggiungi un brand da monitorare
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="brand-name">Nome brand *</Label>
              <Input
                id="brand-name"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                placeholder="Es. Nike, Acme Corp..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand-website">Sito web (opzionale)</Label>
              <Input
                id="brand-website"
                value={newBrandWebsite}
                onChange={(e) => setNewBrandWebsite(e.target.value)}
                placeholder="https://www.example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBrandDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={createBrand} disabled={!newBrandName.trim() || creatingBrand}>
              {creatingBrand ? "Creazione..." : "Crea Brand"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PromptsV2;
