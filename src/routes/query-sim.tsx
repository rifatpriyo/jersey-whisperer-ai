import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/AppShell";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { matchQuery } from "@/lib/ai-matcher";
import type { QueryReasoning } from "@/lib/types";
import { Send, MessageSquare, Bot, Sparkles } from "lucide-react";

export const Route = createFileRoute("/query-sim")({
  head: () => ({ meta: [{ title: "Query Simulation — JerseyBecho AI" }] }),
  component: QueryPage,
});

const TESTS = [
  "Argentina Messi XL ase?",
  "Brazil Neymar retro L ache?",
  "Spain away 2026 WC kit ase?",
  "Portugal Ronaldo L available?",
  "Bangladesh national team jersey L size ache?",
  "Real Madrid Bellingham M size available?",
  "Thailand imported player edition ase?",
  "Argentina 2006 retro M ache?",
];

interface Turn {
  query: string;
  result: QueryReasoning;
}

function QueryPage() {
  const { products } = useStore();
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);

  const send = (q: string) => {
    if (!q.trim()) return;
    const result = matchQuery(q, products);
    setTurns((t) => [{ query: q, result }, ...t]);
    setInput("");
  };

  return (
    <>
      <PageHeader
        title="Customer Query Simulation"
        subtitle="Test how the future 24/7 AI sales assistant will reply — inventory-aware, never hallucinated"
      />

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Type a customer message (Bangla / Banglish / English)..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
            />
            <Button onClick={() => send(input)}>
              <Send className="h-4 w-4 mr-1" /> Send
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {TESTS.map((t) => (
              <button
                key={t}
                onClick={() => send(t)}
                className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {t}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {turns.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Click a test button or type a message to see how the AI replies.
            </CardContent>
          </Card>
        )}
        {turns.map((t, i) => (
          <div key={i} className="grid lg:grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] uppercase text-muted-foreground font-medium">Customer</div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2 mt-1 text-sm">
                      {t.query}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] uppercase text-muted-foreground font-medium">
                      JerseyBecho AI
                    </div>
                    <div className="bg-primary/10 border border-primary/20 rounded-2xl rounded-tl-sm px-3 py-2 mt-1 text-sm whitespace-pre-wrap">
                      {t.result.reply}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-accent/40 bg-accent/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <div className="font-semibold text-sm">AI Reasoning Preview</div>
                  <Badge
                    variant="outline"
                    className={
                      t.result.confidence >= 70
                        ? "bg-success/15 text-success border-success/30 ml-auto"
                        : t.result.confidence >= 45
                        ? "bg-warning/15 text-warning-foreground border-warning/40 ml-auto"
                        : "bg-destructive/10 text-destructive border-destructive/30 ml-auto"
                    }
                  >
                    Confidence {t.result.confidence}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <Row k="Original query" v={t.result.original} />
                  <Row k="Normalized" v={t.result.normalized} />
                  <Row k="Detected team" v={t.result.detected_team} />
                  <Row k="Detected player" v={t.result.detected_player} />
                  <Row k="Detected year" v={t.result.detected_year} />
                  <Row k="Detected size" v={t.result.detected_size} />
                  <Row k="Detected edition" v={t.result.detected_edition} />
                  <Row k="Detected source" v={t.result.detected_source} />
                  <Row k="Best match" v={t.result.matched_product_name} />
                  <Row k="Inventory source" v={t.result.matched_product_id ? "Real inventory record" : "—"} />
                </div>

                <div className="mt-3 p-2 rounded-md bg-background border border-border text-xs">
                  <div className="font-semibold mb-1">Reason</div>
                  <div className="text-muted-foreground">{t.result.reason}</div>
                </div>

                {t.result.candidates && t.result.candidates.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold mb-1">Top candidates</div>
                    <div className="space-y-1">
                      {t.result.candidates.map((c) => (
                        <div
                          key={c.product_id}
                          className="flex justify-between text-xs px-2 py-1 rounded bg-background border border-border"
                        >
                          <span>{c.name}</span>
                          <span className="font-mono text-muted-foreground">{c.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v?: any }) {
  return (
    <>
      <div className="text-muted-foreground">{k}</div>
      <div className="font-medium text-foreground truncate">{v ?? "—"}</div>
    </>
  );
}
